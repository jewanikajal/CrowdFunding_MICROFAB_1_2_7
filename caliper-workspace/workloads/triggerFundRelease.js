'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const {
    uniqueId, buildRequest, bootstrapPublishedCampaign, sendOk, sendTimed,
    ensureTokenAccount, ensureMilestoneVerificationShared, isCommitted
} = require('./helpers');
const { loadSeedState } = require('./seedState');

/** Lightweight step-fail counters (option 1) — sampled so stress stays readable. */
const stepFails = Object.create(null);
function noteStepFail(step) {
    stepFails[step] = (stepFails[step] || 0) + 1;
    const n = stepFails[step];
    if (n <= 5 || n % 25 === 0) {
        console.warn(`[P18] step fail: ${step} (count=${n})`);
    }
}

/**
 * P18: Per-tx prep then TriggerFundRelease.
 * Needs published campaign (multi/dual), WitnessAgreement (ESCROW_<agreementId>),
 * milestone report, VerifyMilestoneCompletion, ShareMilestoneValidationToPlatform
 * (with retry until MILESTONE_VERIFICATION_<id> is visible), then release.
 */
class TriggerFundReleaseWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.seed = loadSeedState(this.args);
        this.amount = this.args.amount || '10000';
        this.milestoneId = this.args.milestoneId || 'M1';
    }

    async submitTransaction() {
        this.txIndex++;
        // Option 2: full publish path so platform-side release has campaign context.
        const boot = await bootstrapPublishedCampaign(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            noteStepFail('bootstrapPublishedCampaign');
            return;
        }
        const { startupId, campaignId } = boot;
        const investorId = this.seed.investorId || 'INVESTOR001';
        const agreementId = uniqueId('AGREE', this.workerIndex, this.txIndex);
        const escrowId = `ESCROW_${agreementId}`;
        const reportId = uniqueId('MSR', this.workerIndex, this.txIndex);
        const verificationId = uniqueId('MSV', this.workerIndex, this.txIndex);
        const milestones = '[{"milestoneId":"M1","title":"Beta Launch","amount":10000000}]';

        await ensureTokenAccount(this.sutAdapter, this.args, startupId, 'STARTUP');
        await ensureTokenAccount(this.sutAdapter, this.args, investorId, 'INVESTOR');

        if (!await sendOk(this.sutAdapter, buildRequest('witnessAgreement', this.args, [
            agreementId, campaignId, startupId, investorId, '20000000', 'USD', milestones
        ]))) {
            noteStepFail('witnessAgreement');
            return;
        }

        if (!await sendOk(this.sutAdapter, buildRequest('submitMilestoneReport', this.args, [
            reportId, campaignId, this.milestoneId, agreementId,
            'Milestone report', 'Caliper milestone evidence', '["evidence.pdf"]'
        ]))) {
            noteStepFail('submitMilestoneReport');
            return;
        }

        if (!await sendOk(this.sutAdapter, buildRequest('verifyMilestoneCompletion', this.args, [
            verificationId, this.milestoneId, campaignId, startupId,
            reportId, 'true', '9.0', 'Caliper verified', 'true'
        ]))) {
            noteStepFail('verifyMilestoneCompletion');
            return;
        }

        // Retry Share until MILESTONE_VERIFICATION_<id> lands on ValidatorPlatformCollection.
        if (!await ensureMilestoneVerificationShared(
            this.sutAdapter, this.args, verificationId
        )) {
            noteStepFail('shareMilestoneValidationToPlatform');
            return;
        }

        const status = await sendTimed(this.sutAdapter, buildRequest('triggerFundRelease', this.args, [
            uniqueId('REL', this.workerIndex, this.txIndex),
            escrowId, agreementId, campaignId, this.milestoneId,
            startupId, this.amount, verificationId
        ]));
        if (!isCommitted(status)) {
            noteStepFail('triggerFundRelease');
        }
    }
}

function createWorkloadModule() {
    return new TriggerFundReleaseWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
