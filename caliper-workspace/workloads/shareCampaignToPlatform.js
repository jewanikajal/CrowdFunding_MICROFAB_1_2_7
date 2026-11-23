'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { buildRequest, bootstrapApprovedCampaign, sendOk } = require('./helpers');

/** P06: Fresh approved campaign per tx → ShareCampaignToPlatform with queried proof hash. */
class ShareCampaignToPlatformWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapApprovedCampaign(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            return;
        }
        await sendOk(this.sutAdapter, buildRequest('shareCampaignToPlatform', this.args, [
            boot.campaignId, boot.proof
        ]));
    }
}

function createWorkloadModule() {
    return new ShareCampaignToPlatformWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
