'use strict';
/*
 * Re-run of the adversarial suite (same attack IDs as attacks.js) against the HARDENED chaincodes:
 *   CF_SingleChannel/crowdfundingv2_hardened, CF_DualChannel/crowdfunding_dualchannel_v3
 * plus POSITIVE CONTROLS (POS-*): the honest end-to-end workflow must still succeed, otherwise a
 * "MITIGATED" result could simply mean the feature is broken.
 *
 *   node hardened.js <single|dual|malicious> <out.json>
 *
 * Identities: User1 = attacker, User2 = legitimate user of the same organisation (intra-org tests).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');

const CRYPTO = '/crypto';
const suite = process.argv[2];
const OUT = process.argv[3];
const RID = Date.now().toString(36);
const dom = (o) => `${o.toLowerCase()}.example.com`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gws = {};

function identity(org, user) {
  const msp = path.join(CRYPTO, 'peerOrganizations', dom(org), 'users', `${user}@${dom(org)}`, 'msp');
  return { mspId: `${org}MSP`, cert: fs.readFileSync(path.join(msp, 'signcerts', fs.readdirSync(path.join(msp, 'signcerts'))[0])),
    key: crypto.createPrivateKey(fs.readFileSync(path.join(msp, 'keystore', fs.readdirSync(path.join(msp, 'keystore'))[0]))) };
}
function forgedIdentity() {
  const d = path.join(__dirname, 'forged');
  return { mspId: 'InvestorOrgMSP', cert: fs.readFileSync(path.join(d, 'c.pem')), key: crypto.createPrivateKey(fs.readFileSync(path.join(d, 'k.pem'))) };
}
function gateway(org, user = 'User1', forged = false) {
  const k = `${org}:${user}:${forged}`;
  if (gws[k]) return gws[k];
  const host = `peer0.${dom(org)}`;
  const client = new grpc.Client(`${host}:7051`, grpc.credentials.createSsl(fs.readFileSync(path.join(CRYPTO, 'peerOrganizations', dom(org), 'peers', host, 'tls', 'ca.crt'))));
  const id = forged ? forgedIdentity() : identity(org, user);
  gws[k] = connect({ client, identity: { mspId: id.mspId, credentials: id.cert }, signer: signers.newPrivateKeySigner(id.key), hash: hash.sha256 });
  return gws[k];
}
function errText(e) {
  return [e.message || String(e)].concat((e.details || []).map((d) => `${d.mspId || ''}: ${d.message}`)).join(' | ').replace(/\s+/g, ' ').slice(0, 400);
}
// as = { org, user, forged, endorsers, transient }
async function submit(as, ch, cc, fn, args) {
  const c = gateway(as.org, as.user, as.forged).getNetwork(ch).getContract(cc);
  try {
    // Fabric guidance: with transient (confidential) data, endorse only by collection members -> the caller's own org
    const endorsers = as.endorsers || (as.transient ? [`${as.org}MSP`] : undefined);
    const p = c.newProposal(fn, { arguments: args.map(String), endorsingOrganizations: endorsers, transientData: as.transient });
    const tx = await p.endorse();
    const st = await (await tx.submit()).getStatus();
    return { committed: st.successful, code: st.code, txId: tx.getTransactionId(), bytes: tx.getBytes() };
  } catch (e) { return { committed: false, error: errText(e) }; }
}
async function evaluate(as, ch, cc, fn, args) {
  try { return { ok: true, result: Buffer.from(await gateway(as.org, as.user).getNetwork(ch).getContract(cc).evaluateTransaction(fn, ...args.map(String))).toString() }; } catch (e) { return { ok: false, error: errText(e) }; }
}
const ev = (r) => (r.committed ? `committed VALID tx ${r.txId.slice(0, 12)}` : (r.error || `invalidated: code ${r.code}`));
const why = (r) => { const m = (r.error || '').match(/(access denied[^|]*|KYC[^|]*|not published[^|]*|not registered[^|]*|insufficient[^|]*|non-zero opening[^|]*|disabled[^|]*|already exists[^|]*|tx creator does not have[^|]*|creator org[^|]*|cannot verify[^|]*|confidential investment data[^|]*)/i); return m ? m[1].trim().slice(0, 160) : ev(r); };

const results = [];
function record(id, category, claim, attacker, action, vulnerable, evidence) {
  const r = { id, category, claim, attacker, action, outcome: vulnerable ? 'VULNERABLE' : 'MITIGATED', evidence };
  results.push(r); console.log(`[${r.outcome}] ${id} ${claim} -- ${String(typeof evidence === 'string' ? evidence : JSON.stringify(evidence)).slice(0, 170)}`);
}
function positive(id, claim, ok, evidence) {
  const r = { id, category: 'Positive control (honest path)', claim, attacker: '-', action: claim, outcome: ok ? 'PASS' : 'FAIL', evidence };
  results.push(r); console.log(`[${r.outcome}] ${id} ${claim} -- ${String(evidence).slice(0, 170)}`);
}
const P = (user = 'User1') => ({ org: 'PlatformOrg', user });
const S = (user = 'User1') => ({ org: 'StartupOrg', user });
const I = (user = 'User1') => ({ org: 'InvestorOrg', user });
const V = (user = 'User1') => ({ org: 'ValidatorOrg', user });
const priv = (o) => ({ private: Buffer.from(JSON.stringify(o)) });
const kyc = (income, aadhaar, pan) => ({ kyc: Buffer.from(JSON.stringify({ annualIncome: income, aadharNumber: aadhaar, panNumber: pan })) });

function campaignArgs(campId, stId) {
  return [campId, stId, 'Technology', '2027-12-31', 'INR', 'false', 'false', '2024-01-01', 'MVP', 'FinTech', '["ai"]',
    'true', 'false', '90', '1', '1', '2027', '50000000', '1Cr-5Cr', `Project ${campId}`, 'benchmark campaign', '[]'];
}
function findHash(obj) {
  if (!obj || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (/validationProofHash/i.test(k) && typeof v === 'string' && v) return v;
    const h = findHash(v); if (h) return h;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
async function run(cfg) {
  const { L, GCH, GCC, ICH, ICC, TCH, TCC } = cfg;
  const tok = 'PAYMENT_TOKEN';
  const st = `ST_${RID}`, camp = `CAMP_${RID}`, val = `VAL_${RID}`;
  const investor = `INV_honest_${RID}`; // registered by InvestorOrg User2

  // ===================== positive controls: honest end-to-end workflow =====================
  let r = await submit(S('User1'), GCH, GCC, 'StartupContract:CreateStartup', [st, 'founder', 'Honest Startup', 'x', 'D1']);
  positive(`${L}-POS1`, 'Startup creates startup + campaign and submits for validation', r.committed, ev(r));
  r = await submit(S('User1'), GCH, GCC, 'StartupContract:CreateCampaign', campaignArgs(camp, st));
  const r2 = await submit(S('User1'), GCH, GCC, 'StartupContract:SubmitForValidation', [camp, '[]', 'please review']);
  if (!r.committed || !r2.committed) positive(`${L}-POS1b`, 'CreateCampaign / SubmitForValidation', false, `${ev(r)} / ${ev(r2)}`);
  r = await submit(V('User1'), GCH, GCC, 'ValidatorContract:ValidateCampaign', [val, camp, 'VALIDATOR1', 'subhash', '[]']);
  const ap = await submit(V('User1'), GCH, GCC, 'ValidatorContract:ApproveOrRejectCampaign', [val, camp, 'APPROVED', 8.5, 3.2, 'LOW', '["ok"]', '[]', '']);
  let svp = { committed: true, txId: 'n/a-single' };
  if (GCH !== ICH) svp = await submit(V('User1'), GCH, GCC, 'ValidatorContract:ShareValidationToPlatform', [val, camp]); // dual-channel workflow step
  positive(`${L}-POS2`, 'Validator validates and approves the campaign', r.committed && ap.committed && svp.committed, `${ev(r)} / ${ev(ap)}${GCH !== ICH ? ' / share-to-platform ' + ev(svp) : ''}`);
  const gc = await evaluate(S('User1'), GCH, GCC, 'StartupContract:GetCampaign', [camp]);
  let vhash = null; try { vhash = findHash(JSON.parse(gc.result)); } catch { /* */ }
  const sh = await submit(S('User1'), GCH, GCC, 'StartupContract:ShareCampaignToPlatform', [camp, vhash || 'missing']);
  const pb = await submit(P('User1'), GCH, GCC, 'PlatformContract:PublishCampaignToPortal', [camp, vhash || 'missing']);
  positive(`${L}-POS3`, 'Startup shares and Platform publishes the approved campaign', sh.committed && pb.committed, `hash=${vhash ? vhash.slice(0, 12) : gc.error}; share: ${ev(sh)}; publish: ${ev(pb)}`);
  if (GCH !== ICH) { // dual: wait for the bridge to deliver the public campaign record to the investment channel
    let seen = false; const t0 = Date.now();
    for (let i = 0; i < 60 && !seen; i++) { const x = await evaluate(I('User2'), ICH, ICC, 'DataBridgeContract:ReadData', ['AllOrgsShared', `CAMPAIGN_PUBLIC_${camp}`]); seen = x.ok; if (!seen) await sleep(1000); }
    positive(`${L}-POS3b`, 'Published campaign is bridged to the investment channel (v3 relay)', seen, `visible to InvestorOrg after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  r = await submit({ ...I('User2'), transient: kyc(45000000, `5555-${RID.slice(-4)}-1111`, 'HONST1234H') }, ICH, ICC, 'InvestorContract:RegisterInvestor', [investor, 'Asha', 0, '', '']);
  positive(`${L}-POS4`, 'Investor registers with KYC in the transient map', r.committed, ev(r));
  const regTx = r.txId;
  const AMTU = 25000000 + parseInt(RID.slice(-3), 36); // unique amount, searched for in blocks
  r = await submit({ ...I('User2'), transient: priv({ campaignId: camp, investorId: investor, amount: AMTU, currency: 'INR' }) }, ICH, ICC, 'InvestorContract:MakeInvestment', [`INVT_${RID}_ok`, '', '', 0, '']);
  positive(`${L}-POS5`, 'Investor invests in the published campaign (amount/campaign/investor via transient map)', r.committed, ev(r));
  const investTx = r.txId, AMT = AMTU;
  // proposal with confidential terms
  const terms = `TERMS_${RID}`, prop = `PROP_${RID}`;
  const pr = await submit({ ...I('User2'), transient: priv({ campaignId: camp, investorId: investor, startupId: st, investmentAmount: 30000000 + parseInt(RID.slice(-3), 36), currency: 'INR', equity: '10%', duration: '24m', milestones: '[]', proposedTerms: terms }) },
    ICH, ICC, 'InvestorContract:CreateInvestmentProposal', [prop, '', '', '', 0, '', '', '', '', '']);
  positive(`${L}-POS5b`, 'Investor creates a proposal with confidential terms (transient map)', pr.committed, ev(pr));
  // startup acknowledges the investment (signature differs between single and dual)
  const ack = GCH !== ICH
    ? await submit({ ...S(), transient: priv({ campaignId: camp, startupId: st, investorId: investor, message: 'thanks' }) }, ICH, ICC, 'StartupContract:AcknowledgeInvestment', [`ACK_${RID}`, `INVT_${RID}_ok`, '', '', '', ''])
    : await submit({ ...S(), transient: priv({ campaignId: camp, investorId: investor, amount: AMT }) }, ICH, ICC, 'StartupContract:AcknowledgeInvestment', [`INVT_${RID}_ok`, '', '', 0]);
  positive(`${L}-POS5c`, 'Startup acknowledges the investment (transient map)', ack.committed, ev(ack));
  // who can read the investment record? (StartupInvestorShared: Startup + Investor only)
  const readInv = (as) => (GCH !== ICH
    ? evaluate(as, ICH, ICC, 'DataBridgeContract:ReadData', ['StartupInvestorShared', `INVESTMENT_INVT_${RID}_ok`])
    : evaluate(as, ICH, ICC, 'StartupContract:GetSharedInvestment', [`INVT_${RID}_ok`]));
  const rs = await readInv(S()); positive(`${L}-POS5d`, 'StartupOrg can read the investment record', rs.ok, rs.ok ? rs.result.slice(0, 90) : rs.error);
  for (const org of ['ValidatorOrg', 'PlatformOrg']) {
    const x = await readInv({ org, user: 'User1' });
    record(`${L}-P4c-${org.replace('Org', '')}`, 'Privacy leakage', 'Investment records readable only by StartupOrg and InvestorOrg', `${org} client`, 'read INVESTMENT_ record in StartupInvestorShared', x.ok, x.ok ? x.result.slice(0, 120) : why({ error: x.error }));
  }
  // are amount / terms visible in the blocks every channel member receives?
  for (const [label, txid, needle] of [['investment', investTx, String(AMT)], ['proposal', pr.txId, terms]]) {
    if (!txid) continue;
    const blk = await gateway('ValidatorOrg').getNetwork(ICH).getContract('qscc').evaluateTransaction('GetBlockByTxID', ICH, txid).then((b) => Buffer.from(b)).catch((e) => ({ err: errText(e) }));
    const leak = Buffer.isBuffer(blk) && blk.includes(Buffer.from(needle));
    record(`${L}-P4-${label}`, 'Privacy leakage', `${label === 'investment' ? 'Investment amount' : 'Proposal terms'} not recorded in shared blocks`, 'ValidatorOrg client (channel member, not a collection member)',
      `qscc GetBlockByTxID on the ${label} tx, search for "${needle}"`, leak, Buffer.isBuffer(blk) ? (leak ? 'found in block' : `block fetched (${blk.length} bytes); value NOT present`) : blk.err);
  }
  const pl = await submit(I('User2'), ICH, ICC, 'InvestorContract:MakeInvestment', [`INVT_${RID}_plain`, camp, investor, 25000000, 'INR']);
  record(`${L}-P4b`, 'Privacy leakage', 'Investment data cannot be submitted as plaintext arguments', 'careless client', 'MakeInvestment with amount/campaign/investor in args', pl.committed, why(pl));
  // token honest path
  await submit(P(), TCH, TCC, 'TokenContract:InitializeToken', [tok, 'Payment Token', 2, 1000000, 0]);
  const invAcct = `INV_acct_${RID}`, stAcct = `STARTUP_acct_${RID}`;
  const c1 = await submit(I('User2'), TCH, TCC, 'TokenContract:CreateTokenAccount', [invAcct, investor, 'INVESTOR', '{}']);
  const c2 = await submit(S('User1'), TCH, TCC, 'TokenContract:CreateTokenAccount', [stAcct, st, 'STARTUP', '{}']);
  const m = await submit(P(), TCH, TCC, 'TokenContract:MintTokens', [tok, invAcct, 5000]);
  const t = await submit(I('User2'), TCH, TCC, 'TokenContract:TransferTokens', [`TX_${RID}_ok`, tok, invAcct, stAcct, 1000, 'INR', 'investment', camp]);
  const bal = await evaluate(P(), TCH, TCC, 'TokenContract:GetTokenAccount', [stAcct]);
  positive(`${L}-POS6`, 'Token flow: own accounts, Platform mint (2-of-4 endorsed), owner transfer', c1.committed && c2.committed && m.committed && t.committed,
    `create ${ev(c1)} / ${ev(c2)}; mint ${ev(m)}; transfer ${ev(t)}; startup balance ${bal.ok ? JSON.parse(bal.result).balances[tok] : bal.error}`);

  // ===================== attacks (same IDs as attacks.js) =====================
  const atk = `INV_attacker_${RID}`;
  await submit(I('User1'), TCH, TCC, 'TokenContract:CreateTokenAccount', [atk, 'attacker', 'INVESTOR', '{}']);
  r = await submit(I('User1'), TCH, TCC, 'TokenContract:MintTokens', [tok, atk, 1e9]);
  record(`${L}-A1`, 'Unauthorised funding', 'Only PlatformOrg can mint tokens', 'InvestorOrg client', 'MintTokens(1e9) to own account', r.committed, why(r));
  r = await submit(S(), TCH, TCC, 'TokenContract:CreateTokenAccount', [`STARTUP_rich_${RID}`, 'attacker', 'STARTUP', JSON.stringify({ [tok]: 5e8 })]);
  record(`${L}-A2`, 'Unauthorised funding', 'Balances can only originate from Platform mint/transfer', 'StartupOrg client', 'CreateTokenAccount with initialBalance 5e8', r.committed, why(r));
  r = await submit(S(), TCH, TCC, 'TokenContract:TransferTokens', [`TX_${RID}_a3`, tok, 'PLATFORM', stAcct, 1000, 'INR', 'theft', '']);
  record(`${L}-A3`, 'Unauthorised funding', 'Only PlatformOrg can move PLATFORM treasury funds', 'StartupOrg client', 'TransferTokens(from=PLATFORM)', r.committed, why(r));
  r = await submit(I('User1'), TCH, TCC, 'TokenContract:TransferTokens', [`TX_${RID}_a4`, tok, invAcct, atk, 1000, 'INR', 'theft', '']);
  record(`${L}-A4`, 'Unauthorised funding', 'Investors can only spend their own balance', 'InvestorOrg User1 (account owned by User2)', 'TransferTokens(from=victim account)', r.committed, why(r));
  r = await submit({ ...I('User2'), transient: priv({ campaignId: 'CAMP_DOES_NOT_EXIST', investorId: investor, amount: 25000000, currency: 'INR' }) }, ICH, ICC, 'InvestorContract:MakeInvestment', [`INVT_${RID}_ghost`, '', '', 0, '']);
  record(`${L}-A5`, 'Unauthorised funding', 'Investments only into existing, approved campaigns', 'InvestorOrg client', 'MakeInvestment(campaign=CAMP_DOES_NOT_EXIST)', r.committed, why(r));
  r = await submit({ ...S(), transient: priv({ campaignId: camp, investorId: investor, amount: 25000000, currency: 'INR' }) }, ICH, ICC, 'InvestorContract:MakeInvestment', [`INVT_${RID}_forged`, '', '', 0, '']);
  record(`${L}-A6`, 'Unauthorised funding', 'Only investors can commit investments', 'StartupOrg client', 'MakeInvestment on behalf of an investor', r.committed, why(r));
  r = await submit({ ...I('User1'), transient: priv({ campaignId: camp, investorId: investor, amount: 25000000, currency: 'INR' }) }, ICH, ICC, 'InvestorContract:MakeInvestment', [`INVT_${RID}_imp`, '', '', 0, '']);
  record(`${L}-A6b`, 'Unauthorised funding', 'An investor cannot invest in the name of another investor', 'InvestorOrg User1 (investor registered by User2)', 'MakeInvestment as INV_honest', r.committed, why(r));
  // own campaign for self-approval attempt
  const camp2 = `CAMP2_${RID}`, val2 = `VAL2_${RID}`;
  await submit(S(), GCH, GCC, 'StartupContract:CreateCampaign', campaignArgs(camp2, st));
  await submit(S(), GCH, GCC, 'StartupContract:SubmitForValidation', [camp2, '[]', 'x']);
  r = await submit(S(), GCH, GCC, 'ValidatorContract:ValidateCampaign', [val2, camp2, 'VALIDATOR_fake', 'h', '[]']);
  record(`${L}-A7`, 'Unauthorised approval', 'Only ValidatorOrg can open a validation', 'StartupOrg client', 'ValidateCampaign on own campaign', r.committed, why(r));
  r = await submit(S(), GCH, GCC, 'ValidatorContract:ApproveOrRejectCampaign', [val, camp, 'APPROVED', 99, 1, 'LOW', '[]', '[]', '']);
  record(`${L}-A8`, 'Unauthorised approval', 'Only ValidatorOrg can approve a campaign', 'StartupOrg client', 'ApproveOrRejectCampaign(APPROVED)', r.committed, why(r));
  r = await submit({ ...I('User1'), transient: kyc(30000000, '1111-2222-3333', 'ZZZZZ9999Z') }, ICH, ICC, 'InvestorContract:RegisterInvestor', [investor, 'Mallory', 0, '', '']);
  record(`${L}-A9`, 'Duplicate registration', 'An investor ID can be registered once', 'InvestorOrg User1', 'RegisterInvestor with an existing ID', r.committed, why(r));
  const raceId = `INV_race_${RID}`;
  const race = await Promise.all(Array.from({ length: 20 }, (_, i) => submit({ ...I('User1'), transient: kyc(30000000, `0000-0000-00${String(i).padStart(2, '0')}`, 'RACER0000R') }, ICH, ICC, 'InvestorContract:RegisterInvestor', [raceId, `racer${i}`, 0, '', ''])));
  const won = race.filter((x) => x.committed).length;
  const codes = {}; race.forEach((x) => { const k = x.committed ? 'VALID' : (x.code != null ? `code_${x.code}` : 'rejected'); codes[k] = (codes[k] || 0) + 1; });
  record(`${L}-A10`, 'Duplicate registration', 'Concurrent duplicate registrations: exactly one wins', 'InvestorOrg client', '20 parallel RegisterInvestor (same ID)', won !== 1, { committed: won, outcomes: codes });
  const invt = `INVT_race_${RID}`;
  const race2 = await Promise.all(Array.from({ length: 20 }, () => submit({ ...I('User2'), transient: priv({ campaignId: camp, investorId: investor, amount: 25000000, currency: 'INR' }) }, ICH, ICC, 'InvestorContract:MakeInvestment', [invt, '', '', 0, ''])));
  const won2 = race2.filter((x) => x.committed).length;
  record(`${L}-A11`, 'Duplicate registration', 'Concurrent duplicate investment IDs: exactly one wins', 'InvestorOrg client', '20 parallel MakeInvestment (same ID, published campaign)', won2 !== 1, { committed: won2 });
  // A12 replay
  const rp = await submit(P(), TCH, TCC, 'TokenContract:MintTokens', [tok, invAcct, 100]);
  let rerr = 'accepted by orderer, commit-status lookup returns original tx';
  try { await (await gateway('PlatformOrg').newTransaction(rp.bytes).submit()).getStatus(); } catch (e) { rerr = errText(e); }
  const b2 = await evaluate(P(), TCH, TCC, 'TokenContract:GetTokenAccount', [invAcct]);
  const balAfter = b2.ok ? JSON.parse(b2.result).balances[tok] : null;
  record(`${L}-A12`, 'Replay', 'A signed transaction cannot be replayed', 'Network attacker', 'Re-submit identical signed mint envelope (4100 -> 4200 if replayed)', balAfter !== 4100, `balance after replay = ${balAfter}; ${rerr.slice(0, 100)}`);
  r = await submit({ org: 'InvestorOrg', user: 'User1', forged: true }, TCH, TCC, 'TokenContract:MintTokens', [tok, atk, 1e6]);
  record(`${L}-A13`, 'Identity spoofing', 'Only CA-issued identities can transact', 'Outsider, self-signed cert', 'MintTokens with forged certificate', r.committed, why(r));
  r = await submit(P(), TCH, TCC, 'TokenContract:MintTokens', [tok, `INV_new_${RID}`, 1]);
  record(`${L}-A15`, 'Denial of service', 'No client input can crash the chaincode', 'Any client', 'MintTokens to a not-yet-existing account', /stream terminated|could not launch/i.test(r.error || ''), r.committed ? 'committed VALID (account created in memory, no crash)' : why(r));
  // privacy
  const regBlock = await gateway('StartupOrg').getNetwork(ICH).getContract('qscc').evaluateTransaction('GetBlockByTxID', ICH, regTx).then((b) => Buffer.from(b)).catch((e) => ({ err: errText(e) }));
  const leaked = Buffer.isBuffer(regBlock) && (regBlock.includes(Buffer.from(`5555-${RID.slice(-4)}-1111`)) || regBlock.includes(Buffer.from('45000000')));
  record(`${L}-P1`, 'Privacy leakage', 'Aadhaar & income not recorded in shared blocks', 'StartupOrg client', 'qscc GetBlockByTxID on the registration tx, search for Aadhaar/income', leaked,
    Buffer.isBuffer(regBlock) ? (leaked ? 'found in block' : `block fetched (${regBlock.length} bytes); Aadhaar and income NOT present`) : regBlock.err);
  r = await submit(I('User2'), ICH, ICC, 'InvestorContract:RegisterInvestor', [`INV_plain_${RID}`, 'Plain', 45000000, '9999-8888-7777', 'PLAIN1234P']);
  record(`${L}-P1b`, 'Privacy leakage', 'KYC cannot be submitted as plaintext arguments', 'careless client', 'RegisterInvestor with KYC in args', r.committed, why(r));
  return { investor, camp };
}

async function singleSuite() {
  const CH = 'crowdfunding-channel';
  await run({ L: 'HS', GCH: CH, GCC: 'crowdfunding', ICH: CH, ICC: 'crowdfunding', TCH: CH, TCC: 'cftoken' });
  const p2 = await evaluate(S(), CH, 'crowdfunding', 'InvestorContract:GetMyInvestments', []);
  record('HS-P2', 'Privacy leakage', 'Non-members cannot read InvestorPrivateData', 'StartupOrg client', 'GetMyInvestments via StartupOrg peer', p2.ok && p2.result.includes('INVT_'), p2.ok ? p2.result.slice(0, 120) : why({ error: p2.error }));
  const t = await submit(P(), CH, 'crowdfunding', 'TokenContract:MintTokens', ['PAYMENT_TOKEN', 'X', 1]);
  record('HS-N1', 'Unauthorised funding', 'Token ledger only reachable through the 2-of-4 cftoken chaincode', 'PlatformOrg client', 'TokenContract:MintTokens on the OR-policy chaincode', t.committed, why(t));
}

async function dualSuite() {
  const G = 'governance-validation-channel', IC = 'investment-execution-channel';
  const { investor } = await run({ L: 'HD', GCH: G, GCC: 'governance', ICH: IC, ICC: 'investment', TCH: IC, TCC: 'cftoken' });
  // D-A14 write backdoor
  const r = await submit(S(), IC, 'investment', 'DataBridgeContract:StoreData', ['InvestorPrivateData', `INVESTOR_PRIV_${investor}`, '{"aadharNumber":"OVERWRITTEN"}']);
  record('HD-A14', 'Unauthorised write', 'Only the owning org can modify its records', 'StartupOrg client', 'DataBridgeContract:StoreData overwrite', r.committed, why(r));
  // D-P3 "private" data read by another org
  const p3 = await evaluate(S(), IC, 'investment', 'DataBridgeContract:ReadData', ['InvestorPrivateData', `INVESTOR_PRIV_${investor}`]);
  record('HD-P3', 'Privacy leakage', 'Aadhaar & income visible only to InvestorOrg', 'StartupOrg client', 'ReadData(InvestorPrivateData, INVESTOR_PRIV_<id>)', p3.ok && p3.result.includes('aadhar'), p3.ok ? p3.result.slice(0, 160) : why({ error: p3.error }));
  const own = await evaluate(I('User2'), IC, 'investment', 'DataBridgeContract:ReadData', ['InvestorPrivateData', `INVESTOR_PRIV_${investor}`]);
  positive('HD-POS7', 'InvestorOrg can still read its own private KYC record (real PDC)', own.ok && own.result.includes('aadhar'), own.ok ? 'readable by owner org' : own.error);
  // D-C1 cross-channel write persisted (bridge)
  const rec = `REC_${RID}`;
  const c1 = await submit(P(), G, 'governance', 'PlatformContract:RecordValidatorDecision', [rec, 'CAMP_X', 'VAL_X', 'hash', 'true', 90, 'rh']);
  let seen = false; const t0 = Date.now();
  for (let i = 0; i < 40 && !seen && c1.committed; i++) { seen = (await evaluate(P(), IC, 'investment', 'DataBridgeContract:ReadData', ['PlatformPrivateData', `VALIDATOR_DECISION_${rec}`])).ok; if (!seen) await sleep(1000); }
  record('HD-C1', 'Cross-channel consistency', 'Governance -> investment writes are persisted', 'n/a (functional)', 'RecordValidatorDecision, then read on investment channel',
    c1.committed && !seen, `governance: ${ev(c1)}; on investment channel after ${((Date.now() - t0) / 1000).toFixed(1)} s: ${seen ? 'PRESENT' : 'ABSENT'}`);
}

// compromised StartupOrg peer runs a cftoken build without balance / ownership checks
async function maliciousSuite() {
  const CH = 'crowdfunding-channel', tok = 'PAYMENT_TOKEN';
  await submit(P(), CH, 'cftoken', 'TokenContract:InitializeToken', [tok, 'Payment Token', 2, 1000000, 0]);
  const acct = `STARTUP_broke_${RID}`, sink = `STARTUP_sink_${RID}`;
  await submit(S(), CH, 'cftoken', 'TokenContract:CreateTokenAccount', [acct, 'x', 'STARTUP', '{}']);
  await submit(S(), CH, 'cftoken', 'TokenContract:CreateTokenAccount', [sink, 'x', 'STARTUP', '{}']);
  const only = await submit({ ...S(), endorsers: ['StartupOrgMSP'] }, CH, 'cftoken', 'TokenContract:TransferTokens', [`TX_${RID}_m1`, tok, acct, sink, 1e9, 'INR', 'overdraft', '']);
  const both = await submit({ ...S(), endorsers: ['StartupOrgMSP', 'PlatformOrgMSP'] }, CH, 'cftoken', 'TokenContract:TransferTokens', [`TX_${RID}_m2`, tok, acct, sink, 1e9, 'INR', 'overdraft', '']);
  const bal = await evaluate(P(), CH, 'cftoken', 'TokenContract:GetTokenAccount', [sink]);
  record('HM-1', 'Malicious endorser', 'A single compromised org cannot forge ledger state', 'StartupOrg peer running tampered cftoken', 'Overdraft 1e9 endorsed only by StartupOrg', only.committed, `${ev(only)}; sink balance ${bal.ok ? JSON.stringify(JSON.parse(bal.result).balances) : bal.error}`);
  record('HM-2', 'Malicious endorser', 'Honest co-endorser blocks forged state', 'same', 'Same transfer endorsed by StartupOrg + honest PlatformOrg', both.committed, why(both));
}

(async () => {
  if (suite === 'single') await singleSuite();
  else if (suite === 'dual') await dualSuite();
  else if (suite === 'malicious') await maliciousSuite();
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  Object.values(gws).forEach((g) => g.close());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
