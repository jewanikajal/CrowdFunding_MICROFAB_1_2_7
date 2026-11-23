'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapForInvestment, sendTimed } = require('./helpers');
const { loadSeedState } = require('./seedState');

/**
 * P10: Publish a fresh campaign (bootstrap) then MakeInvestment.
 * Multi CreateInvestmentProposal requires PUBLISHED on common-channel; same
 * bootstrap path as P12 keeps investment ops self-contained under load.
 */
class MakeInvestmentWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.seed = loadSeedState(this.args);
        this.investorId = this.args.investorId || this.seed.investorId || 'INVESTOR001';
        this.amount = this.args.amount || '20000000';
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapForInvestment(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            return;
        }
        await sendTimed(this.sutAdapter, buildRequest('makeInvestment', this.args, [
            uniqueId('INVEST', this.workerIndex, this.txIndex),
            boot.campaignId, this.investorId, this.amount, 'USD'
        ]));
    }
}

function createWorkloadModule() {
    return new MakeInvestmentWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
