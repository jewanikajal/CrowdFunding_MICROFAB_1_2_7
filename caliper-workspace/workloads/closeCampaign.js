'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapPublishedCampaign, sendOk } = require('./helpers');

/** P25: Fresh published campaign per tx → CloseCampaign. */
class CloseCampaignWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapPublishedCampaign(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            return;
        }
        await sendOk(this.sutAdapter, buildRequest('closeCampaign', this.args, [
            uniqueId('CLOSE', this.workerIndex, this.txIndex),
            boot.campaignId,
            this.args.finalStatus || 'SUCCESSFUL',
            'Caliper close'
        ]));
    }
}

function createWorkloadModule() {
    return new CloseCampaignWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
