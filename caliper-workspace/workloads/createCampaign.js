'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, campaignArgs, sendTimed } = require('./helpers');

/**
 * Self-contained CreateCampaign: creates a unique startup then a campaign under it.
 * Does NOT require seed STARTUP001 (avoids "startup not found" when seed failed).
 * Each submitTransaction issues 2 Fabric txs (startup + campaign).
 */
class CreateCampaignWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        // If fixedStartupId is set, use seed startup only (1 tx per submit).
        this.fixedStartupId = this.args.fixedStartupId || this.args.startupId || null;
        this.selfContained = this.args.selfContained !== false && !this.args.fixedStartupId;
    }

    async submitTransaction() {
        this.txIndex++;
        let startupId = this.fixedStartupId;

        if (this.selfContained || !startupId) {
            startupId = uniqueId('STARTUP', this.workerIndex, this.txIndex);
            await sendTimed(this.sutAdapter, buildRequest('createStartup', this.args, [
                startupId,
                `STU_${this.workerIndex}_${this.txIndex}`,
                `Startup ${startupId}`,
                `Bootstrap for campaign`,
                `S-${this.workerIndex}-${this.txIndex}`
            ]));
        }

        const campaignId = uniqueId('CAMP', this.workerIndex, this.txIndex);
        await sendTimed(this.sutAdapter, buildRequest(
            'createCampaign',
            this.args,
            campaignArgs(campaignId, startupId)
        ));
    }
}

function createWorkloadModule() {
    return new CreateCampaignWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
