'use strict';
const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, sendTimed } = require('./helpers');

/** P20: CollectCampaignFee */
class CollectCampaignFeeWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex; this.txIndex = 0; this.args = roundArguments || {};
        this.campaignId = this.args.campaignId || 'CAMP001';
        this.startupId = this.args.startupId || 'STARTUP001';
    }
    async submitTransaction() {
        this.txIndex++;
        await sendTimed(this.sutAdapter, buildRequest('collectCampaignFee', this.args, [
            uniqueId('CFEE', this.workerIndex, this.txIndex),
            this.campaignId, this.startupId, '50000', '5'
        ]));
    }
}
function createWorkloadModule() { return new CollectCampaignFeeWorkload(); }
module.exports.createWorkloadModule = createWorkloadModule;
