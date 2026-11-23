'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapForInvestment, sendOk } = require('./helpers');

/** P09: ViewCampaign — creates public campaign then views it. */
class ViewCampaignWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.investorId = this.args.investorId || 'INVESTOR001';
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapForInvestment(this.sutAdapter, this.args, this.workerIndex, this.txIndex);
        if (!boot) {
            return;
        }
        await sendOk(this.sutAdapter, buildRequest('viewCampaign', this.args, [
            uniqueId('VIEW', this.workerIndex, this.txIndex), boot.campaignId, this.investorId
        ]));
    }
}

function createWorkloadModule() {
    return new ViewCampaignWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
