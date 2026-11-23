'use strict';

/**
 * Shared helpers for Caliper workloads across single / dual / multi architectures.
 *
 * Multi-step pipelines stay intact. sendTimed() adds a hard timeout so a dead
 * Microfab/gRPC call fails the Caliper tx instead of freezing the whole round.
 */

const crypto = require('crypto');

/** Per sendRequests timeout (ms). Override with CALIPER_TX_TIMEOUT_MS. */
const TX_TIMEOUT_MS = parseInt(process.env.CALIPER_TX_TIMEOUT_MS || '30000', 10);

function archOf(workerArgs) {
    return (workerArgs && workerArgs.arch) || 'single';
}

/** Minimal failed TxStatus so callers can soft-return without aborting the round. */
function failedStatus() {
    return {
        IsCommitted: () => false,
        GetResult: () => '',
        GetStatus: () => false
    };
}

/**
 * Like sutAdapter.sendRequests, with a hard timeout so rounds cannot hang forever.
 * Never throws — returns a failed status on timeout / unexpected errors so Caliper
 * can count Fail and continue (PeerGateway already records Fail for endorse errors).
 */
// v3 adaptation: per-function operation log (does not change Caliper's own statistics). One JSON line per
// request: time, contract function, read/write, committed. Used to report the named operation of each
// round separately from its prerequisite transactions (Caliper aggregates all of them per round).
const OPLOG_DIR = process.env.CALIPER_OPLOG_DIR || '';
let oplogStream = null;
function oplog(request, ok) {
    if (!OPLOG_DIR) {
        return;
    }
    try {
        if (!oplogStream) {
            require('fs').mkdirSync(OPLOG_DIR, { recursive: true });
            oplogStream = require('fs').createWriteStream(`${OPLOG_DIR}/ops-${process.pid}.jsonl`, { flags: 'a' });
        }
        oplogStream.write(JSON.stringify({ t: Date.now(), fcn: request.contractFunction, ro: !!request.readOnly, ok }) + '\n');
    } catch (e) { /* never break the benchmark */ }
}

async function sendTimed(sutAdapter, request, timeoutMs) {
    const status = await sendTimedInner(sutAdapter, request, timeoutMs);
    oplog(request, isCommitted(status));
    return status;
}

