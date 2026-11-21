'use strict';
/*
 * Adversarial test suite for BlockAssist+ (reviewer comment 4).
 * Each attack is executed against the LIVE Fabric network with real org identities.
 * An attack is "MITIGATED" when the network rejects it, "VULNERABLE" when it is committed / data is disclosed.
 *
 *   node attacks.js <single|dual|malicious-or|malicious-k2> <out.json>
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
const gws = {};

function identity(org, user = 'User1') {
  const msp = path.join(CRYPTO, 'peerOrganizations', dom(org), 'users', `${user}@${dom(org)}`, 'msp');
  const cert = fs.readFileSync(path.join(msp, 'signcerts', fs.readdirSync(path.join(msp, 'signcerts'))[0]));
  const key = crypto.createPrivateKey(fs.readFileSync(path.join(msp, 'keystore', fs.readdirSync(path.join(msp, 'keystore'))[0])));
  return { mspId: `${org}MSP`, cert, key };
}

function gateway(org, { forged } = {}) {
  const k = org + (forged ? ':forged' : '');
  if (gws[k]) return gws[k];
  const host = `peer0.${dom(org)}`;
  const tls = fs.readFileSync(path.join(CRYPTO, 'peerOrganizations', dom(org), 'peers', host, 'tls', 'ca.crt'));
  const client = new grpc.Client(`${host}:7051`, grpc.credentials.createSsl(tls));
  const id = forged || identity(org);
  const gw = connect({ client, identity: { mspId: id.mspId, credentials: id.cert }, signer: signers.newPrivateKeySigner(id.key), hash: hash.sha256 });
  gws[k] = gw;
  return gw;
}

function errText(e) {
  return [e.message || String(e)].concat((e.details || []).map((d) => `${d.mspId || ''}@${d.address || ''}: ${d.message}`)).join(' | ').replace(/\s+/g, ' ').slice(0, 400);
}

async function submit(org, ch, cc, fn, args, opts = {}) {
  const c = gateway(org, opts).getNetwork(ch).getContract(cc);
  try {
    const p = c.newProposal(fn, { arguments: args.map(String), endorsingOrganizations: opts.endorsers });
    const tx = await p.endorse();
    const commit = await tx.submit();
    const st = await commit.getStatus();
    return { committed: st.successful, code: st.code, txId: tx.getTransactionId(), bytes: tx.getBytes(), result: Buffer.from(tx.getResult()).toString() };
  } catch (e) { return { committed: false, error: errText(e) }; }
}

async function evaluate(org, ch, cc, fn, args, opts = {}) {
  const c = gateway(org, opts).getNetwork(ch).getContract(cc);
  try { return { ok: true, result: Buffer.from(await c.evaluateTransaction(fn, ...args.map(String))).toString() }; } catch (e) { return { ok: false, error: errText(e) }; }
}

const results = [];
function record(id, category, claim, attacker, action, vulnerable, evidence) {
  const r = { id, category, claim, attacker, action, outcome: vulnerable ? 'VULNERABLE' : 'MITIGATED', evidence };
  results.push(r);
  console.log(`[${r.outcome}] ${id} ${claim} -- ${typeof evidence === 'string' ? evidence.slice(0, 160) : JSON.stringify(evidence).slice(0, 160)}`);
}
const ev = (r) => (r.committed ? `committed VALID tx ${r.txId.slice(0, 12)}` : (r.error || `invalidated: code ${r.code}`));

function campaignArgs(campId, stId) {
  return [campId, stId, 'Technology', '2027-12-31', 'INR', 'false', 'false', '2024-01-01', 'MVP', 'FinTech', '["ai"]',
    'true', 'false', '90', '1', '1', '2027', '50000000', '1Cr-5Cr', `Project ${campId}`, 'benchmark campaign', '[]'];
}

// ------------------------------------------------------------------------------------------- shared attacks
async function common(ch, cc, gch, gcc, label) {
  const tok = 'PAYMENT_TOKEN';
  await submit('PlatformOrg', ch, cc, 'TokenContract:InitializeToken', [tok, 'Payment Token', 2, 1000000, 0]);

  // A1 unauthorised minting by a non-Platform org
  const a1 = await submit('InvestorOrg', ch, cc, 'TokenContract:MintTokens', [tok, `INV_attacker_${RID}`, 1e9]);
  const bal1 = await evaluate('InvestorOrg', ch, cc, 'TokenContract:GetTokenAccount', [`INV_attacker_${RID}`]);
  record(`${label}-A1`, 'Unauthorised funding', 'Only PlatformOrg can mint tokens', 'InvestorOrg client', 'TokenContract:MintTokens(1e9) to own account',
    a1.committed, `${ev(a1)}; balance now ${bal1.ok ? JSON.stringify(JSON.parse(bal1.result).balances || JSON.parse(bal1.result).Balances) : bal1.error}`);

  // A2 self-funded account via initialBalanceJSON
  const a2 = await submit('StartupOrg', ch, cc, 'TokenContract:CreateTokenAccount', [`STARTUP_rich_${RID}`, 'attacker', 'STARTUP', JSON.stringify({ [tok]: 5e8 })]);
  record(`${label}-A2`, 'Unauthorised funding', 'Balances can only originate from Platform mint/transfer', 'StartupOrg client', 'CreateTokenAccount with initialBalance {PAYMENT_TOKEN: 5e8}', a2.committed, ev(a2));

  // A3 spend from the PLATFORM treasury as a non-Platform org
  const a3 = await submit('StartupOrg', ch, cc, 'TokenContract:TransferTokens', [`TX_${RID}_a3`, tok, 'PLATFORM', `STARTUP_thief_${RID}`, 1000, 'INR', 'theft', '']);
  record(`${label}-A3`, 'Unauthorised funding', 'Only PlatformOrg can move PLATFORM treasury funds', 'StartupOrg client', 'TransferTokens(from=PLATFORM, 1000)', a3.committed, ev(a3));

  // A4 intra-org theft: investor A spends investor B's balance (both InvestorOrg members)
  await submit('PlatformOrg', ch, cc, 'TokenContract:MintTokens', [tok, `INV_victim_${RID}`, 5000]);
  const a4 = await submit('InvestorOrg', ch, cc, 'TokenContract:TransferTokens', [`TX_${RID}_a4`, tok, `INV_victim_${RID}`, `INV_attacker_${RID}`, 5000, 'INR', 'theft', '']);
  record(`${label}-A4`, 'Unauthorised funding', 'Investors can only spend their own balance', 'InvestorOrg client (different investor)', 'TransferTokens(from=INV_victim)', a4.committed, ev(a4));

  // A5 investment into a non-existent campaign
  const a5 = await submit('InvestorOrg', ch, cc, 'InvestorContract:MakeInvestment', [`INVT_${RID}_ghost`, 'CAMP_DOES_NOT_EXIST', `INV_x_${RID}`, 25000000, 'INR']);
  record(`${label}-A5`, 'Unauthorised funding', 'Investments only into existing, approved campaigns', 'InvestorOrg client', 'MakeInvestment(campaign=CAMP_DOES_NOT_EXIST)', a5.committed, ev(a5));

  // A6 investment forged by a non-investor org on behalf of an investor
  const a6 = await submit('StartupOrg', ch, cc, 'InvestorContract:MakeInvestment', [`INVT_${RID}_forged`, 'CAMP_ANY', `INV_victim_${RID}`, 25000000, 'INR']);
  record(`${label}-A6`, 'Unauthorised funding', 'Only investors can commit investments', 'StartupOrg client', 'MakeInvestment on behalf of INV_victim', a6.committed, ev(a6));

  // A7/A8 unauthorised approval: startup approves its own campaign
  const st = `ST_${RID}`, camp = `CAMP_${RID}`, val = `VAL_${RID}`;
  await submit('StartupOrg', gch, gcc, 'StartupContract:CreateStartup', [st, 'owner', 'Attack Startup', 'x', 'D1']);
  const cc1 = await submit('StartupOrg', gch, gcc, 'StartupContract:CreateCampaign', campaignArgs(camp, st));
  const sv = await submit('StartupOrg', gch, gcc, 'StartupContract:SubmitForValidation', [camp, '[]', 'please approve']);
  const a7 = await submit('StartupOrg', gch, gcc, 'ValidatorContract:ValidateCampaign', [val, camp, 'VALIDATOR_fake', 'hash', '[]']);
  const a8 = await submit('StartupOrg', gch, gcc, 'ValidatorContract:ApproveOrRejectCampaign', [val, camp, 'APPROVED', 99, 1, 'LOW', '[]', '[]', '']);
  record(`${label}-A7`, 'Unauthorised approval', 'Only ValidatorOrg can open a validation', 'StartupOrg client',
    'ValidatorContract:ValidateCampaign on own campaign', a7.committed, `setup: createCampaign=${cc1.committed} submit=${sv.committed}; ${ev(a7)}`);
  record(`${label}-A8`, 'Unauthorised approval', 'Only ValidatorOrg can approve a campaign', 'StartupOrg client',
    'ValidatorContract:ApproveOrRejectCampaign(APPROVED, score 99)', a8.committed, ev(a8));

  // A9 duplicate registration (sequential)
  const invId = `INV_dup_${RID}`;
  const r1 = await submit('InvestorOrg', ch, cc, 'InvestorContract:RegisterInvestor', [invId, 'Alice', 30000000, '9999-8888-7777', 'ABCDE1234F']);
  const r2 = await submit('InvestorOrg', ch, cc, 'InvestorContract:RegisterInvestor', [invId, 'Mallory', 30000000, '1111-2222-3333', 'ZZZZZ9999Z']);
  record(`${label}-A9`, 'Duplicate registration', 'An investor ID can be registered once', 'InvestorOrg client', 'RegisterInvestor twice, sequentially',
    r2.committed, `first=${ev(r1)}; second=${ev(r2)}`);

  // A10 duplicate registration (concurrent race, 20 parallel submissions of same ID)
  const raceId = `INV_race_${RID}`;
  const race = await Promise.all(Array.from({ length: 20 }, (_, i) => submit('InvestorOrg', ch, cc, 'InvestorContract:RegisterInvestor', [raceId, `racer${i}`, 30000000, `0000-0000-00${String(i).padStart(2, '0')}`, 'RACER0000R'])));
  const won = race.filter((r) => r.committed).length;
  const codes = {}; race.forEach((r) => { const k = r.committed ? 'VALID' : (r.code != null ? `code_${r.code}` : 'rejected'); codes[k] = (codes[k] || 0) + 1; });
  record(`${label}-A10`, 'Duplicate registration', 'Concurrent duplicate registrations: exactly one wins', 'InvestorOrg client', '20 parallel RegisterInvestor with same ID',
    won !== 1, { committed: won, outcomes: codes });

  // A11 duplicate investment race
  const invt = `INVT_race_${RID}`;
  const race2 = await Promise.all(Array.from({ length: 20 }, () => submit('InvestorOrg', ch, cc, 'InvestorContract:MakeInvestment', [invt, camp, invId, 25000000, 'INR'])));
  const won2 = race2.filter((r) => r.committed).length;
  record(`${label}-A11`, 'Duplicate registration', 'Concurrent duplicate investment IDs: exactly one wins', 'InvestorOrg client', '20 parallel MakeInvestment with same ID',
    won2 !== 1, { committed: won2 });

  // A12 replay of an already-committed signed transaction envelope
  const rp = await submit('PlatformOrg', ch, cc, 'TokenContract:MintTokens', [tok, `INV_replay_${RID}`, 100]);
  let replay;
  try {
    const tx = gateway('PlatformOrg').newTransaction(rp.bytes);
    const st2 = await (await tx.submit()).getStatus();
    replay = { committed: st2.successful, code: st2.code };
  } catch (e) { replay = { committed: false, error: errText(e) }; }
  const balR = await evaluate('PlatformOrg', ch, cc, 'TokenContract:GetTokenAccount', [`INV_replay_${RID}`]);
  record(`${label}-A12`, 'Replay', 'A signed transaction cannot be replayed', 'Network attacker with captured envelope', 'Re-submit identical signed envelope',
    replay.committed, `${replay.committed ? 'replayed VALID' : (replay.error || `invalidated code ${replay.code} (25=DUPLICATE_TXID? see Fabric TxValidationCode)`)}; balance ${balR.ok ? balR.result.slice(0, 120) : balR.error}`);

  // A13 forged identity: self-signed certificate claiming InvestorOrgMSP
  const forged = makeForgedIdentity('InvestorOrgMSP');
  const a13 = await submit('InvestorOrg', ch, cc, 'TokenContract:MintTokens', [tok, `INV_forged_${RID}`, 1e6], { forged });
  record(`${label}-A13`, 'Identity spoofing', 'Only CA-issued identities can transact', 'Outsider with self-signed cert claiming InvestorOrgMSP',
    'MintTokens with forged certificate', a13.committed, ev(a13));

  return { invId, camp };
}

function makeForgedIdentity(mspId) {
  // self-signed P-256 cert with the same subject as a real InvestorOrg user (generated by openssl, see run_attacks.sh)
  const d = path.join(__dirname, 'forged');
  return { mspId, cert: fs.readFileSync(path.join(d, 'c.pem')), key: crypto.createPrivateKey(fs.readFileSync(path.join(d, 'k.pem'))) };
}

async function getBlockWithTx(org, ch, txId) {
  const r = await gateway(org).getNetwork(ch).getContract('qscc').evaluateTransaction('GetBlockByTxID', ch, txId).catch((e) => ({ err: errText(e) }));
  return r.err ? { err: r.err } : { bytes: Buffer.from(r) };
}

// ------------------------------------------------------------------------------------------- suites
async function single() {
  const CH = 'crowdfunding-channel', CC = 'crowdfunding';
  await common(CH, CC, CH, CC, 'S');
  // P1 private data passed as plaintext transaction arguments -> stored in every peer's block
  const id = `INV_priv_${RID}`, aadhaar = `4321-${RID.slice(-4)}-8765`;
  const r = await submit('InvestorOrg', CH, CC, 'InvestorContract:RegisterInvestor', [id, 'Priya', 45000000, aadhaar, 'PRIVA1234P']);
  const blk = await getBlockWithTx('StartupOrg', CH, r.txId);
  const leaked = blk.bytes ? blk.bytes.includes(Buffer.from(aadhaar)) && blk.bytes.includes(Buffer.from('45000000')) : false;
  record('S-P1', 'Privacy leakage', 'Aadhaar & income visible only to InvestorOrg (PDC)', 'StartupOrg client (non-member)',
    'qscc GetBlockByTxID and search block bytes for Aadhaar/income', leaked, blk.err || (leaked ? `Aadhaar ${aadhaar} and income found in plaintext in block (tx args)` : 'not found in block'));
  // P2 direct PDC read by non-member (InvestorPrivateData has memberOnlyRead=true)
  await submit('InvestorOrg', CH, CC, 'InvestorContract:MakeInvestment', [`INVT_priv_${RID}`, 'CAMP_P', id, 25000000, 'INR']);
  const p2 = await evaluate('StartupOrg', CH, CC, 'InvestorContract:GetMyInvestments', []);
  const p2leak = p2.ok && p2.result.includes(`INVT_priv_${RID}`);
  record('S-P2', 'Privacy leakage', 'Non-members cannot read InvestorPrivateData', 'StartupOrg client', 'InvestorContract:GetMyInvestments (range read of InvestorPrivateData) via StartupOrg peer', p2leak, p2.ok ? `returned: ${p2.result.slice(0, 160)}` : p2.error);
}

async function dual() {
  const GCH = 'governance-validation-channel', GCC = 'governance', ICH = 'investment-execution-channel', ICC = 'investment';
  await common(ICH, ICC, GCH, GCC, 'D');

  // C1 cross-channel WRITE from governance chaincode into an investment-channel collection
  const w = `WALLET_${RID}`;
  const c1 = await submit('PlatformOrg', GCH, GCC, 'PlatformContract:CreateWallet', [w, 'user1', 'INVESTOR', 1000]);
  const c1r = await evaluate('PlatformOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['PlatformPrivateData', `WALLET_${w}`]);
  const c1r2 = await evaluate('PlatformOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['PlatformPrivateData', w]);
  record('D-C1', 'Cross-channel consistency', 'Governance -> investment writes are persisted (CrossChannelPut)', 'n/a (functional)',
    'governance PlatformContract:CreateWallet then read on investment channel', !(c1r.ok || c1r2.ok) && c1.committed,
    `governance tx: ${ev(c1)}; investment-channel read: ${c1r.ok ? c1r.result.slice(0, 80) : c1r.error} / ${c1r2.ok ? c1r2.result.slice(0, 80) : c1r2.error}`);

  // A14 unauthenticated write backdoor: DataBridgeContract:StoreData is a public transaction
  const victimKey = `INVESTOR_PRIV_INV_dup_${RID}`;
  const a14 = await submit('StartupOrg', ICH, ICC, 'DataBridgeContract:StoreData', ['InvestorPrivateData', victimKey, JSON.stringify({ investorId: 'INV_dup', annualIncome: 0, aadharNumber: 'OVERWRITTEN' })]);
  const a14r = await evaluate('InvestorOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['InvestorPrivateData', victimKey]);
  record('D-A14', 'Unauthorised write', 'Only the owning org can modify its records', 'StartupOrg client',
    'DataBridgeContract:StoreData overwriting an investor\'s private record', a14.committed, `${ev(a14)}; record now: ${a14r.ok ? a14r.result.slice(0, 120) : a14r.error}`);

  // C2 cross-channel READ when the endorsing peer is not a member of the other channel
  const st = `ST_x_${RID}`;
  await submit('StartupOrg', GCH, GCC, 'StartupContract:CreateStartup', [st, 'o', 'X', 'x', 'D']);
  const c2a = await evaluate('StartupOrg', ICH, ICC, 'StartupContract:GetStartup', [st]);
  const c2b = await evaluate('InvestorOrg', ICH, ICC, 'StartupContract:GetStartup', [st]);
  record('D-C2', 'Cross-channel consistency', 'Investment channel can read governance data for every org', 'n/a (functional)',
    'investment StartupContract:GetStartup via StartupOrg peer vs InvestorOrg peer', !(c2a.ok && c2b.ok),
    `via StartupOrg peer: ${c2a.ok ? 'OK' : c2a.error}; via InvestorOrg peer: ${c2b.ok ? 'OK' : c2b.error}`);

  // P3 "private" investor data stored in public world state, readable by any channel member
  const id = `INV_priv_${RID}`, aadhaar = `4321-${RID.slice(-4)}-8765`;
  await submit('InvestorOrg', ICH, ICC, 'InvestorContract:RegisterInvestor', [id, 'Priya', 45000000, aadhaar, 'PRIVA1234P']);
  const p3 = await evaluate('StartupOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['InvestorPrivateData', `INVESTOR_PRIV_${id}`]);
  record('D-P3', 'Privacy leakage', 'Aadhaar & income visible only to InvestorOrg', 'StartupOrg client',
    'DataBridgeContract:ReadData(InvestorPrivateData, INVESTOR_PRIV_<id>)', p3.ok && p3.result.includes(aadhaar), p3.ok ? p3.result.slice(0, 220) : p3.error);
  const r = await submit('InvestorOrg', ICH, ICC, 'InvestorContract:RegisterInvestor', [`${id}b`, 'Priya', 45000000, aadhaar, 'PRIVA1234P']);
  const blk = await getBlockWithTx('StartupOrg', ICH, r.txId);
  const leaked = blk.bytes ? blk.bytes.includes(Buffer.from(aadhaar)) : false;
  record('D-P1', 'Privacy leakage', 'Aadhaar not recorded in shared blocks', 'StartupOrg client', 'qscc GetBlockByTxID, search block', leaked, blk.err || (leaked ? 'Aadhaar found in block (args + public write-set)' : 'not found'));
}

// malicious endorser: StartupOrg's chaincode container runs a build with the balance check removed
async function malicious(policyLabel) {
  const CH = 'crowdfunding-channel', CC = 'crowdfunding', tok = 'PAYMENT_TOKEN';
  await submit('PlatformOrg', CH, CC, 'TokenContract:InitializeToken', [tok, 'Payment Token', 2, 1000000, 0]);
  const acct = `STARTUP_broke_${RID}`;
  await submit('PlatformOrg', CH, CC, 'TokenContract:CreateTokenAccount', [acct, 'x', 'STARTUP', '{}'], { endorsers: ['PlatformOrgMSP', 'InvestorOrgMSP'] });
  const only = await submit('StartupOrg', CH, CC, 'TokenContract:TransferTokens', [`TX_${RID}_m1`, tok, acct, `STARTUP_sink_${RID}`, 1e9, 'INR', 'overdraft', ''], { endorsers: ['StartupOrgMSP'] });
  const both = await submit('StartupOrg', CH, CC, 'TokenContract:TransferTokens', [`TX_${RID}_m2`, tok, acct, `STARTUP_sink2_${RID}`, 1e9, 'INR', 'overdraft', ''], { endorsers: ['StartupOrgMSP', 'PlatformOrgMSP'] });
  const bal = await evaluate('PlatformOrg', CH, CC, 'TokenContract:GetTokenAccount', [`STARTUP_sink_${RID}`]);
  record(`M-${policyLabel}-1`, 'Malicious endorser', 'A single compromised org cannot forge ledger state', 'StartupOrg peer running tampered chaincode (no balance check)',
    `Overdraft transfer of 1e9 from a zero-balance account, endorsed only by StartupOrg [policy ${policyLabel}]`, only.committed,
    `${ev(only)}; recipient balance: ${bal.ok ? bal.result.slice(0, 120) : bal.error}`);
  record(`M-${policyLabel}-2`, 'Malicious endorser', 'Honest co-endorser blocks forged state', 'same',
    `Same transfer endorsed by StartupOrg + honest PlatformOrg [policy ${policyLabel}]`, both.committed, ev(both));
}

(async () => {
  if (suite === 'single') await single();
  else if (suite === 'dual') await dual();
  else if (suite.startsWith('malicious')) await malicious(suite.split('-')[1]);
  fs.writeFileSync(OUT, JSON.stringify(results.map(({ bytes, ...r }) => r), null, 2));
  Object.values(gws).forEach((g) => g.close());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
