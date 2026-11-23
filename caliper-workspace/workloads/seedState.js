'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Load seed-state.json written by scripts/seed-single-full.sh
 * Falls back to defaults used in benchconfigs.
 */
function loadSeedState(overrides) {
    const defaults = {
        arch: 'single',
        startupId: 'STARTUP001',
        campaignId: 'CAMP001',
        validationId: 'VAL001',
        investorId: 'INVESTOR001',
        proposalId: 'PROPOSAL001',
        agreementId: 'AGREEMENT001',
        submissionHash: '',
        validationProofHash: ''
    };
    let fromFile = {};
    const candidates = [
        path.resolve(__dirname, '..', 'seed-state.json'),
        path.resolve(process.cwd(), 'seed-state.json')
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                fromFile = JSON.parse(fs.readFileSync(p, 'utf8'));
                break;
            }
        } catch (e) {
            // ignore
        }
    }
    return Object.assign({}, defaults, fromFile, overrides || {});
}

module.exports = { loadSeedState };
