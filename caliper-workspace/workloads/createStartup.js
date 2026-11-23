'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, sendTimed } = require('./helpers');

class CreateStartupWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
    }

    async submitTransaction() {
        this.txIndex++;
        const startupId = uniqueId('STARTUP', this.workerIndex, this.txIndex);
        const ownerId = `STU_${this.workerIndex}_${this.txIndex}`;

        await sendTimed(this.sutAdapter, buildRequest('createStartup', this.args, [
            startupId,
            ownerId,
            `Startup ${startupId}`,
            `Caliper-generated startup ${startupId}`,
            `S-${this.workerIndex}-${this.txIndex}`
        ]));
    }
}

function createWorkloadModule() {
    return new CreateStartupWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
