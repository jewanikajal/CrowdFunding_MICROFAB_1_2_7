'use strict';
// Malicious-relay / tampering tests against the v3 bridge.   node tamper.js <out.json>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
function gw(org) {
  const d = `${org.toLowerCase()}.example.com`, host = `peer0.${d}`, base = `/crypto/peerOrganizations/${d}`, msp = `${base}/users/User1@${d}/msp`;
  const client = new grpc.Client(`${host}:7051`, grpc.credentials.createSsl(fs.readFileSync(`${base}/peers/${host}/tls/ca.crt`)));
  return connect({ client, identity: { mspId: `${org}MSP`, credentials: fs.readFileSync(path.join(msp, 'signcerts', fs.readdirSync(`${msp}/signcerts`)[0])) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(msp, 'keystore', fs.readdirSync(`${msp}/keystore`)[0])))), hash: hash.sha256 });
}
const E = ['ValidatorOrgMSP', 'PlatformOrgMSP'];
const err = (e) => [e.message].concat((e.details || []).map((d) => d.message)).join(' | ').replace(/\s+/g, ' ').slice(0, 220);
(async () => {
  const out = [], rid = Date.now().toString(36);
  const rec = (id, test, vulnerable, evidence) => { out.push({ id, test, outcome: vulnerable ? 'VULNERABLE' : 'MITIGATED', evidence }); console.log(id, vulnerable ? 'VULNERABLE' : 'MITIGATED', evidence); };
  const p = gw('PlatformOrg'), s = gw('StartupOrg');
  const gov = p.getNetwork('governance-validation-channel').getContract('governance');
  const inv = p.getNetwork('investment-execution-channel').getContract('investment');
  const invS = s.getNetwork('investment-execution-channel').getContract('investment');
  // T1 relay forges an outbox key that was never written on the source channel
  try { await inv.submitTransaction('DataBridgeContract:ApplySync', { arguments: ['governance-validation-channel', `OUTBOX_fake${rid}_PlatformPrivateData_VALIDATOR_DECISION_evil`], endorsingOrganizations: E });
    rec('B-T1', 'Relay injects a fabricated outbox entry', true, 'accepted'); } catch (e) { rec('B-T1', 'Relay injects a fabricated outbox entry', false, err(e)); }
  // T2 direct write through the v2 StoreData backdoor
  try { await invS.submitTransaction('DataBridgeContract:StoreData', { arguments: ['PlatformPrivateData', `WALLET_evil${rid}`, '{"balance":1e12}'] });
    rec('B-T2', 'Direct write via DataBridgeContract:StoreData', true, 'accepted'); } catch (e) { rec('B-T2', 'Direct write via DataBridgeContract:StoreData', false, err(e)); }
  // T3 replay an already-applied entry: must be a no-op
  const id = `Wt${rid}`;
  const c = await gov.submitAsync('PlatformContract:RecordValidatorDecision', { arguments: [id, 'C', 'V', 'h', 'true', '90', 'rh'] }); await c.getStatus();
  const key = `OUTBOX_${c.getTransactionId()}_PlatformPrivateData_VALIDATOR_DECISION_${id}`;
  let first = '', second = '';
  for (let i = 0; i < 20 && !first; i++) { try { first = Buffer.from(await inv.submitTransaction('DataBridgeContract:ApplySync', { arguments: ['governance-validation-channel', key], endorsingOrganizations: E })).toString(); } catch { await new Promise((r) => setTimeout(r, 500)); } }
  try { second = Buffer.from(await inv.submitTransaction('DataBridgeContract:ApplySync', { arguments: ['governance-validation-channel', key], endorsingOrganizations: E })).toString(); } catch (e) { second = err(e); }
  rec('B-T3', 'Replayed ApplySync applies the record twice', second === 'APPLIED', `first=${first}, replay=${second}`);
  // T4 ApplySync endorsed by an org NOT joined to the source channel cannot verify -> rejected
  try { await inv.submitTransaction('DataBridgeContract:ApplySync', { arguments: ['governance-validation-channel', key + 'x'], endorsingOrganizations: ['InvestorOrgMSP'] });
    rec('B-T4', 'Endorser without source-channel access applies an entry', true, 'accepted'); } catch (e) { rec('B-T4', 'Endorser without source-channel access applies an entry', false, err(e)); }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2)); p.close(); s.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
