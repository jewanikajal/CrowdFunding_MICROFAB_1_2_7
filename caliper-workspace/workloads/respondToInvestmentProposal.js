'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, bootstrapForInvestment, sendOk } = require('./helpers');
const { loadSeedState } = require('./seedState');

/** P12: Unique proposal per tx → RespondToInvestmentProposal ACCEPT. */
class RespondToInvestmentProposalWorkload extends WorkloadModuleBase {
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
        if (!await sendOk(this.sutAdapter, buildRequest('createInvestmentProposal', this.args, [
            proposalId, campaignId, investorId, startupId,
            '20000000', 'USD', '10', '3 years', milestones, 'Caliper proposal terms'
        ]))) {
            return;
        }
        await sendOk(this.sutAdapter, buildRequest('respondToInvestmentProposal', this.args, [
            proposalId, this.args.action || 'ACCEPT', '0', 'Accepted by Caliper', '[]'
        ]));
    }
}

function createWorkloadModule() {
    return new RespondToInvestmentProposalWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
