'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { buildRequest, bootstrapCampaign, sendOk } = require('./helpers');

/** P03: create campaign then SubmitForValidation (multi-tx per submit). */
class SubmitForValidationWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapCampaign(this.sutAdapter, this.args, this.workerIndex, this.txIndex);
        if (!boot) {
            return;
        }
        await sendOk(this.sutAdapter, buildRequest('submitForValidation', this.args, [
            boot.campaignId, '["business_plan.pdf"]', `Caliper submit ${boot.campaignId}`
        ]));
    }
}

function createWorkloadModule() {
    return new SubmitForValidationWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
