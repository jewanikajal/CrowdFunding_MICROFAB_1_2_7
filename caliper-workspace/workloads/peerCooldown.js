'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const { archOf, uniqueId, buildRequest, sendOk, queryJson } = require('./helpers');
const { loadSeedState } = require('./seedState');

/**
 * Cool-down between rounds. Does not change TPS of real ops.
 * Probes Microfab HTTP, GetCampaign (read), SetCampaignFeeTiers (Platform write),
 * and on dual/multi also CreateStartup (endorsement / peer readiness).
 */
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function httpGetStatus(urlStr, timeoutMs) {
    return new Promise((resolve) => {
        let settled = false;
        const done = (code) => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(code);
        };
        try {
            const u = new URL(urlStr);
            const lib = u.protocol === 'https:' ? https : http;
            const req = lib.get(u, { timeout: timeoutMs }, (res) => {
                res.resume();
                done(res.statusCode || 0);
            });
            req.on('timeout', () => {
                req.destroy();
                done(0);
            });
            req.on('error', () => done(0));
        } catch (e) {
            done(0);
        }
    });
}

/** Unique fee-tier args for a Platform write probe (not part of measured P21). */
function feeTierArgs(workerIndex, seq) {
    const nonce = crypto.randomBytes(2).readUInt16BE(0);
    const tierId = (`CD${workerIndex}${seq}${nonce.toString(16)}`).slice(0, 16);
    // High base range keeps cool-down bands away from measured P21 bands.
    const base = 800000000 + (workerIndex * 1000000) + (seq * 1000) + nonce;
    return [tierId, String(base), String(base + 999), '5', `cooldown tier ${tierId}`];
}

class PeerCooldownWorkload extends WorkloadModuleBase {
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
        this.workerIndex = workerIndex;
        this.txIndex = 0;
        this.args = roundArguments || {};
        this.seed = loadSeedState(this.args);
        this.campaignId = this.args.campaignId || this.seed.campaignId || 'CAMP001';

        const pauseMs = parseInt(this.args.pauseMs || '60000', 10);
        const arch = archOf(this.args);
        const defaultHealth = arch === 'dual'
            ? 'http://127.0.0.1:7070/ak/api/v1/health'
            : arch === 'multi'
                ? 'http://127.0.0.1:8080/ak/api/v1/health'
                : 'http://127.0.0.1:9090/ak/api/v1/health';
        const healthUrl = this.args.healthUrl || defaultHealth;
        const pollMs = parseInt(this.args.pollMs || '2000', 10);
        const maxWaitMs = parseInt(this.args.maxWaitMs || '180000', 10);
        const readyNeeded = parseInt(this.args.readyQueries || '2', 10);
        // Explicit probeGovernance wins. Default: CreateStartup probe on dual/multi only
        // when unset. Option A sets probeGovernance: false so cool-down does not keep
        // hammering a dead governance peer (was ignored because arch===dual always won).
        const pg = this.args.probeGovernance;
        let probeGov;
        if (pg === false || pg === 'false') {
            probeGov = false;
        } else if (pg === true || pg === 'true') {
            probeGov = true;
        } else {
            probeGov = arch === 'dual' || arch === 'multi';
        }

        await sleep(pauseMs + workerIndex * 2000);

        const deadline = Date.now() + maxWaitMs;
        let httpOk = 0;
        let queryOk = 0;
        let writeOk = 0;
        let govOk = 0;
        let seq = 0;
        let hardFailStreak = 0;
        const maxHardFail = parseInt(this.args.maxHardFail || '8', 10);
        while (Date.now() < deadline) {
            const needGov = probeGov && govOk < readyNeeded;
            if (httpOk >= readyNeeded && queryOk >= readyNeeded && writeOk >= readyNeeded && !needGov) {
                break;
            }

            const code = await httpGetStatus(healthUrl, 5000);
            if (code === 200) {
                httpOk++;
            } else {
                httpOk = 0;
            }

            const camp = await queryJson(sutAdapter, 'getCampaign', this.args, [this.campaignId]);
            if (camp) {
                queryOk++;
                hardFailStreak = 0;
            } else {
                queryOk = 0;
                hardFailStreak++;
            }

            seq++;
            const write = await sendOk(
                sutAdapter,
                buildRequest('setCampaignFeeTier', this.args, feeTierArgs(workerIndex, seq)),
                20000
            );
            if (write) {
                writeOk++;
                hardFailStreak = 0;
            } else {
                writeOk = 0;
                hardFailStreak++;
            }

            if (probeGov) {
                const sid = uniqueId('CDSTU', workerIndex, seq);
                const gov = await sendOk(
                    sutAdapter,
                    buildRequest('createStartup', this.args, [
                        sid, `CD_${workerIndex}_${seq}`, `Cooldown ${sid}`, 'peer cooldown probe', `CD-${workerIndex}-${seq}`
                    ]),
                    20000
                );
                if (gov) {
                    govOk++;
                    hardFailStreak = 0;
                } else {
                    govOk = 0;
                    hardFailStreak++;
                }
            }

            // Peers are dead (502/UNAVAILABLE): stop hammering; next measured round will fail honestly.
            if (hardFailStreak >= maxHardFail) {
                break;
            }

            await sleep(pollMs);
        }
    }

    async submitTransaction() {
        this.txIndex++;
        // Measured cool-down txs exercise the Platform write path P21 needs.
        await sendOk(
            this.sutAdapter,
            buildRequest('setCampaignFeeTier', this.args, feeTierArgs(this.workerIndex, this.txIndex + 1000)),
            20000
        );
    }
}

function createWorkloadModule() {
    return new PeerCooldownWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
