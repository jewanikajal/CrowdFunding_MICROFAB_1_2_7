'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapForInvestment, ensureTokenAccount, sendOk } = require('./helpers');
const { loadSeedState } = require('./seedState');

/**
 * P19: Per-tx funded initiator + witnessed agreement → CreateDispute.
 * Soft-fail on any step so rounds finish under Microfab stress.
 */
class CreateDisputeWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.seed = loadSeedState(this.args);
        this.claimAmount = this.args.claimAmount || '1000';
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapForInvestment(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            return;
        }
        const { startupId, campaignId } = boot;
        const investorId = uniqueId('INVESTOR', this.workerIndex, this.txIndex);
        const agreementId = uniqueId('AGREE', this.workerIndex, this.txIndex);

        const aadhar = String(300000000000 + (this.workerIndex * 100000) + this.txIndex);
        const pan = (`DSP${this.workerIndex}${String(this.txIndex).padStart(4, '0')}Z`).slice(0, 10);
        if (!await sendOk(this.sutAdapter, buildRequest('registerInvestor', this.args, [
            investorId, `Dispute Investor ${investorId}`, '25000000', aadhar, pan
        ]))) {
            return;
        }

        await ensureTokenAccount(this.sutAdapter, this.args, investorId, 'INVESTOR');
        await ensureTokenAccount(this.sutAdapter, this.args, startupId, 'STARTUP');

        if (!await sendOk(this.sutAdapter, buildRequest('transferTokens', this.args, [
            uniqueId('TRX', this.workerIndex, this.txIndex),
            'CFT', 'PLATFORM', investorId, '5000', 'INR', 'DISPUTE_FUNDING', ''
        ]))) {
            return;
        }

        const milestones = '[{"milestoneId":"M1","title":"Beta","amount":10000000}]';
        if (!await sendOk(this.sutAdapter, buildRequest('witnessAgreement', this.args, [
            agreementId, campaignId, startupId, investorId, '20000000', 'USD', milestones
        ]))) {
            return;
        }

        await sendOk(this.sutAdapter, buildRequest('createDispute', this.args, [
            uniqueId('DISPUTE', this.workerIndex, this.txIndex),
            'INVESTOR', investorId, 'STARTUP', startupId,
            'MILESTONE_DISPUTE', campaignId, agreementId,
            'Caliper dispute', 'Load-test dispute filing', this.claimAmount
        ]));
    }
}

function createWorkloadModule() {
    return new CreateDisputeWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
