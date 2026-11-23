'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapForInvestment, sendOk, sendTimed } = require('./helpers');
const { loadSeedState } = require('./seedState');

/** P23: Bootstrap published campaign → MakeInvestment → WithdrawInvestment. */
class WithdrawInvestmentWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.seed = loadSeedState(this.args);
        this.investorId = this.args.investorId || this.seed.investorId || 'INVESTOR001';
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapForInvestment(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            return;
        }
        const investmentId = uniqueId('INVEST', this.workerIndex, this.txIndex);
        if (!await sendOk(this.sutAdapter, buildRequest('makeInvestment', this.args, [
            investmentId, boot.campaignId, this.investorId, '20000000', 'USD'
        ]))) {
            return;
        }
        await sendTimed(this.sutAdapter, buildRequest('withdrawInvestment', this.args, [investmentId]));
    }
}

function createWorkloadModule() {
    return new WithdrawInvestmentWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
