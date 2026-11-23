'use strict';
const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, sendTimed } = require('./helpers');

/** P24: RequestRefund */
class RequestRefundWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex; this.txIndex = 0; this.args = roundArguments || {};
        this.investorId = this.args.investorId || 'INVESTOR001';
        this.campaignId = this.args.campaignId || 'CAMP001';
        this.startupId = this.args.startupId || 'STARTUP001';
        this.agreementId = this.args.agreementId || 'AGREEMENT001';
    }
    async submitTransaction() {
        this.txIndex++;
        await sendTimed(this.sutAdapter, buildRequest('requestRefund', this.args, [
            uniqueId('REF', this.workerIndex, this.txIndex),
            this.investorId, this.campaignId, this.agreementId, this.startupId,
            '20000000', '20000000', 'Caliper refund', '10'
        ]));
    }
}
function createWorkloadModule() { return new RequestRefundWorkload(); }
module.exports.createWorkloadModule = createWorkloadModule;
