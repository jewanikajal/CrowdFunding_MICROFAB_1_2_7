'use strict';
/*
 * Cross-channel synchronisation benchmark.
 * Submits N governance-channel PlatformContract:RecordValidatorDecision txs at a fixed rate; each one writes
 * PlatformPrivateData (homed on the investment channel) -> outbox -> relay -> ApplySync.
 * Measures source latency/throughput, sync lag (source commit -> target commit) and verifies that
 * every record arrived intact on the investment channel.
 *   node bridge_bench.js '{"tps":50,"n":1500,"statsFile":"...","out":"...","waitSec":180}'
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
const cfg = JSON.parse(process.argv[2]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function gw(org) {
  const d = `${org.toLowerCase()}.example.com`, host = `peer0.${d}`, base = `/crypto/peerOrganizations/${d}`, msp = `${base}/users/User1@${d}/msp`;
  const client = new grpc.Client(`${host}:7051`, grpc.credentials.createSsl(fs.readFileSync(`${base}/peers/${host}/tls/ca.crt`)));
  return connect({ client, identity: { mspId: `${org}MSP`, credentials: fs.readFileSync(path.join(msp, 'signcerts', fs.readdirSync(`${msp}/signcerts`)[0])) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(msp, 'keystore', fs.readdirSync(`${msp}/keystore`)[0])))), hash: hash.sha256 });
}
const pct = (a, p) => (a.length ? +a[Math.min(a.length - 1, Math.floor(p / 100 * a.length))].toFixed(3) : null);
(async () => {
  const g = gw('PlatformOrg');
  const gov = g.getNetwork('governance-validation-channel').getContract('governance');
  const inv = g.getNetwork('investment-execution-channel').getContract('investment');
  const run = Date.now().toString(36), recs = [], t0 = Date.now(), ps = [];
  for (let i = 0; i < cfg.n; i++) {
    const due = t0 + i * 1000 / cfg.tps; const w = due - Date.now(); if (w > 1) await sleep(w);
    const id = `W${run}_${i}`, s = Date.now();
    ps.push((async () => {
      try {
        const c = await gov.submitAsync('PlatformContract:RecordValidatorDecision', { arguments: [id, `CAMP_${i}`, `VAL_${i}`, 'hash', 'true', '90', 'rh'] });
        const st = await c.getStatus();
        recs.push({ id, tx: c.getTransactionId(), s, c: Date.now(), ok: st.successful, code: st.code });
      } catch (e) { recs.push({ id, s, c: Date.now(), ok: false, err: (e.message || '').slice(0, 120) }); }
    })());
  }
  await Promise.all(ps);
  const srcDone = Date.now();
  const okRecs = recs.filter((r) => r.ok);
  // wait for the relay to apply everything
  const want = new Map(okRecs.map((r) => [`OUTBOX_${r.tx}_PlatformPrivateData_VALIDATOR_DECISION_${r.id}`, r]));
  const applied = new Map();
  const deadline = Date.now() + (cfg.waitSec || 180) * 1000;
  while (Date.now() < deadline) {
    applied.clear();
    if (fs.existsSync(cfg.statsFile)) for (const line of fs.readFileSync(cfg.statsFile, 'utf8').split('\n')) {
      if (!line) continue; const j = JSON.parse(line);
      if (j.key && want.has(j.key) && j.appliedMs) { const prev = applied.get(j.key); if (!prev || j.appliedMs < prev.appliedMs) applied.set(j.key, j); }
    }
    if (applied.size >= want.size) break;
    await sleep(1000);
  }
  // independent verification on the target ledger
  let present = 0, intact = 0;
  await Promise.all([...want.values()].map(async (r) => {
    try {
      const v = JSON.parse(Buffer.from(await inv.evaluateTransaction('DataBridgeContract:ReadData', 'PlatformPrivateData', `VALIDATOR_DECISION_${r.id}`)).toString());
      present++; if (v.walletId === r.id || v.WalletID === r.id || JSON.stringify(v).includes(r.id)) intact++;
    } catch { /* missing */ }
  }));
  const lags = [...applied.entries()].map(([k, a]) => (a.appliedMs - want.get(k).c) / 1000).sort((a, b) => a - b);
  const srcLat = okRecs.map((r) => (r.c - r.s) / 1000).sort((a, b) => a - b);
  const lastApplied = Math.max(0, ...[...applied.values()].map((a) => a.appliedMs));
  const dup = [...(fs.existsSync(cfg.statsFile) ? fs.readFileSync(cfg.statsFile, 'utf8').split('\n') : [])].filter((l) => l.includes('ALREADY_APPLIED')).length;
  const out = { tag: cfg.tag || '', tps: cfg.tps, submitted: cfg.n, sourceCommitted: okRecs.length,
    sourceFailed: recs.length - okRecs.length, sourceErrors: recs.filter((r) => !r.ok).reduce((m, r) => { const k = r.err ? r.err.slice(0, 60) : `code_${r.code}`; m[k] = (m[k] || 0) + 1; return m; }, {}),
    sourceThroughput: +(okRecs.length / ((srcDone - t0) / 1000)).toFixed(1),
    sourceLatAvg: srcLat.length ? +(srcLat.reduce((a, b) => a + b, 0) / srcLat.length).toFixed(3) : null, sourceLatP95: pct(srcLat, 95),
    relayed: applied.size, targetPresent: present, targetIntact: intact, missing: want.size - present,
    endToEndThroughput: lastApplied ? +(applied.size / ((lastApplied - t0) / 1000)).toFixed(1) : 0,
    syncLagAvg: lags.length ? +(lags.reduce((a, b) => a + b, 0) / lags.length).toFixed(3) : null,
    syncLagP50: pct(lags, 50), syncLagP95: pct(lags, 95), syncLagMax: lags.length ? +lags[lags.length - 1].toFixed(3) : null,
    idempotentReplaysObserved: dup };
  fs.writeFileSync(cfg.out, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
  g.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
