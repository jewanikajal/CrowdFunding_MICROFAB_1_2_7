'use strict';
/*
 * Tests for Task 1 (SEBI eligibility), Task 5 (SE19 investment after blacklisting) and
 * Task 7 (privacy tests PR04, PR05, PR07, PR09, PR11) on the v3 code:
 *   single: CF_SingleChannel/crowdfundingv2_hardened     dual: CF_DualChannel/crowdfunding_dualchannel_v3
 *
 *   node tasks_tests.js <single|dual> <out.json>
 *
 * "Public state" is checked directly in every peer's CouchDB: Fabric stores the public world state
 * in database <channel>_<chaincode> and private data in <channel>_<chaincode>$$p<collection>
 * (hashes in $$h). Blocks are fetched with qscc by the organisation under test.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');

const MODE = process.argv[2];
const OUT = process.argv[3];
const R = Date.now().toString(36);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dom = (o) => `${o.toLowerCase()}.example.com`;
const ORGS = ['StartupOrg', 'InvestorOrg', 'ValidatorOrg', 'PlatformOrg'];
const DUAL = MODE === 'dual';
const GCH = DUAL ? 'governance-validation-channel' : 'crowdfunding-channel';
const GCC = DUAL ? 'governance' : 'crowdfunding';
const ICH = DUAL ? 'investment-execution-channel' : 'crowdfunding-channel';
const ICC = DUAL ? 'investment' : 'crowdfunding';
const gws = {};

function gw(org, user = 'User1') {
  const k = org + user; if (gws[k]) return gws[k];
  const d = dom(org), h = `peer0.${d}`, b = `/crypto/peerOrganizations/${d}`, m = `${b}/users/${user}@${d}/msp`;
  const c = new grpc.Client(`${h}:7051`, grpc.credentials.createSsl(fs.readFileSync(`${b}/peers/${h}/tls/ca.crt`)));
  return (gws[k] = connect({ client: c, identity: { mspId: `${org}MSP`, credentials: fs.readFileSync(path.join(m, 'signcerts', fs.readdirSync(`${m}/signcerts`)[0])) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(m, 'keystore', fs.readdirSync(`${m}/keystore`)[0])))), hash: hash.sha256 }));
}
const errMsg = (e) => ((e.details || []).map((d) => d.message).join(' | ') || e.message || String(e)).replace(/\s+/g, ' ');
async function sub(org, ch, cc, fn, args, transient, user) {
  try {
    const p = gw(org, user).getNetwork(ch).getContract(cc).newProposal(fn, { arguments: args.map(String), transientData: transient, endorsingOrganizations: transient ? [`${org}MSP`] : undefined });
    const tx = await p.endorse(); const st = await (await tx.submit()).getStatus();
    return { ok: st.successful, tx: tx.getTransactionId(), err: st.successful ? '' : `invalidated code ${st.code}` };
  } catch (e) { return { ok: false, err: errMsg(e).slice(0, 300) }; }
}
async function q(org, ch, cc, fn, args) {
  try { return { ok: true, res: Buffer.from(await gw(org).getNetwork(ch).getContract(cc).evaluateTransaction(fn, ...args.map(String))).toString() }; } catch (e) { return { ok: false, err: errMsg(e).slice(0, 300) }; }
}
const T = (o) => ({ private: Buffer.from(JSON.stringify(o)) });
const K = (o) => ({ kyc: Buffer.from(JSON.stringify(o)) });
const short = (m) => (m.match(/(tx creator does not have read access[^|,]*|access denied[^|]*|blacklisted[^|]*|does not meet SEBI[^|]{0,60}|cannot exceed net worth[^|]*|channel [^ ]+ not found[^|]*|not found[^|]{0,60}|failed[^|]{0,120})/i) || [m.slice(0, 160)])[0];

const results = [];
function rec(task, id, test, expected, observed, pass, evidence) {
  results.push({ task, id, test, expected, observed, result: pass ? 'PASS' : 'FAIL', evidence });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${task} ${id} ${test} -- expected: ${expected}; observed: ${observed}${evidence ? ' | ' + String(evidence).slice(0, 150) : ''}`);
}

// ---------------- CouchDB inspection ----------------
const COUCH_AUTH = 'Basic ' + Buffer.from('admin:adminpw').toString('base64');
async function couch(org, p) {
  const host = `couchdb.peer0${org.toLowerCase()}`;
  const r = await fetch(`http://${host}:5984/${p}`, { headers: { Authorization: COUCH_AUTH } });
  return r.json();
}
// returns {public:[db...], private:[db...], hashed:[db...]} where the needle occurs
async function couchSearch(org, needle) {
  const dbs = (await couch(org, '_all_dbs')).filter((d) => !d.startsWith('_'));
  const hit = { public: [], private: [], hashed: [] };
  for (const db of dbs) {
    if (!/_(crowdfunding|governance|investment|cftoken)/.test(db)) continue; // chaincode namespaces only
    const all = await couch(org, `${encodeURIComponent(db)}/_all_docs?include_docs=true`);
    const text = JSON.stringify(all.rows || []);
    if (text.includes(needle)) {
      (db.includes('$$h') ? hit.hashed : db.includes('$$p') ? hit.private : hit.public).push(db);
    }
  }
  return hit;
}
async function blockHas(org, ch, txid, needle) {
  try {
    const b = Buffer.from(await gw(org).getNetwork(ch).getContract('qscc').evaluateTransaction('GetBlockByTxID', ch, txid));
    return { fetched: true, found: b.includes(Buffer.from(needle)) };
  } catch (e) { return { fetched: false, found: false, err: short(errMsg(e)) }; }
}
function findHash(o) { if (!o || typeof o !== 'object') return null; for (const [k, v] of Object.entries(o)) { if (/validationProofHash/i.test(k) && typeof v === 'string' && v) return v; const h = findHash(v); if (h) return h; } return null; }

(async () => {
  // =========================== setup: honest workflow up to publication ===========================
  const st = `ST_${R}`, camp = `CAMP_${R}`, val = `VAL_${R}`;
  const DOC = `SECRETDOC_${R}.pdf`;
  const setup = [];
  const s = async (label, p) => { const r = await p; setup.push(`${r.ok ? 'ok' : 'FAILED'} ${label}${r.ok ? '' : ': ' + r.err}`); return r; };
  await s('CreateStartup', sub('StartupOrg', GCH, GCC, 'StartupContract:CreateStartup', [st, 'f', 'S', 'x', 'D']));
  const cc = await s('CreateCampaign', sub('StartupOrg', GCH, GCC, 'StartupContract:CreateCampaign', [camp, st, 'Technology', '2027-12-31', 'INR', 'false', 'false', '2024-01-01', 'MVP', 'FinTech', '["ai"]', 'true', 'false', '90', '1', '1', '2027', '50000000', '1Cr-5Cr', 'P', 'd', ''], T({ documents: [DOC] })));
  await s('SubmitForValidation', sub('StartupOrg', GCH, GCC, 'StartupContract:SubmitForValidation', [camp, '[]', 'n']));
  await s('ValidateCampaign', sub('ValidatorOrg', GCH, GCC, 'ValidatorContract:ValidateCampaign', [val, camp, 'V1', 'h', '[]']));
  await s('ApproveOrRejectCampaign', sub('ValidatorOrg', GCH, GCC, 'ValidatorContract:ApproveOrRejectCampaign', [val, camp, 'APPROVED', 8.5, 3.2, 'LOW', '[]', '[]', '']));
  if (DUAL) await s('ShareValidationToPlatform', sub('ValidatorOrg', GCH, GCC, 'ValidatorContract:ShareValidationToPlatform', [val, camp]));
  const gc = await q('StartupOrg', GCH, GCC, 'StartupContract:GetCampaign', [camp]);
  const vh = gc.ok ? findHash(JSON.parse(gc.res)) : null;
  await s('ShareCampaignToPlatform', sub('StartupOrg', GCH, GCC, 'StartupContract:ShareCampaignToPlatform', [camp, vh]));
  await s('PublishCampaignToPortal', sub('PlatformOrg', GCH, GCC, 'PlatformContract:PublishCampaignToPortal', [camp, vh]));
  if (DUAL) { let ok = false; for (let i = 0; i < 40 && !ok; i++) { ok = (await q('InvestorOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['AllOrgsShared', `CAMPAIGN_PUBLIC_${camp}`])).ok; if (!ok) await sleep(1000); } setup.push(`${ok ? 'ok' : 'FAILED'} campaign bridged to investment channel`); }
  console.log('setup:\n  ' + setup.join('\n  '));

  // =========================== TASK 1: SEBI eligibility ===========================
  const cases = [
    ['T1-1', 'Income route: income 2.5 cr', { annualIncome: 25000000 }, true, 'INCOME'],
    ['T1-2', 'Net-worth route: income 0.5 cr, net worth 8 cr, financial assets 4 cr', { annualIncome: 5000000, netWorth: 80000000, financialAssets: 40000000 }, true, 'NET_WORTH'],
    ['T1-3', 'Hybrid route: income 1.2 cr, net worth 5.5 cr, financial assets 2.6 cr', { annualIncome: 12000000, netWorth: 55000000, financialAssets: 26000000 }, true, 'INCOME_AND_NET_WORTH'],
    ['T1-4', 'Rejected: income 0.8 cr, net worth 6 cr, financial assets 3 cr (below every route)', { annualIncome: 8000000, netWorth: 60000000, financialAssets: 30000000 }, false],
    ['T1-4b', 'Hybrid route: income 1.5 cr, net worth 6 cr, financial assets 3 cr', { annualIncome: 15000000, netWorth: 60000000, financialAssets: 30000000 }, true, 'INCOME_AND_NET_WORTH'],
    ['T1-5', 'Rejected: net worth 8 cr but financial assets only 3 cr', { annualIncome: 0, netWorth: 80000000, financialAssets: 30000000 }, false],
    ['T1-6', 'Rejected: financial assets 9 cr exceed net worth 8 cr', { annualIncome: 0, netWorth: 80000000, financialAssets: 90000000 }, false],
    ['T1-7', 'Boundary: income exactly 2 cr', { annualIncome: 20000000 }, true, 'INCOME'],
    ['T1-8', 'Boundary: net worth exactly 7.5 cr, financial assets exactly 3.75 cr', { annualIncome: 0, netWorth: 75000000, financialAssets: 37500000 }, true, 'NET_WORTH'],
  ];
  for (const [id, label, k, expectOk, basis] of cases) {
    const inv = `INV_${id.replace('-', '')}_${R}`;
    const r = await sub('InvestorOrg', ICH, ICC, 'InvestorContract:RegisterInvestor', [inv, 'Test', 0, '', ''], K({ ...k, aadharNumber: '1111-2222-3333', panNumber: 'ABCDE1234F' }));
    let stored = '';
    if (r.ok) {
      const p = DUAL ? await q('InvestorOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['InvestorPrivateData', `INVESTOR_PRIV_${inv}`])
        : await q('InvestorOrg', ICH, ICC, 'InvestorContract:GetInvestorPrivateProfile', [inv]);
      stored = p.ok ? (JSON.parse(p.res).eligibilityBasis || '') : p.err;
    }
    const pass = expectOk ? (r.ok && stored === basis) : !r.ok;
    rec('Task1', id, label, expectOk ? `registered, basis ${basis}` : 'rejected', r.ok ? `registered, basis ${stored}` : 'rejected', pass, r.ok ? '' : short(r.err));
  }

  // =========================== TASK 7: privacy tests ===========================
  const inv = `INV_priv_${R}`;
  const AADHAAR = `9${R.slice(-3).replace(/\D/g, '7').padEnd(3, '7')}-4455-6677`;
  const INCOME = 41234567 + (parseInt(R.slice(-2), 36) % 1000);
  const PAN = `PRV${R.slice(-5).toUpperCase()}Z`;
  const reg = await sub('InvestorOrg', ICH, ICC, 'InvestorContract:RegisterInvestor', [inv, 'Meera', 0, '', ''], K({ annualIncome: INCOME, aadharNumber: AADHAAR, panNumber: PAN }));
  console.log(`privacy investor registered: ${reg.ok ? 'yes' : reg.err}  aadhaar=${AADHAAR} income=${INCOME} pan=${PAN}`);
  await sleep(3000); // let private data dissemination / CouchDB settle

  const scan = {};
  for (const needle of [AADHAAR, String(INCOME), PAN, DOC]) { scan[needle] = {}; for (const o of ORGS) scan[needle][o] = await couchSearch(o, needle); }
  const publicHits = (n) => ORGS.filter((o) => scan[n][o].public.length).map((o) => `${o}:${scan[n][o].public.join(',')}`);
  const privHolders = (n) => ORGS.filter((o) => scan[n][o].private.length);
  const regBlockFor = async (org, n) => (reg.ok ? blockHas(org, ICH, reg.tx, n) : { fetched: false, found: false });

  // PR04 Aadhaar not in public state
  {
    const pub = publicHits(AADHAAR); const blk = await regBlockFor('StartupOrg', AADHAAR);
    rec('Task7', 'PR04', 'Investor Aadhaar number not in public state', 'absent from public state of all 4 peers and from blocks; present only in InvestorOrg private data',
      `public state: ${pub.length ? 'FOUND ' + pub.join(' ') : 'absent on all peers'}; blocks: ${blk.found ? 'FOUND' : 'absent'}; private copies on: ${privHolders(AADHAAR).join(', ') || 'none'}`,
      reg.ok && !pub.length && !blk.found && privHolders(AADHAAR).join() === 'InvestorOrg');
  }
  // PR07 income not in public state
  {
    const n = String(INCOME); const pub = publicHits(n); const blk = await regBlockFor('StartupOrg', n);
    rec('Task7', 'PR07', 'Investor annual income not in public state', 'absent from public state of all 4 peers and from blocks; present only in InvestorOrg private data',
      `public state: ${pub.length ? 'FOUND ' + pub.join(' ') : 'absent on all peers'}; blocks: ${blk.found ? 'FOUND' : 'absent'}; private copies on: ${privHolders(n).join(', ') || 'none'}`,
      reg.ok && !pub.length && !blk.found && privHolders(n).join() === 'InvestorOrg');
  }
  // PR05 PAN not visible to unauthorised orgs
  {
    const reads = {};
    for (const o of ORGS) {
      const r = DUAL ? await q(o, ICH, ICC, 'DataBridgeContract:ReadData', ['InvestorValidatorShared', `INVESTOR_SHARED_${inv}`])
        : await q(o, ICH, ICC, 'InvestorContract:GetInvestorSharedProfile', [inv]);
      reads[o] = r.ok && r.res.includes(PAN) ? 'readable' : `denied (${short(r.err || 'no PAN')})`;
    }
    const pub = publicHits(PAN), holders = privHolders(PAN);
    const blkS = await regBlockFor('StartupOrg', PAN), blkP = await regBlockFor('PlatformOrg', PAN);
    const pass = reads.InvestorOrg === 'readable' && reads.ValidatorOrg === 'readable' && reads.StartupOrg !== 'readable' && reads.PlatformOrg !== 'readable' &&
      !pub.length && !blkS.found && !blkP.found && holders.every((o) => ['InvestorOrg', 'ValidatorOrg'].includes(o));
    rec('Task7', 'PR05', 'Investor PAN not visible to unauthorised organisations', 'readable by InvestorOrg and ValidatorOrg only; not in public state or blocks; stored only on Investor/Validator peers',
      `reads: ${ORGS.map((o) => `${o.replace('Org', '')}=${reads[o].startsWith('readable') ? 'readable' : 'denied'}`).join(', ')}; public state: ${pub.length ? 'FOUND' : 'absent'}; blocks (Startup/Platform): ${blkS.found || blkP.found ? 'FOUND' : 'absent'}; stored on: ${holders.join(', ')}`,
      pass, `Startup: ${reads.StartupOrg}`);
  }
  // PR09 StartupOrg cannot read investor annual income
  {
    const r = DUAL ? await q('StartupOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['InvestorPrivateData', `INVESTOR_PRIV_${inv}`])
      : await q('StartupOrg', ICH, ICC, 'InvestorContract:GetInvestorPrivateProfile', [inv]);
    const n = String(INCOME); const onStartupPeer = [...scan[n].StartupOrg.public, ...scan[n].StartupOrg.private];
    const blk = await regBlockFor('StartupOrg', n);
    const own = DUAL ? await q('InvestorOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['InvestorPrivateData', `INVESTOR_PRIV_${inv}`])
      : await q('InvestorOrg', ICH, ICC, 'InvestorContract:GetInvestorPrivateProfile', [inv]);
    const pass = !(r.ok && r.res.includes(n)) && !onStartupPeer.length && !blk.found && own.ok && own.res.includes(n);
    rec('Task7', 'PR09', 'StartupOrg cannot read investor annual income', 'StartupOrg read denied; income not on StartupOrg peer or in its blocks; InvestorOrg can read it',
      `StartupOrg read: ${r.ok && r.res.includes(n) ? 'ALLOWED' : 'denied'}; on StartupOrg peer: ${onStartupPeer.length ? 'FOUND' : 'absent'}; in blocks: ${blk.found ? 'FOUND' : 'absent'}; InvestorOrg read: ${own.ok ? 'allowed' : 'denied'}`,
      pass, r.ok ? '' : short(r.err));
  }
  // PR11 campaign private documents not readable by InvestorOrg
  {
    const rd = await q('InvestorOrg', GCH, GCC, 'StartupContract:GetCampaign', [camp]); // reads StartupPrivateData
    const rdOk = rd.ok && rd.res.includes(DOC);
    const onInvestorPeerPrivate = scan[DOC].InvestorOrg.private;
    const invBlk = cc.ok ? await blockHas('InvestorOrg', GCH, cc.tx, DOC) : { fetched: false };
    const pubRec = DUAL ? await q('InvestorOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['AllOrgsShared', `CAMPAIGN_PUBLIC_${camp}`])
      : await q('InvestorOrg', ICH, ICC, 'StartupContract:GetCampaignPublic', [camp]);
    const inPublished = pubRec.ok && pubRec.res.includes(DOC);
    const pass = !rdOk && !onInvestorPeerPrivate.length && !invBlk.found && !inPublished;
    const plain = await sub('StartupOrg', GCH, GCC, 'StartupContract:CreateCampaign', [`CAMPX_${R}`, st, 'Technology', '2027-12-31', 'INR', 'false', 'false', '2024-01-01', 'MVP', 'FinTech', '["ai"]', 'true', 'false', '90', '1', '1', '2027', '50000000', '1Cr-5Cr', 'P', 'd', JSON.stringify(['plain_doc.pdf'])]);
    rec('Task7', 'PR11b', 'Campaign documents cannot be submitted as plaintext arguments', 'rejected', plain.ok ? 'ACCEPTED' : 'rejected', !plain.ok, short(plain.err || ''));
    rec('Task7', 'PR11', 'Campaign private documents not readable by InvestorOrg', 'InvestorOrg cannot read StartupPrivateData; documents not in blocks InvestorOrg receives nor in the published campaign record',
      `private record read: ${rdOk ? 'ALLOWED' : 'denied'}; copy on InvestorOrg peer: ${onInvestorPeerPrivate.length ? 'FOUND' : 'none'}; CreateCampaign block via InvestorOrg: ${invBlk.fetched ? (invBlk.found ? 'FOUND in block' : 'fetched, absent') : 'not accessible (' + (invBlk.err || 'n/a') + ')'}; published record: ${inPublished ? 'CONTAINS document list' : 'no documents'}; public state hits: ${publicHits(DOC).join(' ') || 'none'}`,
      pass, rd.ok ? '' : short(rd.err));
  }

  // =========================== TASK 5: SE19 investment after blacklisting ===========================
  {
    const invId = `INV_se19_${R}`;
    await sub('InvestorOrg', ICH, ICC, 'InvestorContract:RegisterInvestor', [invId, 'Kiran', 0, '', ''], K({ annualIncome: 30000000, aadharNumber: '1-1-1', panNumber: 'P' }));
    const before = await sub('InvestorOrg', ICH, ICC, 'InvestorContract:MakeInvestment', [`INVT_se19a_${R}`, '', '', 0, ''], T({ campaignId: camp, investorId: invId, amount: 25000000, currency: 'INR' }));
    rec('Task5', 'SE19-0', 'Control: investment before blacklisting', 'accepted', before.ok ? 'accepted' : 'rejected', before.ok, before.ok ? '' : short(before.err));
    const byStartup = await sub('StartupOrg', GCH, GCC, 'ValidatorContract:BlacklistCampaign', [camp, 'self-unblacklist attempt']);
    rec('Task5', 'SE19-1', 'Only ValidatorOrg can blacklist', 'StartupOrg rejected', byStartup.ok ? 'accepted' : 'rejected', !byStartup.ok, short(byStartup.err || ''));
    const bl = await sub('ValidatorOrg', GCH, GCC, 'ValidatorContract:BlacklistCampaign', [camp, 'fraud: falsified financial statements']);
    rec('Task5', 'SE19-2', 'ValidatorOrg blacklists the published campaign', 'committed', bl.ok ? 'committed' : 'failed', bl.ok, bl.ok ? '' : short(bl.err));
    if (DUAL) { let seen = false; const t0 = Date.now(); for (let i = 0; i < 40 && !seen; i++) { seen = (await q('InvestorOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['AllOrgsShared', `CAMPAIGN_BLACKLIST_${camp}`])).ok; if (!seen) await sleep(1000); }
      rec('Task5', 'SE19-3', 'Blacklist marker reaches the investment channel (bridge)', 'visible to InvestorOrg', seen ? `visible after ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'not visible', seen); }
    const after = await sub('InvestorOrg', ICH, ICC, 'InvestorContract:MakeInvestment', [`INVT_se19b_${R}`, '', '', 0, ''], T({ campaignId: camp, investorId: invId, amount: 25000000, currency: 'INR' }));
    rec('Task5', 'SE19', 'Investment after blacklisting is rejected', 'rejected (fraud control)', after.ok ? 'ACCEPTED' : 'rejected', !after.ok && /blacklisted/i.test(after.err), short(after.err || 'committed'));
    const prop = await sub('InvestorOrg', ICH, ICC, 'InvestorContract:CreateInvestmentProposal', [`PROP_se19_${R}`, '', '', '', 0, '', '', '', '', ''], T({ campaignId: camp, investorId: invId, startupId: st, investmentAmount: 30000000, currency: 'INR' }));
    rec('Task5', 'SE19-4', 'Proposal after blacklisting is rejected', 'rejected (fraud control)', prop.ok ? 'ACCEPTED' : 'rejected', !prop.ok && /blacklisted/i.test(prop.err), short(prop.err || 'committed'));
    const isBl = await q('ValidatorOrg', GCH, GCC, 'ValidatorContract:IsCampaignBlacklisted', [camp]);
    rec('Task5', 'SE19-5', 'Blacklist reason kept private; IsCampaignBlacklisted true for ValidatorOrg', 'true', isBl.ok ? isBl.res : isBl.err, isBl.ok && isBl.res === 'true');
    const hits = []; for (const o of ORGS) { const h = await couchSearch(o, 'falsified financial statements'); if (h.public.length) hits.push(o); }
    rec('Task5', 'SE19-6', 'Blacklist reason not in public state', 'absent', hits.length ? `FOUND on ${hits.join(',')}` : 'absent on all peers', !hits.length);
  }

  fs.writeFileSync(OUT, JSON.stringify({ mode: MODE, setup, results }, null, 2));
  Object.values(gws).forEach((g) => g.close());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
