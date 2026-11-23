'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, ensureTokenAccount, sendOk } = require('./helpers');

/**
 * P15: Unique recipient account (pre-created) ← TransferTokens from PLATFORM.
 * Avoids TransferTokens panic on inline account create. Soft-fail on PLATFORM MVCC.
 */
class TransferTokensWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.amount = this.args.amount || '1';
    }

    async submitTransaction() {
        this.txIndex++;
        const recipient = uniqueId('RCV', this.workerIndex, this.txIndex);
        await ensureTokenAccount(this.sutAdapter, this.args, recipient, 'USER');
        await sendOk(this.sutAdapter, buildRequest('transferTokens', this.args, [
            uniqueId('TRX', this.workerIndex, this.txIndex),
            'CFT', 'PLATFORM', recipient, this.amount, 'INR', 'CALIPER_LOAD', ''
        ]));
    }
}

function createWorkloadModule() {
    return new TransferTokensWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
