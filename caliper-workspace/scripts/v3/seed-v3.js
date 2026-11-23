'use strict';
/*
 * Seed the v3 network for the Caliper Table 12 run (equivalent of scripts/seed-single-full.sh, adapted
 * to v3: KYC/documents/investment data via the transient map, tokens in the cftoken chaincode, dual
 * publication on the governance channel + bridge). Uses the same User1 identities as Caliper.
 *   node seed-v3.js <single|dual>      -> writes ../../seed-state.json
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const ARCH = process.argv[2];
const WS = path.resolve(__dirname, '..', '..');
const DUAL = ARCH === 'dual';
const GCH = DUAL ? 'governance-validation-channel' : 'crowdfunding-channel', GCC = DUAL ? 'governance' : 'crowdfunding';
const ICH = DUAL ? 'investment-execution-channel' : 'crowdfunding-channel', ICC = DUAL ? 'investment' : 'crowdfunding';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gws = {};
function contract(org, ch, cc) {
  const k = org;
  if (!gws[k]) {
    const dir = `${WS}/crypto/v3/${ARCH}/${org}`, host = `peer0.${org.toLowerCase()}.example.com`;
    const client = new grpc.Client(`${host}:7051`, grpc.credentials.createSsl(fs.readFileSync(`${dir}/tlsca.pem`)));
    gws[k] = connect({ client, identity: { mspId: `${org}MSP`, credentials: fs.readFileSync(`${dir}/cert.pem`) },
      signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(`${dir}/key.pem`))) });
  }
  return gws[k].getNetwork(ch).getContract(cc);
}
const enc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Buffer.from(JSON.stringify(v))]));
async function tx(label, org, ch, cc, fn, args, transient, required = true) {
  for (let i = 1; i <= 5; i++) {
    try {
      const p = contract(org, ch, cc).newProposal(fn, { arguments: args.map(String), transientData: transient ? enc(transient) : undefined, endorsingOrganizations: transient ? [`${org}MSP`] : undefined });
      const t = await p.endorse(); const st = await (await t.submit()).getStatus();
      if (st.successful) { console.log(`  ok   ${label}`); return true; }
      throw new Error(`code ${st.code}`);
    } catch (e) {
      const m = ((e.details || []).map((d) => d.message).join(' | ') || e.message);
      if (/already exists|already initialized|already/i.test(m)) { console.log(`  ok   ${label} (exists)`); return true; }
      if (i === 5) { console.log(`  FAIL ${label}: ${m.slice(0, 200)}`); if (required) throw new Error(label); return false; }
      await sleep(1000 * i);
    }
  }
}
async function query(org, ch, cc, fn, args) { return JSON.parse(Buffer.from(await contract(org, ch, cc).evaluateTransaction(fn, ...args.map(String))).toString()); }
function findHash(o) { if (!o || typeof o !== 'object') return null; for (const [k, v] of Object.entries(o)) { if (/validationProofHash/i.test(k) && typeof v === 'string' && v) return v; const h = findHash(v); if (h) return h; } return null; }

(async () => {
  const S = { arch: ARCH, startupId: 'STARTUP001', campaignId: 'CAMP001', validationId: 'VAL001', investorId: 'INVESTOR001', proposalId: 'PROPOSAL001',
    agreementId: 'AGREEMENT001', escrowId: 'ESCROW_AGREEMENT001', verificationId: 'MILESTONE_VER001', reportId: 'MILESTONE_RPT001', milestoneId: 'M1' };
  console.log(`seeding v3 ${ARCH}`);
  // tokens (cftoken, OutOf(2,4)) and fee tiers
  await tx('InitializeToken CFT', 'PlatformOrg', ICH, 'cftoken', 'TokenContract:InitializeToken', ['CFT', 'CrowdToken', '18', '100000000', '1000000000']);
  await tx('MintTokens PLATFORM', 'PlatformOrg', ICH, 'cftoken', 'TokenContract:MintTokens', ['CFT', 'PLATFORM', '150000000']);
  await tx('SetCampaignFeeTier', 'PlatformOrg', ICH, ICC, 'PlatformContract:SetCampaignFeeTier', ['TIER_001', '0', '100000', '5', '5% under 100K']);
  await tx('SetDisputeFeeTier', 'PlatformOrg', ICH, ICC, 'PlatformContract:SetDisputeFeeTier', ['TIER_STD', '0', '100000', '750', 'Standard dispute fee']);
  // startup, campaign, validation, publication
  await tx('CreateStartup', 'StartupOrg', GCH, GCC, 'StartupContract:CreateStartup', [S.startupId, 'STU_SEED', 'Seed Startup', 'Caliper seed', 'S-SEED']);
  await tx('CreateCampaign', 'StartupOrg', GCH, GCC, 'StartupContract:CreateCampaign', [S.campaignId, S.startupId, 'Technology', '2027-12-31', 'USD', 'false', 'false', '2025-01-01', 'Prototype', 'Hardware', '["IoT"]', 'false', 'false', '90', '1', '1', '2027', '50000', '50K-100K', 'Seed campaign', 'Caliper seed campaign', ''], { private: { documents: ['business_plan.pdf', 'pitch_deck.pdf'] } });
  await tx('SubmitForValidation', 'StartupOrg', GCH, GCC, 'StartupContract:SubmitForValidation', [S.campaignId, '', 'seed'], { private: { documents: ['business_plan.pdf'] } });
  await tx('ValidateCampaign', 'ValidatorOrg', GCH, GCC, 'ValidatorContract:ValidateCampaign', [S.validationId, S.campaignId, 'VALIDATOR001', 'seed_hash', ''], { private: { documents: ['business_plan.pdf'] } });
  await tx('ApproveOrRejectCampaign', 'ValidatorOrg', GCH, GCC, 'ValidatorContract:ApproveOrRejectCampaign', [S.validationId, S.campaignId, 'APPROVED', '8.5', '2.5', 'LOW', '["seed approve"]', '[]', '']);
  if (DUAL) await tx('ShareValidationToPlatform', 'ValidatorOrg', GCH, GCC, 'ValidatorContract:ShareValidationToPlatform', [S.validationId, S.campaignId]);
  S.validationProofHash = findHash(await query('StartupOrg', GCH, GCC, 'StartupContract:GetCampaign', [S.campaignId]));
  await tx('ShareCampaignToPlatform', 'StartupOrg', GCH, GCC, 'StartupContract:ShareCampaignToPlatform', [S.campaignId, S.validationProofHash]);
  await tx('PublishCampaignToPortal', 'PlatformOrg', GCH, GCC, 'PlatformContract:PublishCampaignToPortal', [S.campaignId, S.validationProofHash]);
  if (DUAL) { // wait for the bridge
    let ok = false; for (let i = 0; i < 60 && !ok; i++) { try { await query('InvestorOrg', ICH, ICC, 'DataBridgeContract:ReadData', ['AllOrgsShared', `CAMPAIGN_PUBLIC_${S.campaignId}`]); ok = true; } catch { await sleep(1000); } }
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} campaign bridged to investment channel`); if (!ok) throw new Error('bridge');
  }
  // investor, token accounts, proposal, agreement, milestone
  await tx('RegisterInvestor', 'InvestorOrg', ICH, ICC, 'InvestorContract:RegisterInvestor', [S.investorId, 'Seed Investor', '0', '', ''], { kyc: { annualIncome: 25000000, aadharNumber: '123456789012', panNumber: 'SEEDP1234Z' } });
  for (const [acct, type] of [[S.startupId, 'STARTUP'], [S.investorId, 'INVESTOR'], ['VALIDATOR001', 'VALIDATOR']]) {
    await tx(`CreateTokenAccount ${acct}`, 'PlatformOrg', ICH, 'cftoken', 'TokenContract:CreateTokenAccount', [acct, acct, type, '{}']);
  }
  await tx('TransferTokens -> STARTUP001', 'PlatformOrg', ICH, 'cftoken', 'TokenContract:TransferTokens', [`TRX_SEED_STU_${Date.now()}`, 'CFT', 'PLATFORM', S.startupId, '5000', 'INR', 'INITIAL_FUNDING', '']);
  await tx('TransferTokens -> INVESTOR001', 'PlatformOrg', ICH, 'cftoken', 'TokenContract:TransferTokens', [`TRX_SEED_INV_${Date.now()}`, 'CFT', 'PLATFORM', S.investorId, '50000000', 'INR', 'INITIAL_FUNDING', '']);
  await tx('CreateInvestmentProposal', 'InvestorOrg', ICH, ICC, 'InvestorContract:CreateInvestmentProposal', [S.proposalId, '', '', '', '0', '', '', '', '', ''],
    { private: { campaignId: S.campaignId, investorId: S.investorId, startupId: S.startupId, investmentAmount: 20000000, currency: 'USD', equity: '10', duration: '3 years', milestones: '[{"milestoneId":"M1","title":"Beta","amount":10000000}]', proposedTerms: 'seed terms' } });
  await tx('WitnessAgreement', 'PlatformOrg', ICH, ICC, 'PlatformContract:WitnessAgreement', [S.agreementId, S.campaignId, S.startupId, S.investorId, '20000000', 'USD', '[{"milestoneId":"M1","title":"Beta Launch","amount":10000000}]']);
  await tx('SubmitMilestoneReport', 'StartupOrg', GCH, GCC, 'StartupContract:SubmitMilestoneReport', [S.reportId, S.campaignId, S.milestoneId, S.agreementId, 'Beta Launch Completed', 'Caliper seed milestone', '["evidence.pdf"]'], undefined, false);
  await tx('VerifyMilestoneCompletion', 'ValidatorOrg', GCH, GCC, 'ValidatorContract:VerifyMilestoneCompletion', [S.verificationId, S.milestoneId, S.campaignId, S.startupId, S.reportId, 'true', '9.5', 'seed verified', 'true'], undefined, false);
  await tx('ShareMilestoneValidationToPlatform', 'ValidatorOrg', GCH, GCC, 'ValidatorContract:ShareMilestoneValidationToPlatform', [S.verificationId], undefined, false);
  fs.writeFileSync(`${WS}/seed-state.json`, JSON.stringify(S, null, 2));
  console.log('seed-state.json written');
  Object.values(gws).forEach((g) => g.close());
  process.exit(0);
})().catch((e) => { console.error('seed failed:', e.message); process.exit(1); });
