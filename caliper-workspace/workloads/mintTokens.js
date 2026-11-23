'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, uniqueTokenSymbol, buildRequest, ensureTokenAccount, sendOk } = require('./helpers');

/**
 * P14: Init unique token → create recipient account → MintTokens.
 * Avoids minting into shared CFT/PLATFORM (MVCC) and inline account-create panic.
 */
class MintTokensWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.amount = this.args.amount || '100';
    }

    async submitTransaction() {
        this.txIndex++;
        const symbol = uniqueTokenSymbol(this.workerIndex, this.txIndex);
        const recipient = uniqueId('MINTACC', this.workerIndex, this.txIndex);

        if (!await sendOk(this.sutAdapter, buildRequest('initializeToken', this.args, [
            symbol, `Token${symbol}`, '18', '0', '100000000'
        ]))) {
            return;
        }

        await ensureTokenAccount(this.sutAdapter, this.args, recipient, 'USER');

        await sendOk(this.sutAdapter, buildRequest('mintTokens', this.args, [
            symbol, recipient, this.amount
        ]));
    }
}

function createWorkloadModule() {
    return new MintTokensWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
