'use strict';
const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, sendTimed } = require('./helpers');

/** P16: SubmitMilestoneReport */
class SubmitMilestoneReportWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex; this.txIndex = 0; this.args = roundArguments || {};
        this.campaignId = this.args.campaignId || 'CAMP001';
        this.startupId = this.args.startupId || 'STARTUP001';
        this.agreementId = this.args.agreementId || 'AGREEMENT001';
        this.milestoneId = this.args.milestoneId || 'M1';
    }
    async submitTransaction() {
        this.txIndex++;
        await sendTimed(this.sutAdapter, buildRequest('submitMilestoneReport', this.args, [
            uniqueId('MSR', this.workerIndex, this.txIndex),
            this.campaignId, this.milestoneId, this.agreementId,
            'Milestone report', 'Caliper milestone evidence', '["evidence.pdf"]'
        ]));
    }
}
function createWorkloadModule() { return new SubmitMilestoneReportWorkload(); }
module.exports.createWorkloadModule = createWorkloadModule;
