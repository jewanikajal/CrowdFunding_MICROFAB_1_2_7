'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { uniqueId, buildRequest, archOf, sendTimed } = require('./helpers');

class RegisterInvestorWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
    }

    async submitTransaction() {
        this.txIndex++;
        const arch = archOf(this.args);
        const investorId = arch === 'single'
            ? uniqueId('INVESTOR', this.workerIndex, this.txIndex)
            : uniqueId('INV', this.workerIndex, this.txIndex);

        // SEBI min income in contracts is 20,000,000
        const income = this.args.annualIncome || '25000000';
        const aadhar = String(200000000000 + (this.workerIndex * 100000) + this.txIndex);
        // 10-char PAN-like: 5 letters + 4 digits + 1 letter
        const pan = `CALI${String(this.workerIndex)}${String(this.txIndex).padStart(4, '0')}Z`.slice(0, 10);

        await sendTimed(this.sutAdapter, buildRequest('registerInvestor', this.args, [
            investorId,
            `Investor ${investorId}`,
            income,
            aadhar,
            pan
        ]));
    }
}

function createWorkloadModule() {
    return new RegisterInvestorWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
