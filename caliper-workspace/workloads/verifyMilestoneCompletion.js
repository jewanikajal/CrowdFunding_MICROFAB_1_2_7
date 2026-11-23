'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');
const { uniqueId, buildRequest, bootstrapCampaign, sendOk } = require('./helpers');

/** P17: Submit milestone report then VerifyMilestoneCompletion with matching report hash. */
class VerifyMilestoneCompletionWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapCampaign(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            return;
        }
        const { startupId, campaignId } = boot;
        const milestoneId = this.args.milestoneId || 'M1';
        const agreementId = uniqueId('AGREE', this.workerIndex, this.txIndex);
        const reportId = uniqueId('MSR', this.workerIndex, this.txIndex);
        const title = 'Milestone report';
        const description = 'Caliper milestone evidence';
        const evidenceJSON = '["evidence.pdf"]';

        if (!await sendOk(this.sutAdapter, buildRequest('submitMilestoneReport', this.args, [
            reportId, campaignId, milestoneId, agreementId, title, description, evidenceJSON
        ]))) {
            return;
        }

        const reportHash = crypto.createHash('sha256')
            .update(`${reportId}|${campaignId}|${milestoneId}|${title}|${description}|${evidenceJSON}`)
            .digest('hex');

        await sendOk(this.sutAdapter, buildRequest('verifyMilestoneCompletion', this.args, [
            uniqueId('MSV', this.workerIndex, this.txIndex),
            milestoneId, campaignId, startupId,
            reportHash, 'true', '9.0', 'Caliper verified', 'true'
        ]));
    }
}

function createWorkloadModule() {
    return new VerifyMilestoneCompletionWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
