'use strict';
/*
 * BlockAssist+ open-loop load generator (Fabric Gateway SDK).
 *
 * Equivalent to Hyperledger Caliper's "fixed-rate" controller: transactions are
 * scheduled at a constant send rate regardless of whether earlier ones finished,
 * so latency grows (and throughput saturates) once the network is overloaded.
 *
 *   node loadgen.js '<json config>'
 *   config = { channel, chaincode, workload, tps, txCount, workers, out, peers:{Org:[hosts]}, cryptoRoot }
 *
 * Metrics (same definitions as Caliper):
 *   send rate   = submitted / (last submit - first submit)
 *   throughput  = successful / (last commit - first submit)
 *   latency     = commit-event time - submit time (successful tx only)
 */
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKLOADS = {
  // InvestorOrg writes public INVESTOR_PUB_* + InvestorPrivateData + InvestorValidatorShared (PDC)
  register: { fn: 'InvestorContract:RegisterInvestor', org: 'InvestorOrg',
    args: (id) => [`INV_${id}`, `Investor ${id}`, '30000000', '1234-5678-9012', 'ABCDE1234F'] },
  // InvestorOrg writes StartupInvestorShared + InvestorPrivateData (single) / public state (dual)
  invest: { fn: 'InvestorContract:MakeInvestment', org: 'InvestorOrg',
    args: (id) => [`INVT_${id}`, 'CAMP_BENCH', 'INV_BENCH', '25000000', 'INR'] },
  // StartupOrg writes StartupPrivateData (single) / governance public state (dual, AND(Validator,Platform))
  startup: { fn: 'StartupContract:CreateStartup', org: 'StartupOrg',
    args: (id) => [`ST_${id}`, `owner_${id}`, `Startup ${id}`, 'benchmark startup', `D${id}`] },
  // public-state only write; used for endorsement-policy scaling (any org can endorse)
  token: { fn: 'TokenContract:CreateTokenAccount', org: 'PlatformOrg',
    args: (id) => [`ACC_${id}`, `owner_${id}`, 'USER', '{}'] },
  // ---- hardened chaincode variants (crowdfundingv2_hardened / v3) ----
  // KYC in the transient map (never in the block); role guard; deterministic timestamps
  register_h: { fn: 'InvestorContract:RegisterInvestor', org: 'InvestorOrg',
    args: (id) => [`INV_${id}`, `Investor ${id}`, '0', '', ''],
    transient: (id) => ({ kyc: Buffer.from(JSON.stringify({ annualIncome: 30000000, aadharNumber: '1234-5678-9012', panNumber: 'ABCDE1234F' })) }) },
  // token ledger in the separate cftoken chaincode, OutOf(2,4) endorsement (run with --chaincode cftoken)
  token_h: { fn: 'TokenContract:CreateTokenAccount', org: 'PlatformOrg',
    args: (id) => [`ACC_${id}`, `owner_${id}`, 'USER', '{}'] },
  // read-only query (evaluate, not ordered)
  query: { fn: 'TokenContract:GetTokenAccount', org: 'PlatformOrg', evaluate: true,
    args: () => ['ACC_SEED'] },
};

function dom(org) { return `${org.toLowerCase()}.example.com`; }

// --------------------------------------------------------------------------- worker
async function worker(cfg) {
  const grpc = require('@grpc/grpc-js');
  const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
  const wl = WORKLOADS[cfg.workload];
  const org = cfg.org || wl.org;
  const d = dom(org);
  const hosts = cfg.peers[org];
  const host = hosts[cfg.idx % hosts.length];
  const base = path.join(cfg.cryptoRoot, 'peerOrganizations', d);
  const tlsRoot = fs.readFileSync(path.join(base, 'peers', host, 'tls', 'ca.crt'));
  const userMsp = path.join(base, 'users', `User1@${d}`, 'msp');
  const cert = fs.readFileSync(path.join(userMsp, 'signcerts', fs.readdirSync(path.join(userMsp, 'signcerts'))[0]));
  const key = crypto.createPrivateKey(fs.readFileSync(path.join(userMsp, 'keystore', fs.readdirSync(path.join(userMsp, 'keystore'))[0])));
  const client = new grpc.Client(`${host}:7051`, grpc.credentials.createSsl(tlsRoot),
    { 'grpc.max_concurrent_streams': 10000 });
  const gw = connect({
    client, identity: { mspId: `${org}MSP`, credentials: cert }, signer: signers.newPrivateKeySigner(key), hash: hash.sha256,
    evaluateOptions: () => ({ deadline: Date.now() + 60000 }),
    endorseOptions: () => ({ deadline: Date.now() + 60000 }),
    submitOptions: () => ({ deadline: Date.now() + 60000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 180000 }),
  });
  const contract = gw.getNetwork(cfg.channel).getContract(cfg.chaincode);

  const n = cfg.count, interval = 1000 / cfg.rate;
  const recs = new Array(n);
  const pending = [];
  const t0 = performance.now(), wall0 = Date.now();
  for (let i = 0; i < n; i++) {
    const due = t0 + i * interval;
    const wait = due - performance.now();
    if (wait > 1) await new Promise((r) => setTimeout(r, wait));
    const id = `${cfg.runId}_${cfg.idx}_${i}`;
    const args = wl.args(id);
    const start = performance.now();
    const p = (async () => {
      try {
        if (wl.evaluate) {
          await contract.evaluateTransaction(wl.fn, ...args);
        } else {
          const commit = await contract.submitAsync(wl.fn, wl.transient ? { arguments: args, transientData: wl.transient(id) } : { arguments: args });
          const st = await commit.getStatus();
          if (!st.successful) return [start, performance.now(), 0, `COMMIT_${st.code}`];
        }
        return [start, performance.now(), 1, ''];
      } catch (e) {
        return [start, performance.now(), 0, classify(e)];
      }
    })().then((r) => { recs[i] = r; });
    pending.push(p);
  }
  await Promise.all(pending);
  gw.close(); client.close();
  fs.writeFileSync(cfg.recFile, JSON.stringify({ t0, wall0, recs }));
}

