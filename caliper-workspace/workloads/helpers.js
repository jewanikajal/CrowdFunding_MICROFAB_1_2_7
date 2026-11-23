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
async function sendTimed(sutAdapter, request, timeoutMs) {
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
        initializeToken: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'TokenContract:InitializeToken' },
        mintTokens: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'TokenContract:MintTokens' },
        transferTokens: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'TokenContract:TransferTokens' },
        createTokenAccount: { channel: 'crowdfunding-channel', contractId: 'crowdfunding', fcn: 'TokenContract:CreateTokenAccount' },
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
        publishCampaignToPortal: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:PublishCampaignToPortal' },
        getCampaign: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:GetCampaign' },
        registerInvestor: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:RegisterInvestor' },
        viewCampaign: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:ViewCampaign' },
        makeInvestment: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:MakeInvestment' },
        createInvestmentProposal: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'InvestorContract:CreateInvestmentProposal' },
        respondToInvestmentProposal: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'StartupContract:RespondToInvestmentProposal' },
        initializeToken: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'TokenContract:InitializeToken' },
        mintTokens: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'TokenContract:MintTokens' },
        transferTokens: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'TokenContract:TransferTokens' },
        createTokenAccount: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'TokenContract:CreateTokenAccount' },
        submitMilestoneReport: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'StartupContract:SubmitMilestoneReport' },
        verifyMilestoneCompletion: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'ValidatorContract:VerifyMilestoneCompletion' },
        shareMilestoneValidationToPlatform: { channel: 'governance-validation-channel', contractId: 'governance', fcn: 'ValidatorContract:ShareMilestoneValidationToPlatform' },
        triggerFundRelease: { channel: 'investment-execution-channel', contractId: 'investment', fcn: 'PlatformContract:TriggerFundRelease' },
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

function buildRequest(op, workerArgs, contractArguments, extra) {
    const target = resolveTarget(op, workerArgs);
    const invoker = invokerFor(op, workerArgs);
    return Object.assign({
        contractId: target.contractId,
        channel: target.channel,
        contractFunction: target.fcn,
        contractArguments: contractArguments || [],
        invokerMspId: invoker.invokerMspId,
        invokerIdentity: invoker.invokerIdentity,
        readOnly: false
    }, extra || {});
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
    const arch = archOf(workerArgs);
    if (arch === 'dual' || arch === 'multi') {
        return bootstrapPublishedCampaign(sutAdapter, workerArgs, workerIndex, txIndex);
    }
    return bootstrapCampaign(sutAdapter, workerArgs, workerIndex, txIndex);
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
