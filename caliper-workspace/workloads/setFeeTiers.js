'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const crypto = require('crypto');
const { buildRequest, sendOk } = require('./helpers');

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/** Unique tier args for measured or preflight invokes. */
function buildTier(workerIndex, txIndex) {
    const nonce = crypto.randomBytes(2).readUInt16BE(0);
    const tierId = (`C${workerIndex}${txIndex}${nonce.toString(16)}`).slice(0, 16);
    const base = (workerIndex * 10000000) + (txIndex * 1000) + nonce;
    return [tierId, String(base), String(base + 999), '5', `Caliper campaign tier ${tierId}`];
}

/**
 * P21: SetCampaignFeeTiers with unique tier IDs.
 * Prepare-phase preflight (observer inactive) waits for Platform write path —
 * not counted in round Succ/Fail/TPS. Measured submitTransaction unchanged.
 */
class SetFeeTiersWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};

        // Prepare-phase only (not counted). Never throw — a failed preflight must not abort the suite.
        try {
            const maxWaitMs = parseInt(this.args.preflightMaxWaitMs || '120000', 10);
            const pollMs = parseInt(this.args.preflightPollMs || '2000', 10);
            const deadline = Date.now() + maxWaitMs;
            let seq = 0;
            while (Date.now() < deadline) {
                seq++;
                const ok = await sendOk(
                    sutAdapter,
                    buildRequest('setCampaignFeeTier', this.args, buildTier(workerIndex, 900000 + seq)),
                    20000
                );
                if (ok) {
                    return;
                }
                await sleep(pollMs);
            }
        } catch (e) {
            // continue into measured round
        }
    }

    async submitTransaction() {
        this.txIndex++;
        await sendOk(this.sutAdapter, buildRequest('setCampaignFeeTier', this.args, buildTier(this.workerIndex, this.txIndex)));
    }
}

function createWorkloadModule() {
    return new SetFeeTiersWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
