'use strict';
// Setup for the Task 4 contention reproduction on the ORIGINAL v2 single-channel chaincode.
//   node task4_setup.js <recipients> <proposals>
const fs = require('fs'), path = require('path'), crypto = require('crypto'), grpc = require('@grpc/grpc-js');
const { connect, signers, hash } = require('@hyperledger/fabric-gateway');
const CH = 'crowdfunding-channel', CC = 'crowdfunding';
const [NR, NP] = [Number(process.argv[2] || 10), Number(process.argv[3] || 10)];
function gw(org) { const d = `${org.toLowerCase()}.example.com`, h = `peer0.${d}`, b = `/crypto/peerOrganizations/${d}`, m = `${b}/users/User1@${d}/msp`;
  const c = new grpc.Client(`${h}:7051`, grpc.credentials.createSsl(fs.readFileSync(`${b}/peers/${h}/tls/ca.crt`)));
  return connect({ client: c, identity: { mspId: `${org}MSP`, credentials: fs.readFileSync(path.join(m, 'signcerts', fs.readdirSync(`${m}/signcerts`)[0])) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(m, 'keystore', fs.readdirSync(`${m}/keystore`)[0])))), hash: hash.sha256 }); }
const P = gw('PlatformOrg').getNetwork(CH).getContract(CC), I = gw('InvestorOrg').getNetwork(CH).getContract(CC);
async function batch(items, f, conc = 50) { let ok = 0; for (let i = 0; i < items.length; i += conc) { const r = await Promise.allSettled(items.slice(i, i + conc).map(f)); ok += r.filter((x) => x.status === 'fulfilled').length; } return ok; }
(async () => {
  await P.submitTransaction('TokenContract:InitializeToken', 'CFT', 'CrowdToken', '2', '0', '0').catch(() => {});
  await P.submitTransaction('TokenContract:CreateTokenAccount', 'PLATFORM', 'PLATFORM', 'PLATFORM', '{}').catch(() => {});
  await P.submitTransaction('TokenContract:MintTokens', 'CFT', 'PLATFORM', '1000000000');
  const r = await batch([...Array(NR).keys()], (i) => P.submitTransaction('TokenContract:CreateTokenAccount', `RCPT_${i}`, `RCPT_${i}`, 'USER', '{}'));
  const p = await batch([...Array(NP).keys()], (i) => I.submitTransaction('InvestorContract:CreateInvestmentProposal', `PROP_${i}`, 'CAMP_1', 'INV_1', 'ST_1', '30000000', 'INR', '10%', '24m', '[]', 'initial terms'));
  console.log(`setup: PLATFORM funded, ${r}/${NR} recipients, ${p}/${NP} proposals`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
