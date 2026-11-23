'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { buildRequest, bootstrapApprovedCampaign, sendOk } = require('./helpers');

/** P07: Fresh approved campaign → share → PublishCampaignToPortal. */
class PublishCampaignToPortalWorkload extends WorkloadModuleBase {
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
        if (!await sendOk(this.sutAdapter, buildRequest('shareCampaignToPlatform', this.args, [
            boot.campaignId, boot.proof
        ]))) {
            return;
        }
        await sendOk(this.sutAdapter, buildRequest('publishCampaignToPortal', this.args, [
            boot.campaignId, boot.proof
        ]));
    }
}

function createWorkloadModule() {
    return new PublishCampaignToPortalWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
