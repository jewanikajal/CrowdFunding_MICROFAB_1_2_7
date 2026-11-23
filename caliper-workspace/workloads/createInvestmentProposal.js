'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapForInvestment, sendTimed } = require('./helpers');
const { loadSeedState } = require('./seedState');

/**
 * P11: Bootstrap published campaign then CreateInvestmentProposal.
 * Chaincode rejects proposals unless campaign status is PUBLISHED on common-channel.
 */
class CreateInvestmentProposalWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.seed = loadSeedState(this.args);
    }

    async submitTransaction() {
        this.txIndex++;
        const boot = await bootstrapForInvestment(
            this.sutAdapter, this.args, this.workerIndex, this.txIndex
        );
        if (!boot) {
            return;
        }
        const { startupId, campaignId } = boot;
        const investorId = this.seed.investorId || 'INVESTOR001';
        const proposalId = uniqueId('PROP', this.workerIndex, this.txIndex);
        const milestones = '[{"milestoneId":"M1","title":"Beta","amount":10000000},{"milestoneId":"M2","title":"Launch","amount":10000000}]';
        await sendTimed(this.sutAdapter, buildRequest('createInvestmentProposal', this.args, [
            proposalId, campaignId, investorId, startupId,
            '20000000', 'USD', '10', '3 years', milestones, 'Caliper proposal terms'
        ]));
    }
}

function createWorkloadModule() {
    return new CreateInvestmentProposalWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
