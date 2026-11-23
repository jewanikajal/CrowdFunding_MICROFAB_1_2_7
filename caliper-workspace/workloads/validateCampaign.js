'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapCampaign, sendOk } = require('./helpers');

/** P04: bootstrap → submit → ValidateCampaign */
class ValidateCampaignWorkload extends WorkloadModuleBase {
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
            boot.campaignId, '["business_plan.pdf"]', 'Caliper validation request'
        ]))) {
            return;
        }
        const validationId = uniqueId('VAL', this.workerIndex, this.txIndex);
        await sendOk(this.sutAdapter, buildRequest('validateCampaign', this.args, [
            validationId, boot.campaignId, 'VALIDATOR001',
            this.args.submissionHash || 'caliper_submission_hash_placeholder',
            '["business_plan.pdf"]'
        ]));
    }
}

function createWorkloadModule() {
    return new ValidateCampaignWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
