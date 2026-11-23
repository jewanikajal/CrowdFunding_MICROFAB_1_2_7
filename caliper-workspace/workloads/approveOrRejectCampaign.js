'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapCampaign, sendOk } = require('./helpers');

/**
 * P05: Per-tx pipeline: create → submit → validate → ApproveOrRejectCampaign.
 */
class ApproveOrRejectCampaignWorkload extends WorkloadModuleBase {
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
        if (!await sendOk(this.sutAdapter, buildRequest('submitForValidation', this.args, [
            boot.campaignId, '["business_plan.pdf"]', 'Caliper approve path'
        ]))) {
            return;
        }
        const validationId = uniqueId('VAL', this.workerIndex, this.txIndex);
        if (!await sendOk(this.sutAdapter, buildRequest('validateCampaign', this.args, [
            validationId, boot.campaignId, 'VALIDATOR001', 'caliper_hash', '["business_plan.pdf"]'
        ]))) {
            return;
        }
        await sendOk(this.sutAdapter, buildRequest('approveOrRejectCampaign', this.args, [
            validationId, boot.campaignId, 'APPROVED',
            '8.5', '2.5', 'LOW', '["Caliper approve"]', '[]', ''
        ]));
    }
}

function createWorkloadModule() {
    return new ApproveOrRejectCampaignWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
