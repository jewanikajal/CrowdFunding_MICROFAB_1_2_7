'use strict';
/*
 * Isolated-operation workload (corrected design for Table 12).
 *
 * The original workloads submit the prerequisite transactions of an operation (create startup, campaign,
 * validation, publication, ...) inside the measured round. Caliper counts every Fabric transaction, so
 * multi-step rounds mostly measured the prerequisites and, under stress, rarely reached the named
 * operation. Here the prerequisites for every iteration are created in initializeWorkloadModule(),
 * which Caliper 0.5.0 runs before it activates the round's transaction observer (caliper-worker.js:
 * prepareTest -> initializeWorkloadModule; executeRound -> txObserverDispatch.activate). The measured
 * round therefore submits ONLY the named operation, with the same arguments as the original workloads.
 *
 * Round arguments: { arch, op, poolSize }  (poolSize = per-worker iterations, set by make-isolated-bench.py)
 */
const crypto = require('crypto');
const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const H = require('../workloads/helpers');
const { loadSeedState } = require('../workloads/seedState');

const PREP_CONCURRENCY = Number(process.env.PREP_CONCURRENCY || 20);
const BRIDGE_WAIT_MS = Number(process.env.BRIDGE_WAIT_MS || 4000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (s, req) => H.sendOk(s, req);
// prerequisite writes to a hot key (the PLATFORM token account) conflict with each other (code 11): retry them
async function okRetry(s, mk, tries = 10) {
    for (let t = 0; t < tries; t++) { if (await H.sendOk(s, mk(t))) return true; await sleep(200 + Math.random() * 800); }
    return false;
}
const B = (op, args, a) => H.buildRequest(op, args, a);

async function startup(s, a, w, i) {
    const id = H.uniqueId('STARTUP', w, i);
    return (await ok(s, B('createStartup', a, [id, `STU_${w}_${i}`, `Startup ${id}`, 'Bootstrap', `S-${w}-${i}`]))) ? id : null;
}
async function submitted(s, a, w, i) {
    const b = await H.bootstrapCampaign(s, a, w, i);
    if (!b) return null;
    return (await ok(s, B('submitForValidation', a, [b.campaignId, '["business_plan.pdf"]', 'Caliper validation request']))) ? b : null;
}
async function validated(s, a, w, i) {
    const b = await submitted(s, a, w, i);
    if (!b) return null;
    const validationId = H.uniqueId('VAL', w, i);
    return (await ok(s, B('validateCampaign', a, [validationId, b.campaignId, 'VALIDATOR001', 'caliper_hash', '["business_plan.pdf"]']))) ? { ...b, validationId } : null;
}
async function shared(s, a, w, i) { // approved + (dual) validation shared + campaign shared; ready to publish
    const b = await H.bootstrapApprovedCampaign(s, a, w, i);
    if (!b) return null;
    if (H.archOf(a) !== 'single' && !await ok(s, B('shareValidationToPlatform', a, [b.validationId, b.campaignId]))) return null;
    return (await ok(s, B('shareCampaignToPlatform', a, [b.campaignId, b.proof]))) ? b : null;
}
async function approvedReadyToShare(s, a, w, i) {
    const b = await H.bootstrapApprovedCampaign(s, a, w, i);
    if (!b) return null;
    if (H.archOf(a) !== 'single' && !await ok(s, B('shareValidationToPlatform', a, [b.validationId, b.campaignId]))) return null;
    return b;
}
const published = (s, a, w, i) => H.bootstrapPublishedCampaign(s, a, w, i);

// --------------------------------------------------------------------------------------------------
// per operation: shared(): one-off prerequisites per worker; prepare(i): per-iteration prerequisites;
// run(i, item): the named operation only (arguments as in the original workloads)
// --------------------------------------------------------------------------------------------------
const OPS = {
    createStartup: { run: (c, i) => ['createStartup', [H.uniqueId('STARTUP', c.w, i), `STU_${c.w}_${i}`, `Startup ${i}`, `Caliper-generated startup ${i}`, `S-${c.w}-${i}`]] },
    createCampaign: { prepare: (c, i) => startup(c.s, c.a, c.w, i), run: (c, i, st) => ['createCampaign', H.campaignArgs(H.uniqueId('CAMP', c.w, i), st)] },
    submitForValidation: { prepare: (c, i) => H.bootstrapCampaign(c.s, c.a, c.w, i), run: (c, i, b) => ['submitForValidation', [b.campaignId, '["business_plan.pdf"]', `Caliper submit ${b.campaignId}`]] },
    validateCampaign: { prepare: (c, i) => submitted(c.s, c.a, c.w, i), run: (c, i, b) => ['validateCampaign', [H.uniqueId('VAL', c.w, i), b.campaignId, 'VALIDATOR001', c.a.submissionHash || 'caliper_submission_hash_placeholder', '["business_plan.pdf"]']] },
    approveOrRejectCampaign: { prepare: (c, i) => validated(c.s, c.a, c.w, i), run: (c, i, b) => ['approveOrRejectCampaign', [b.validationId, b.campaignId, 'APPROVED', '8.5', '2.5', 'LOW', '["Caliper approve"]', '[]', '']] },
    shareCampaignToPlatform: { prepare: (c, i) => approvedReadyToShare(c.s, c.a, c.w, i), run: (c, i, b) => ['shareCampaignToPlatform', [b.campaignId, b.proof]] },
    publishCampaignToPortal: { prepare: (c, i) => shared(c.s, c.a, c.w, i), run: (c, i, b) => ['publishCampaignToPortal', [b.campaignId, b.proof]] },
    registerInvestor: { run: (c, i) => ['registerInvestor', [H.uniqueId(H.archOf(c.a) === 'single' ? 'INVESTOR' : 'INV', c.w, i), `Investor ${i}`, c.a.annualIncome || '25000000',
        String(200000000000 + c.w * 100000 + i), (`CALI${c.w}${String(i).padStart(4, '0')}Z`).slice(0, 10)]] },
    viewCampaign: { shared: (c) => published(c.s, c.a, c.w, 0), run: (c, i, _, sh) => ['viewCampaign', [H.uniqueId('VIEW', c.w, i), sh.campaignId, c.seed.investorId]] },
    makeInvestment: { shared: (c) => published(c.s, c.a, c.w, 0), run: (c, i, _, sh) => ['makeInvestment', [H.uniqueId('INVEST', c.w, i), sh.campaignId, c.seed.investorId, c.a.amount || '20000000', 'USD']] },
    createInvestmentProposal: { shared: (c) => published(c.s, c.a, c.w, 0),
        run: (c, i, _, sh) => ['createInvestmentProposal', [H.uniqueId('PROP', c.w, i), sh.campaignId, c.seed.investorId, sh.startupId, '20000000', 'USD', '10', '3 years', '[{"milestoneId":"M1","title":"Beta","amount":10000000},{"milestoneId":"M2","title":"Launch","amount":10000000}]', 'Caliper proposal terms']] },
    respondToInvestmentProposal: { shared: (c) => published(c.s, c.a, c.w, 0),
        prepare: async (c, i, sh) => { const id = H.uniqueId('PROP', c.w, i);
            return (await ok(c.s, B('createInvestmentProposal', c.a, [id, sh.campaignId, c.seed.investorId, sh.startupId, '20000000', 'USD', '10', '3 years', '[{"milestoneId":"M1","title":"Beta","amount":10000000}]', 'Caliper proposal terms']))) ? id : null; },
        run: (c, i, prop) => ['respondToInvestmentProposal', [prop, c.a.action || 'ACCEPT', '0', 'Accepted by Caliper', '[]']] },
    initializeToken: { run: (c, i) => { const sym = H.uniqueTokenSymbol(c.w, i); return ['initializeToken', [sym, `Token${sym}`, '18', '0', '10000000']]; } },
    mintTokens: { prepare: async (c, i) => { const sym = H.uniqueTokenSymbol(c.w, i), r = H.uniqueId('MINTACC', c.w, i);
            if (!await ok(c.s, B('initializeToken', c.a, [sym, `Token${sym}`, '18', '0', '100000000']))) return null;
            await H.ensureTokenAccount(c.s, c.a, r, 'USER'); return { sym, r }; },
        run: (c, i, p) => ['mintTokens', [p.sym, p.r, c.a.amount || '100']] },
    transferTokens: { prepare: async (c, i) => { const r = H.uniqueId('RCV', c.w, i); await H.ensureTokenAccount(c.s, c.a, r, 'USER'); return r; },
        run: (c, i, r) => ['transferTokens', [H.uniqueId('TRX', c.w, i), 'CFT', 'PLATFORM', r, c.a.amount || '1', 'INR', 'CALIPER_LOAD', '']] },
    submitMilestoneReport: { run: (c, i) => ['submitMilestoneReport', [H.uniqueId('MSR', c.w, i), c.seed.campaignId, c.seed.milestoneId || 'M1', c.seed.agreementId, 'Milestone report', 'Caliper milestone evidence', '["evidence.pdf"]']] },
    verifyMilestoneCompletion: { prepare: async (c, i) => {
            const b = await H.bootstrapCampaign(c.s, c.a, c.w, i); if (!b) return null;
            const reportId = H.uniqueId('MSR', c.w, i), agreementId = H.uniqueId('AGREE', c.w, i);
            const t = 'Milestone report', d = 'Caliper milestone evidence', e = '["evidence.pdf"]';
            if (!await ok(c.s, B('submitMilestoneReport', c.a, [reportId, b.campaignId, 'M1', agreementId, t, d, e]))) return null;
            return { ...b, reportHash: crypto.createHash('sha256').update(`${reportId}|${b.campaignId}|M1|${t}|${d}|${e}`).digest('hex') }; },
        run: (c, i, b) => ['verifyMilestoneCompletion', [H.uniqueId('MSV', c.w, i), 'M1', b.campaignId, b.startupId, b.reportHash, 'true', '9.0', 'Caliper verified', 'true']] },
    triggerFundRelease: { shared: async (c) => { const p = await published(c.s, c.a, c.w, 0); if (p) { await H.ensureTokenAccount(c.s, c.a, p.startupId, 'STARTUP'); await H.ensureTokenAccount(c.s, c.a, c.seed.investorId, 'INVESTOR'); } return p; },
        prepare: async (c, i, sh) => {
            const agreementId = H.uniqueId('AGREE', c.w, i), reportId = H.uniqueId('MSR', c.w, i), verificationId = H.uniqueId('MSV', c.w, i);
            const ms = '[{"milestoneId":"M1","title":"Beta Launch","amount":10000000}]';
            if (!await ok(c.s, B('witnessAgreement', c.a, [agreementId, sh.campaignId, sh.startupId, c.seed.investorId, '20000000', 'USD', ms]))) return null;
            if (!await ok(c.s, B('submitMilestoneReport', c.a, [reportId, sh.campaignId, 'M1', agreementId, 'Milestone report', 'Caliper milestone evidence', '["evidence.pdf"]']))) return null;
            if (!await ok(c.s, B('verifyMilestoneCompletion', c.a, [verificationId, 'M1', sh.campaignId, sh.startupId, reportId, 'true', '9.0', 'Caliper verified', 'true']))) return null;
            if (!await H.ensureMilestoneVerificationShared(c.s, c.a, verificationId)) return null;
            return { agreementId, verificationId }; },
        run: (c, i, p, sh) => ['triggerFundRelease', [H.uniqueId('REL', c.w, i), `ESCROW_${p.agreementId}`, p.agreementId, sh.campaignId, 'M1', sh.startupId, c.a.amount || '10000', p.verificationId]] },
    createDispute: { shared: async (c) => { const p = await published(c.s, c.a, c.w, 0); if (p) await H.ensureTokenAccount(c.s, c.a, p.startupId, 'STARTUP'); return p; },
        prepare: async (c, i, sh) => {
            const investorId = H.uniqueId('INVESTOR', c.w, i), agreementId = H.uniqueId('AGREE', c.w, i);
            if (!await ok(c.s, B('registerInvestor', c.a, [investorId, `Dispute Investor ${investorId}`, '25000000', String(300000000000 + c.w * 100000 + i), (`DSP${c.w}${String(i).padStart(4, '0')}Z`).slice(0, 10)]))) return null;
            await H.ensureTokenAccount(c.s, c.a, investorId, 'INVESTOR');
            if (!await okRetry(c.s, () => B('transferTokens', c.a, [H.uniqueId('TRX', c.w, i), 'CFT', 'PLATFORM', investorId, '5000', 'INR', 'DISPUTE_FUNDING', '']))) return null;
            if (!await ok(c.s, B('witnessAgreement', c.a, [agreementId, sh.campaignId, sh.startupId, investorId, '20000000', 'USD', '[{"milestoneId":"M1","title":"Beta","amount":10000000}]']))) return null;
            return { investorId, agreementId }; },
        run: (c, i, p, sh) => ['createDispute', [H.uniqueId('DISPUTE', c.w, i), 'INVESTOR', p.investorId, 'STARTUP', sh.startupId, 'MILESTONE_DISPUTE', sh.campaignId, p.agreementId, 'Caliper dispute', 'Load-test dispute filing', c.a.claimAmount || '1000']] },
    collectCampaignFee: { run: (c, i) => ['collectCampaignFee', [H.uniqueId('CFEE', c.w, i), c.seed.campaignId, c.seed.startupId, '50000', '5']] },
    setFeeTiers: { run: (c, i) => { const n = crypto.randomBytes(2).readUInt16BE(0); const id = (`C${c.w}${i}${n.toString(16)}`).slice(0, 16); const base = c.w * 10000000 + i * 1000 + n;
        return ['setCampaignFeeTier', [id, String(base), String(base + 999), '5', `Caliper campaign tier ${id}`]]; } },
    deleteCampaign: { prepare: (c, i) => H.bootstrapCampaign(c.s, c.a, c.w, i), run: (c, i, b) => ['deleteCampaign', [b.campaignId, 'Caliper delete']] },
    withdrawInvestment: { shared: (c) => published(c.s, c.a, c.w, 0),
        prepare: async (c, i, sh) => { const id = H.uniqueId('INVEST', c.w, i);
            return (await ok(c.s, B('makeInvestment', c.a, [id, sh.campaignId, c.seed.investorId, '20000000', 'USD']))) ? id : null; },
        run: (c, i, inv) => ['withdrawInvestment', [inv]] },
    requestRefund: { run: (c, i) => ['requestRefund', [H.uniqueId('REF', c.w, i), c.seed.investorId, c.seed.campaignId, c.seed.agreementId, c.seed.startupId, '20000000', '20000000', 'Caliper refund', '10']] },
    closeCampaign: { prepare: (c, i) => published(c.s, c.a, c.w, i), run: (c, i, b) => ['closeCampaign', [H.uniqueId('CLOSE', c.w, i), b.campaignId, c.a.finalStatus || 'SUCCESSFUL', 'Caliper close']] },
};

// stands in for a prerequisite that could not be prepared: every field reads 'PREP_MISSING'
const MISSING = new Proxy({}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 'PREP_MISSING' : (k === 'toString' ? () => 'PREP_MISSING' : 'PREP_MISSING')) });

class IsolatedWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.args = roundArguments || {};
        this.op = OPS[this.args.op];
        if (!this.op) throw new Error(`unknown op ${this.args.op}`);
        this.ctx = { s: sutAdapter, a: this.args, w: workerIndex, seed: loadSeedState(this.args) };
        this.txIndex = 0;
        this.pool = [];
        this.sharedItem = this.op.shared ? await this.op.shared(this.ctx) : null;
        if (this.op.prepare) {
            const n = Number(this.args.poolSize || 50), items = new Array(n);
            let next = 0;
            const lane = async () => { while (next < n) { const i = next++; items[i] = await this.op.prepare(this.ctx, i + 1, this.sharedItem) || await this.op.prepare(this.ctx, n + i + 1, this.sharedItem); } };
            await Promise.all(Array.from({ length: Math.min(PREP_CONCURRENCY, n) }, lane));
            this.pool = items.filter(Boolean);
        }
        // dual: published campaigns reach the investment channel through the bridge
        if (H.archOf(this.args) === 'dual' && (this.op.shared || this.args.op === 'closeCampaign')) await sleep(BRIDGE_WAIT_MS);
        this.prepared = this.op.prepare ? this.pool.length : null;
        console.log(`[isolated] ${this.args.op} worker ${workerIndex}: prepared ${this.op.prepare ? `${this.pool.length}/${this.args.poolSize}` : 'n/a'} shared ${this.op.shared ? (this.sharedItem ? 'ok' : 'FAILED') : 'n/a'}`);
    }

    async submitTransaction() {
        this.txIndex++;
        let item = null;
        if (this.op.prepare) {
            item = this.pool[(this.txIndex - 1) % Math.max(1, this.pool.length)];
            // no prerequisites could be prepared: still submit the named operation (it fails and is counted),
            // otherwise Caliper's submitted-transaction counter never reaches txNumber and the round never ends
            if (!item) item = MISSING;
        }
        let op, raw;
        try { [op, raw] = this.op.run(this.ctx, this.txIndex, item, this.sharedItem || MISSING); }
        catch (e) { op = this.args.op === 'setFeeTiers' ? 'setCampaignFeeTier' : this.args.op; raw = ['PREP_MISSING']; } // never skip a submission
        const args = raw.map((x) => (typeof x === 'string' ? x : (x === undefined || typeof x === 'object' ? 'PREP_MISSING' : String(x))));
        await H.sendTimed(this.sutAdapter, H.buildRequest(op, this.args, args));
    }
}

module.exports.createWorkloadModule = () => new IsolatedWorkload();
