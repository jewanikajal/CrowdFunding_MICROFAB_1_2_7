'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueTokenSymbol, buildRequest, sendOk } = require('./helpers');

/**
 * P13: InitializeToken with a crypto-unique symbol every tx (never reuses CFT).
 * initialSupply=0 avoids concurrent writes to the shared PLATFORM account (MVCC).
 */
class InitializeTokenWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.fixedSymbol = this.args.tokenSymbol || null;
    }

    async submitTransaction() {
        this.txIndex++;
        const symbol = this.fixedSymbol || uniqueTokenSymbol(this.workerIndex, this.txIndex);
        await sendOk(this.sutAdapter, buildRequest('initializeToken', this.args, [
            symbol, `Token${symbol}`, '18', '0', '10000000'
        ]));
    }
}

function createWorkloadModule() {
    return new InitializeTokenWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