async function sendTimedInner(sutAdapter, request, timeoutMs) {
    const ms = Math.max(1000, parseInt(timeoutMs || TX_TIMEOUT_MS, 10) || 30000);
    let timer;
    // Yield once so fire-and-forget rate-control loops cannot starve gRPC I/O.
    await new Promise((r) => setImmediate(r));
    const pending = sutAdapter.sendRequests(request);
    try {
        return await Promise.race([
            pending,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(`Caliper tx timed out after ${ms}ms (peer hung / channel down)`));
                }, ms);
            })
        ]);
    } catch (e) {
        // Let the orphaned request finish so Caliper can mark Finished (avoids Unfinished wedge).
        if (pending && typeof pending.then === 'function') {
            pending.then(() => {}, () => {});
        }
        return failedStatus();
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

/** v3 dual: time to wait for the cross-channel bridge after publishing (ms). */
const BRIDGE_WAIT_MS = Number(process.env.BRIDGE_WAIT_MS || 4000);

function uniqueId(prefix, workerIndex, txIndex) {
    return `${prefix}_W${workerIndex}_T${txIndex}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
}

/** Short unique token symbol (≤12 chars) — avoids Date.now() collisions under high TPS. */
function uniqueTokenSymbol(workerIndex, txIndex) {
    return (`T${workerIndex.toString(16)}${txIndex.toString(16)}${crypto.randomBytes(4).toString('hex')}`).slice(0, 12);
}

const OP_MAP = {
    single: {
        createStartup: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:CreateStartup' },
        createCampaign: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:CreateCampaign' },
        submitForValidation: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:SubmitForValidation' },
        validateCampaign: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'ValidatorContract:ValidateCampaign' },
        approveOrRejectCampaign: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'ValidatorContract:ApproveOrRejectCampaign' },
        shareCampaignToPlatform: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:ShareCampaignToPlatform' },
        publishCampaignToPortal: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:PublishCampaignToPortal' },
        getCampaign: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:GetCampaign' },
        registerInvestor: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'InvestorContract:RegisterInvestor' },
        viewCampaign: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'InvestorContract:ViewCampaign' },
        makeInvestment: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'InvestorContract:MakeInvestment' },
        createInvestmentProposal: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'InvestorContract:CreateInvestmentProposal' },
        respondToInvestmentProposal: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:RespondToInvestmentProposal' },
        initializeToken: { channel: 'crowdfunding-channel', contractId: 'cftoken', fcn: 'TokenContract:InitializeToken' },
        mintTokens: { channel: 'crowdfunding-channel', contractId: 'cftoken', fcn: 'TokenContract:MintTokens' },
        transferTokens: { channel: 'crowdfunding-channel', contractId: 'cftoken', fcn: 'TokenContract:TransferTokens' },
        createTokenAccount: { channel: 'crowdfunding-channel', contractId: 'cftoken', fcn: 'TokenContract:CreateTokenAccount' },
        submitMilestoneReport: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:SubmitMilestoneReport' },
        verifyMilestoneCompletion: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'ValidatorContract:VerifyMilestoneCompletion' },
        shareMilestoneValidationToPlatform: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'ValidatorContract:ShareMilestoneValidationToPlatform' },
        triggerFundRelease: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:TriggerFundRelease' },
        createDispute: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:CreateDispute' },
        witnessAgreement: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:WitnessAgreement' },
        collectCampaignFee: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:CollectCampaignFee' },
        setCampaignFeeTier: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:SetCampaignFeeTier' },
        setDisputeFeeTier: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:SetDisputeFeeTier' },
        deleteCampaign: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'StartupContract:DeleteCampaign' },
        withdrawInvestment: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'InvestorContract:WithdrawInvestment' },
        requestRefund: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'InvestorContract:RequestRefund' },
        closeCampaign: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'PlatformContract:CloseCampaign' }
    },
    dual: {
        createStartup: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:CreateStartup' },
        createCampaign: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:CreateCampaign' },
        submitForValidation: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:SubmitForValidation' },
        validateCampaign: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'ValidatorContract:ValidateCampaign' },
        approveOrRejectCampaign: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'ValidatorContract:ApproveOrRejectCampaign' },
        shareValidationToPlatform: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'ValidatorContract:ShareValidationToPlatform' },
        shareCampaignToPlatform: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:ShareCampaignToPlatform' },
        publishCampaignToPortal: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'PlatformContract:PublishCampaignToPortal' }, // v3: publish on governance, bridged to investment
        getCampaign: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:GetCampaign' },
        registerInvestor: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:RegisterInvestor' },
        viewCampaign: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:ViewCampaign' },
        makeInvestment: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:MakeInvestment' },
        createInvestmentProposal: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:CreateInvestmentProposal' },
        respondToInvestmentProposal: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'StartupContract:RespondToInvestmentProposal' },
        initializeToken: { channel: 'investment-execution-channel', contractId: 'cftoken', fcn: 'TokenContract:InitializeToken' },
        mintTokens: { channel: 'investment-execution-channel', contractId: 'cftoken', fcn: 'TokenContract:MintTokens' },
        transferTokens: { channel: 'investment-execution-channel', contractId: 'cftoken', fcn: 'TokenContract:TransferTokens' },
        createTokenAccount: { channel: 'investment-execution-channel', contractId: 'cftoken', fcn: 'TokenContract:CreateTokenAccount' },
        submitMilestoneReport: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:SubmitMilestoneReport' },
        verifyMilestoneCompletion: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'ValidatorContract:VerifyMilestoneCompletion' },
        shareMilestoneValidationToPlatform: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'ValidatorContract:ShareMilestoneValidationToPlatform' },
        triggerFundRelease: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'PlatformContract:TriggerFundRelease' }, // v3: writes StartupPlatformShared (governance-homed)
        createDispute: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:CreateDispute' },
        witnessAgreement: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:WitnessAgreement' },
        collectCampaignFee: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:CollectCampaignFee' },
        setCampaignFeeTier: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:SetCampaignFeeTier' },
        setDisputeFeeTier: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:SetDisputeFeeTier' },
        deleteCampaign: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:DeleteCampaign' },
        withdrawInvestment: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:WithdrawInvestment' },
        requestRefund: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:RequestRefund' },
        closeCampaign: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:CloseCampaign' }
    },
    // Multi (port 8080): isolated CCs; fnames without Contract: prefix except TokenContract:*.
    // Caliper contractID must be unique per (channel, cc) — see network-multi.yaml.
    multi: {
        createStartup: { channel: 'startup-validator-channel', contractId: 'startup', fcn: 'CreateStartup' },
        createCampaign: { channel: 'startup-validator-channel', contractId: 'startup', fcn: 'CreateCampaign' },
        submitForValidation: { channel: 'startup-validator-channel', contractId: 'startup', fcn: 'SubmitForValidation' },
        validateCampaign: { channel: 'startup-validator-channel', contractId: 'validator', fcn: 'ValidateCampaign' },
        approveOrRejectCampaign: { channel: 'startup-validator-channel', contractId: 'validator', fcn: 'ApproveOrRejectCampaign' },
        shareValidationToPlatform: { channel: 'validator-platform-channel', contractId: 'validator-on-validator-platform', fcn: 'ShareValidationToPlatform' },
        shareCampaignToPlatform: { channel: 'startup-platform-channel', contractId: 'startup-on-startup-platform', fcn: 'ShareCampaignToPlatform' },
        publishCampaignToPortal: { channel: 'common-channel', contractId: 'platform', fcn: 'PublishCampaignToPortal' },
        getCampaign: { channel: 'startup-validator-channel', contractId: 'startup', fcn: 'GetCampaign' },
        registerInvestor: { channel: 'investor-platform-channel', contractId: 'investor', fcn: 'RegisterInvestor' },
        viewCampaign: { channel: 'investor-platform-channel', contractId: 'investor', fcn: 'ViewCampaign' },
        makeInvestment: { channel: 'startup-investor-channel', contractId: 'investor-on-startup-investor', fcn: 'MakeInvestment' },
        createInvestmentProposal: { channel: 'startup-investor-channel', contractId: 'investor-on-startup-investor', fcn: 'CreateInvestmentProposal' },
        respondToInvestmentProposal: { channel: 'startup-investor-channel', contractId: 'startup-on-startup-investor', fcn: 'RespondToInvestmentProposal' },
        initializeToken: { channel: 'common-channel', contractId: 'platform', fcn: 'TokenContract:InitializeToken' },
        mintTokens: { channel: 'common-channel', contractId: 'platform', fcn: 'TokenContract:MintTokens' },
        transferTokens: { channel: 'common-channel', contractId: 'platform', fcn: 'TokenContract:TransferTokens' },
        createTokenAccount: { channel: 'common-channel', contractId: 'platform', fcn: 'TokenContract:CreateTokenAccount' },
        submitMilestoneReport: { channel: 'startup-validator-channel', contractId: 'startup', fcn: 'SubmitMilestoneReport' },
        verifyMilestoneCompletion: { channel: 'startup-validator-channel', contractId: 'validator', fcn: 'VerifyMilestoneCompletion' },
        shareMilestoneValidationToPlatform: { channel: 'validator-platform-channel', contractId: 'validator-on-validator-platform', fcn: 'ShareMilestoneValidationToPlatform' },
        triggerFundRelease: { channel: 'startup-platform-channel', contractId: 'platform-on-startup-platform', fcn: 'TriggerFundRelease' },
        createDispute: { channel: 'common-channel', contractId: 'platform', fcn: 'CreateDispute' },
        witnessAgreement: { channel: 'common-channel', contractId: 'platform', fcn: 'WitnessAgreement' },
        collectCampaignFee: { channel: 'common-channel', contractId: 'platform', fcn: 'CollectCampaignFee' },
        setCampaignFeeTier: { channel: 'common-channel', contractId: 'platform', fcn: 'SetCampaignFeeTier' },
        setDisputeFeeTier: { channel: 'common-channel', contractId: 'platform', fcn: 'SetDisputeFeeTier' },
        deleteCampaign: { channel: 'startup-validator-channel', contractId: 'startup', fcn: 'DeleteCampaign' },
        withdrawInvestment: { channel: 'startup-investor-channel', contractId: 'investor-on-startup-investor', fcn: 'WithdrawInvestment' },
        requestRefund: { channel: 'investor-platform-channel', contractId: 'investor', fcn: 'RequestRefund' },
        closeCampaign: { channel: 'common-channel', contractId: 'platform', fcn: 'CloseCampaign' }
    }
};

function resolveTarget(op, workerArgs) {
    const arch = archOf(workerArgs);
    if (!OP_MAP[arch] || !OP_MAP[arch][op]) {
        throw new Error(`Unknown arch/op: ${arch}/${op}`);
    }
    const base = OP_MAP[arch][op];
    return {
        channel: (workerArgs && workerArgs.channel) || base.channel,
        contractId: (workerArgs && workerArgs.contractId) || base.contractId,
        fcn: (workerArgs && workerArgs.fcn) || base.fcn
    };
}

const INVOKERS = {
    createStartup: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    createCampaign: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    submitForValidation: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    validateCampaign: { invokerMspId: 'ValidatorOrgMSP', invokerIdentity: 'validatororgadmin' },
    approveOrRejectCampaign: { invokerMspId: 'ValidatorOrgMSP', invokerIdentity: 'validatororgadmin' },
    shareValidationToPlatform: { invokerMspId: 'ValidatorOrgMSP', invokerIdentity: 'validatororgadmin' },
    shareCampaignToPlatform: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    publishCampaignToPortal: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    getCampaign: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    registerInvestor: { invokerMspId: 'InvestorOrgMSP', invokerIdentity: 'investororgadmin' },
    viewCampaign: { invokerMspId: 'InvestorOrgMSP', invokerIdentity: 'investororgadmin' },
    makeInvestment: { invokerMspId: 'InvestorOrgMSP', invokerIdentity: 'investororgadmin' },
    createInvestmentProposal: { invokerMspId: 'InvestorOrgMSP', invokerIdentity: 'investororgadmin' },
    respondToInvestmentProposal: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    initializeToken: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    mintTokens: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    transferTokens: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    createTokenAccount: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    submitMilestoneReport: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    verifyMilestoneCompletion: { invokerMspId: 'ValidatorOrgMSP', invokerIdentity: 'validatororgadmin' },
    shareMilestoneValidationToPlatform: { invokerMspId: 'ValidatorOrgMSP', invokerIdentity: 'validatororgadmin' },
    triggerFundRelease: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    createDispute: { invokerMspId: 'InvestorOrgMSP', invokerIdentity: 'investororgadmin' },
    witnessAgreement: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    collectCampaignFee: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    setCampaignFeeTier: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    setDisputeFeeTier: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' },
    deleteCampaign: { invokerMspId: 'StartupOrgMSP', invokerIdentity: 'startuporgadmin' },
    withdrawInvestment: { invokerMspId: 'InvestorOrgMSP', invokerIdentity: 'investororgadmin' },
    requestRefund: { invokerMspId: 'InvestorOrgMSP', invokerIdentity: 'investororgadmin' },
    closeCampaign: { invokerMspId: 'PlatformOrgMSP', invokerIdentity: 'platformorgadmin' }
};

function invokerFor(op, workerArgs) {
    const base = INVOKERS[op];
    if (!base) {
        throw new Error(`No invoker mapped for op: ${op}`);
    }
    return {
        invokerMspId: (workerArgs && workerArgs.invokerMspId) || base.invokerMspId,
        invokerIdentity: (workerArgs && workerArgs.invokerIdentity) || base.invokerIdentity
    };
}

// ---------------------------------------------------------------------------------------------
// v3 adaptation: confidential arguments are moved into the transient map (the v3 chaincode rejects
// them as plaintext arguments because arguments are recorded in the block). Each transform returns
// { args, transient } where args keeps the record ID and blanks the confidential fields.
// ---------------------------------------------------------------------------------------------
const num = (v) => Number(v);
const docsOf = (v) => { try { return JSON.parse(v || '[]'); } catch (e) { return []; } };
const V3_TRANSFORM = {
    registerInvestor: (a) => ({ args: [a[0], a[1], '0', '', ''], transient: { kyc: { annualIncome: num(a[2]), aadharNumber: a[3], panNumber: a[4] } } }),
    makeInvestment: (a) => ({ args: [a[0], '', '', '0', ''], transient: { private: { campaignId: a[1], investorId: a[2], amount: num(a[3]), currency: a[4] } } }),
    createInvestmentProposal: (a) => ({ args: [a[0], '', '', '', '0', '', '', '', '', ''],
        transient: { private: { campaignId: a[1], investorId: a[2], startupId: a[3], investmentAmount: num(a[4]), currency: a[5], equity: a[6], duration: a[7], milestones: a[8], proposedTerms: a[9] } } }),
    respondToInvestmentProposal: (a) => ({ args: [a[0], '', '0', '', ''],
        transient: { private: { action: a[1], counterAmount: num(a[2] || 0), counterTerms: a[3] || '', modifiedMilestones: a[4] || '' } } }),
    createCampaign: (a) => ({ args: a.slice(0, a.length - 1).concat(['']), transient: { private: { documents: docsOf(a[a.length - 1]) } } }),
    submitForValidation: (a) => ({ args: [a[0], '', a[2]], transient: { private: { documents: docsOf(a[1]) } } }),
    validateCampaign: (a) => ({ args: [a[0], a[1], a[2], a[3], ''], transient: { private: { documents: docsOf(a[4]) } } })
};

function buildRequest(op, workerArgs, contractArguments, extra) {
    const target = resolveTarget(op, workerArgs);
    const invoker = invokerFor(op, workerArgs);
    let args = contractArguments || [];
    let transientMap;
    if (V3_TRANSFORM[op]) {
        const t = V3_TRANSFORM[op](args);
        args = t.args;
        transientMap = {};
        for (const [k, v] of Object.entries(t.transient)) {
            transientMap[k] = JSON.stringify(v);
        }
    }
    return Object.assign({
        contractId: target.contractId,
        channel: target.channel,
        contractFunction: target.fcn,
        contractArguments: args,
        invokerMspId: invoker.invokerMspId,
        invokerIdentity: invoker.invokerIdentity,
        readOnly: false
    }, transientMap ? { transientMap } : {}, extra || {});
}

function campaignArgs(campaignId, startupId) {
    return [
        campaignId, startupId, 'Technology', '2025-12-31', 'USD', 'false', 'false',
        '2025-01-01', 'Prototype', 'Hardware', '["IoT","SmartHome","AI"]', 'false', 'false',
        '90', '1', '1', '2025', '50000', '50K-100K',
        `Campaign ${campaignId}`, `Caliper campaign ${campaignId}`,
        '["business_plan.pdf","pitch_deck.pdf"]'
    ];
}

function isCommitted(status) {
    return !!(status && typeof status.IsCommitted === 'function' && status.IsCommitted());
}

/**
 * Hard check — prefer sendOk + early return in workloads so a failed step
 * counts as Caliper Fail without aborting the whole worker round.
 */
function assertCommitted(status, label) {
    if (!isCommitted(status)) {
        throw new Error(`${label} did not commit`);
    }
}

/**
 * sendTimed + commit check. Never throws.
 * PeerGateway already records Fail on endorse/submit errors before returning;
 * we only skip throwing so the round continues. Timeouts / channel-down also
 * return null (in-flight sendRequests still finishes and is counted).
 */
async function sendOk(sutAdapter, request, timeoutMs) {
    try {
        const status = await sendTimed(sutAdapter, request, timeoutMs);
        return isCommitted(status) ? status : null;
    } catch (e) {
        return null;
    }
}

function resultToString(status) {
    if (!status || typeof status.GetResult !== 'function') {
        return '';
    }
    const raw = status.GetResult();
    if (raw == null) {
        return '';
    }
    if (Buffer.isBuffer(raw)) {
        return raw.toString('utf8');
    }
    // Fix (affects the original harness too): with the peer-gateway connector, evaluate() results are
    // Uint8Array. String(Uint8Array) yields "123,34,..." so queryJson() never parsed GetCampaign and every
    // published-campaign bootstrap stopped before its named operation.
    if (raw instanceof Uint8Array) {
        return Buffer.from(raw).toString('utf8');
    }
    if (typeof raw === 'string') {
        return raw;
    }
    if (raw.type === 'Buffer' && Array.isArray(raw.data)) {
        return Buffer.from(raw.data).toString('utf8');
    }
    return String(raw);
}

/** Soft query — returns parsed JSON or null (never throws). */
async function queryJson(sutAdapter, op, workerArgs, contractArguments) {
    const status = await sendOk(
        sutAdapter,
        buildRequest(op, workerArgs, contractArguments, { readOnly: true })
    );
    if (!status) {
        return null;
    }
    const text = resultToString(status);
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

/** Bootstrap: create startup + campaign. Returns object or null on soft-fail. */
async function bootstrapCampaign(sutAdapter, workerArgs, workerIndex, txIndex) {
    const startupId = uniqueId('STARTUP', workerIndex, txIndex);
    const campaignId = uniqueId('CAMP', workerIndex, txIndex);
    if (!await sendOk(sutAdapter, buildRequest('createStartup', workerArgs, [
        startupId, `STU_${workerIndex}_${txIndex}`, `Startup ${startupId}`, 'Bootstrap', `S-${workerIndex}-${txIndex}`
    ]))) {
        return null;
    }
    if (!await sendOk(sutAdapter, buildRequest('createCampaign', workerArgs, campaignArgs(campaignId, startupId)))) {
        return null;
    }
    return { startupId, campaignId };
}

/**
 * For dual/multi, investment-channel ops need a published campaign (gov → share → invest).
 * Single-channel can use a plain create. Returns same shape as bootstrapCampaign / published.
 */
async function bootstrapForInvestment(sutAdapter, workerArgs, workerIndex, txIndex) {
    // v3: MakeInvestment / CreateInvestmentProposal require a published, open campaign on every architecture
    return bootstrapPublishedCampaign(sutAdapter, workerArgs, workerIndex, txIndex);
}

/**
 * Create → submit → validate → approve, then query validationProofHash.
 * Returns { startupId, campaignId, validationId, proof } or null.
 */
async function bootstrapApprovedCampaign(sutAdapter, workerArgs, workerIndex, txIndex) {
    const boot = await bootstrapCampaign(sutAdapter, workerArgs, workerIndex, txIndex);
    if (!boot) {
        return null;
    }
    const { startupId, campaignId } = boot;
    if (!await sendOk(sutAdapter, buildRequest('submitForValidation', workerArgs, [
        campaignId, '["business_plan.pdf"]', 'Caliper validation request'
    ]))) {
        return null;
    }
    const validationId = uniqueId('VAL', workerIndex, txIndex);
    if (!await sendOk(sutAdapter, buildRequest('validateCampaign', workerArgs, [
        validationId, campaignId, 'VALIDATOR001', 'caliper_hash', '["business_plan.pdf"]'
    ]))) {
        return null;
    }
    if (!await sendOk(sutAdapter, buildRequest('approveOrRejectCampaign', workerArgs, [
        validationId, campaignId, 'APPROVED',
        '8.5', '2.5', 'LOW', '["Caliper approve"]', '[]', ''
    ]))) {
        return null;
    }

    // Proof hash is generated server-side — retry longer under load before soft-fail.
    let proof = '';
    const attempts = 15;
    for (let i = 0; i < attempts; i++) {
        const camp = await queryJson(sutAdapter, 'getCampaign', workerArgs, [campaignId]);
        if (camp) {
            proof = camp.validationProofHash || camp.ValidationProofHash || '';
            if (proof) {
                break;
            }
        }
        await new Promise((r) => setTimeout(r, 400));
    }
    if (!proof) {
        return null;
    }
    return { startupId, campaignId, validationId, proof };
}

/** Approved + shared + published campaign. Returns object or null. */
async function bootstrapPublishedCampaign(sutAdapter, workerArgs, workerIndex, txIndex) {
    const approved = await bootstrapApprovedCampaign(sutAdapter, workerArgs, workerIndex, txIndex);
    if (!approved) {
        return null;
    }
    // Dual + multi: Validator must ShareValidationToPlatform before Publish can verify.
    const arch = archOf(workerArgs);
    if (arch === 'dual' || arch === 'multi') {
        if (!await sendOk(sutAdapter, buildRequest('shareValidationToPlatform', workerArgs, [
            approved.validationId, approved.campaignId
        ]))) {
            return null;
        }
    }
    if (!await sendOk(sutAdapter, buildRequest('shareCampaignToPlatform', workerArgs, [
        approved.campaignId, approved.proof
    ]))) {
        return null;
    }
    if (!await sendOk(sutAdapter, buildRequest('publishCampaignToPortal', workerArgs, [
        approved.campaignId, approved.proof
    ]))) {
        return null;
    }
    // v3 dual: the published campaign reaches the investment channel through the outbox/relay bridge
    // (measured lag ~2-3 s). Waiting here is not a transaction and is not counted by Caliper.
    if (archOf(workerArgs) === 'dual') {
        await new Promise((r) => setTimeout(r, BRIDGE_WAIT_MS));
    }
    return approved;
}

/** Create token account in its own tx (TransferTokens panics if it creates inline). */
async function ensureTokenAccount(sutAdapter, workerArgs, accountId, ownerType) {
    await sendOk(sutAdapter, buildRequest('createTokenAccount', workerArgs, [
        accountId, accountId, ownerType || 'USER', '{}'
    ]));
}

/**
 * Share milestone verification to platform with retries.
 * Multi/dual: Share reads StartupValidatorCollection from validator-platform
 * and writes ValidatorPlatformCollection; either hop can lag under load.
 * Returns true once Share commits.
 */
async function ensureMilestoneVerificationShared(sutAdapter, workerArgs, verificationId, opts) {
    // Fix (affects the original harness too): ShareMilestoneValidationToPlatform exists only in the
    // dual/multi-channel chaincodes. On the single channel TriggerFundRelease needs no share step, but
    // the original helper retried the missing function 8 times and aborted every iteration.
    if (archOf(workerArgs) === 'single') {
        return true;
    }
    const attempts = (opts && opts.attempts) || 8;
    const delayMs = (opts && opts.delayMs) || 350;
    for (let i = 0; i < attempts; i++) {
        if (await sendOk(sutAdapter, buildRequest('shareMilestoneValidationToPlatform', workerArgs, [
            verificationId
        ]))) {
            // Brief settle so TriggerFundRelease's CrossChannelGet can see the PDC write.
            await new Promise((r) => setTimeout(r, delayMs));
            return true;
        }
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
}

module.exports = {
    archOf,
    uniqueId,
    uniqueTokenSymbol,
    TX_TIMEOUT_MS,
    sendTimed,
    sendOk,
    isCommitted,
    resolveTarget,
    invokerFor,
    buildRequest,
    campaignArgs,
    bootstrapCampaign,
    bootstrapApprovedCampaign,
    bootstrapPublishedCampaign,
    bootstrapForInvestment,
    ensureTokenAccount,
    ensureMilestoneVerificationShared,
    queryJson,
    assertCommitted,
    resultToString
};
