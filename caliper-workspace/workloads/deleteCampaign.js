'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { buildRequest, bootstrapCampaign, sendOk } = require('./helpers');

/** P22: bootstrap campaign then DeleteCampaign. */
class DeleteCampaignWorkload extends WorkloadModuleBase {
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
        await sendOk(this.sutAdapter, buildRequest('deleteCampaign', this.args, [
            boot.campaignId, 'Caliper delete'
        ]));
    }
}

function createWorkloadModule() {
    return new DeleteCampaignWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