function classify(e) {
  const msg = [e.message || ''].concat((e.details || []).map((x) => x.message || '')).join(' | ');
  if (/do not match|mismatch/i.test(msg)) return 'ENDORSE_MISMATCH';
  if (/MVCC_READ_CONFLICT/.test(msg)) return 'MVCC_READ_CONFLICT';
  if (/PHANTOM/.test(msg)) return 'PHANTOM_READ_CONFLICT';
  if (/already exists/i.test(msg)) return 'DUPLICATE';
  if (/exceeding concurrency limit/.test(msg)) return 'GATEWAY_OVERLOAD';
  if (/DEADLINE_EXCEEDED|deadline/i.test(msg)) return 'TIMEOUT';
  if (/RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(msg)) return 'UNAVAILABLE';
  if (/no combination of peers|endorsement policy|failed to collect/i.test(msg)) return 'ENDORSE_POLICY';
  return `OTHER:${msg.replace(/\s+/g, ' ').slice(0, 160)}`;
}

// --------------------------------------------------------------------------- manager
function pct(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p / 100 * sorted.length))] : null; }

async function manager(cfg) {
  const W = cfg.workers || 4;
  const runId = cfg.runId || `${cfg.workload}${Date.now().toString(36)}`;
  const tmp = path.join(path.dirname(cfg.out), `.rec_${runId}`);
  fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(cfg.txCount / W);
  const kids = [];
  for (let w = 0; w < W; w++) {
    const wc = { ...cfg, idx: w, runId, rate: cfg.tps / W, count: per, recFile: path.join(tmp, `w${w}.json`) };
    kids.push(new Promise((res, rej) => {
      const c = fork(__filename, ['--worker', JSON.stringify(wc)]);
      c.on('exit', (code) => (code === 0 ? res() : rej(new Error(`worker ${w} exit ${code}`))));
    }));
  }
  await Promise.all(kids);

  // align all workers on wall-clock (they start within ms of each other)
  const all = [];
  for (let w = 0; w < W; w++) {
    const { t0, wall0, recs } = JSON.parse(fs.readFileSync(path.join(tmp, `w${w}.json`)));
    for (const [s, e, ok, err] of recs) all.push([wall0 + (s - t0), wall0 + (e - t0), ok, err]);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  all.sort((a, b) => a[0] - b[0]);
  const succ = all.filter((r) => r[2] === 1);
  const lat = succ.map((r) => (r[1] - r[0]) / 1000).sort((a, b) => a - b);
  const firstSend = all[0][0], lastSend = all[all.length - 1][0];
  const lastDone = Math.max(...all.map((r) => r[1]));
  const errors = {};
  for (const r of all) if (!r[2]) errors[r[3]] = (errors[r[3]] || 0) + 1;
  const sum = {
    workload: cfg.workload, channel: cfg.channel, chaincode: cfg.chaincode, targetTps: cfg.tps, workers: W,
    submitted: all.length, succeeded: succ.length, failed: all.length - succ.length,
    sendRate: +(all.length / Math.max((lastSend - firstSend) / 1000, 1e-3)).toFixed(1),
    throughput: +(succ.length / ((lastDone - firstSend) / 1000)).toFixed(1),
    latAvg: lat.length ? +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(3) : null,
    latMin: lat.length ? +lat[0].toFixed(3) : null,
    latP50: pct(lat, 50), latP95: pct(lat, 95), latP99: pct(lat, 99),
    latMax: lat.length ? +lat[lat.length - 1].toFixed(3) : null,
    startMs: firstSend, endMs: lastDone, errors,
  };
  for (const k of ['latP50', 'latP95', 'latP99']) if (sum[k] != null) sum[k] = +sum[k].toFixed(3);
  fs.writeFileSync(cfg.out, JSON.stringify(sum, null, 2));
  console.log(JSON.stringify(sum));
}

if (process.argv[2] === '--worker') {
  worker(JSON.parse(process.argv[3])).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} else {
  manager(JSON.parse(process.argv[2])).catch((e) => { console.error(e); process.exit(1); });
}
