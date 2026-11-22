'use strict';
/*
 * Task 4: reproduce the Caliper workload CHAINS of the paper (caliper-workspace/workloads in
 * josephrichard1988/crowdfunding, single-channel arm) on the ORIGINAL v2 single-channel chaincode,
 * and classify the failure of every step (Fabric validation code, or endorsement-phase error).
 *
 *   node task4_chains.js <respond|dispute> <iterations> <iterationsPerSecond> <out.json>
 *
 * respond  (respondToInvestmentProposal.js): createStartup -> createCampaign -> createInvestmentProposal
 *          (InvestorOrg) -> respondToInvestmentProposal (StartupOrg), unique IDs per iteration
 * dispute  (createDispute.js, minus witnessAgreement): createStartup -> createCampaign -> registerInvestor
 *          -> createTokenAccount x2 -> transferTokens PLATFORM->investor -> createDispute
 * Like Caliper, iterations are started at a fixed rate and not awaited; steps inside an iteration
 * are sequential and an iteration stops at its first failed step (sendOk semantics).
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), grpc = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
const [MODE, N, RATE, OUT] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const CH = 'crowdfunding-channel', CC = 'crowdfunding', R = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gws = {};
function contract(org) {
  if (gws[org]) return gws[org].c;
  const d = `${org.toLowerCase()}.example.com`, h = `peer0.${d}`, b = `/crypto/peerOrganizations/${d}`, m = `${b}/users/User1@${d}/msp`;
  const client = new grpc.Client(`${h}:7051`, grpc.credentials.createSsl(fs.readFileSync(`${b}/peers/${h}/tls/ca.crt`)));
  const g = connect({ client, identity: { mspId: `${org}MSP`, credentials: fs.readFileSync(path.join(m, 'signcerts', fs.readdirSync(`${m}/signcerts`)[0])) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(m, 'keystore', fs.readdirSync(`${m}/keystore`)[0])))), hash: hash.sha256,
    endorseOptions: () => ({ deadline: Date.now() + 60000 }), submitOptions: () => ({ deadline: Date.now() + 60000 }), commitStatusOptions: () => ({ deadline: Date.now() + 120000 }) });
  gws[org] = { g, c: g.getNetwork(CH).getContract(CC) };
  return gws[org].c;
}
const stats = {}; // step -> {VALID:n, code_X:n, 'endorse: msg':n}
function note(step, k) { stats[step] = stats[step] || {}; stats[step][k] = (stats[step][k] || 0) + 1; }
async function step(name, org, fn, args) {
  try {
    const c = await contract(org).submitAsync(fn, { arguments: args.map(String) });
    const st = await c.getStatus();
    note(name, st.successful ? 'VALID' : `code_${st.code}`);
    return st.successful;
  } catch (e) {
    const msg = ((e.details || []).map((d) => d.message).join(' | ') || e.message).replace(/transaction ID: \w+/g, '').replace(/\s+/g, ' ');
    note(name, 'endorse: ' + (msg.match(/(proposal not found|not found|already exists|MVCC|PHANTOM|insufficient balance|stream terminated|DEADLINE|exceeding concurrency limit)/i) || [msg.slice(0, 80)])[0]);
    return false;
  }
}
const campArgs = (c, s) => [c, s, 'Technology', '2027-12-31', 'INR', 'false', 'false', '2024-01-01', 'MVP', 'FinTech', '["ai"]', 'true', 'false', '90', '1', '1', '2027', '50000000', '1Cr-5Cr', `P ${c}`, 'd', '[]'];

async function iteration(i) {
  const st = `STARTUP_${R}_${i}`, camp = `CAMP_${R}_${i}`;
  if (!await step('createStartup', 'StartupOrg', 'StartupContract:CreateStartup', [st, `STU_${i}`, 'S', 'x', `S-${i}`])) return;
  if (!await step('createCampaign', 'StartupOrg', 'StartupContract:CreateCampaign', campArgs(camp, st))) return;
  if (MODE === 'respond') {
    const prop = `PROP_${R}_${i}`;
    const ms = '[{"milestoneId":"M1","title":"Beta","amount":10000000},{"milestoneId":"M2","title":"Launch","amount":10000000}]';
    if (!await step('createInvestmentProposal', 'InvestorOrg', 'InvestorContract:CreateInvestmentProposal', [prop, camp, 'INVESTOR001', st, '20000000', 'USD', '10', '3 years', ms, 'terms'])) return;
    await step('respondToInvestmentProposal', 'StartupOrg', 'StartupContract:RespondToInvestmentProposal', [prop, 'ACCEPT', '0', 'Accepted', '[]']);
  } else {
    const inv = `INVESTOR_${R}_${i}`;
    if (!await step('registerInvestor', 'InvestorOrg', 'InvestorContract:RegisterInvestor', [inv, `Inv ${i}`, '25000000', String(300000000000 + i), `DSP${String(i).padStart(5, '0')}Z`])) return;
    await step('createTokenAccount(investor)', 'PlatformOrg', 'TokenContract:CreateTokenAccount', [inv, inv, 'INVESTOR', '{}']);
    await step('createTokenAccount(startup)', 'PlatformOrg', 'TokenContract:CreateTokenAccount', [st, st, 'STARTUP', '{}']);
    if (!await step('transferTokens(PLATFORM->investor)', 'PlatformOrg', 'TokenContract:TransferTokens', [`TRX_${R}_${i}`, 'CFT', 'PLATFORM', inv, '5000', 'INR', 'DISPUTE_FUNDING', ''])) return;
    await step('createDispute', 'PlatformOrg', 'PlatformContract:CreateDispute', [`DISPUTE_${R}_${i}`, 'INVESTOR', inv, 'STARTUP', st, 'MILESTONE_DISPUTE', camp, `AGREE_${R}_${i}`, 'Caliper dispute', 'Load-test dispute filing', '1000']);
  }
}

(async () => {
  const t0 = Date.now(), all = [];
  for (let i = 0; i < N; i++) {
    const w = t0 + i * 1000 / RATE - Date.now(); if (w > 1) await sleep(w);
    all.push(iteration(i));
  }
  await Promise.all(all);
  const out = { mode: MODE, iterations: N, iterationsPerSecond: RATE, steps: stats };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
  Object.values(gws).forEach((x) => x.g.close());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
