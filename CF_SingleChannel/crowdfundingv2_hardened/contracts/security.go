package main

// security.go — hardening layer added in response to the adversarial evaluation
// (benchmarks/THREAT_MODEL.md, attacks A1–A15, P1–P3, M1). Shared verbatim by the
// single-channel and dual-channel (v3) chaincodes.
//
//  1. roleGuard (BeforeTransaction hook): every state-changing function of
//     <Org>Contract may only be invoked by a client of <Org>MSP; read-only functions
//     (Get*/Is*/Calculate*) stay open and remain protected by PDC membership rules.
//  2. Token functions are served ONLY by the separate "cftoken" chaincode namespace,
//     which is deployed with an OutOf(2, 4 orgs) endorsement policy, so a single
//     compromised organisation cannot forge balances (attack M1). Privileged token
//     functions (mint, burn, freeze, rates, ...) are PlatformOrg-only.
//  3. txNow: deterministic transaction timestamp (replaces time.Now(), whose value
//     differs between endorsers and caused ENDORSEMENT_MISMATCH rejections).
//  4. Identity helpers used for ownership checks (token accounts, investor IDs).

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/golang/protobuf/proto"
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/hyperledger/fabric-protos-go/peer"
)

const (
	StartupMSP     = "StartupOrgMSP"
	InvestorMSP    = "InvestorOrgMSP"
	ValidatorMSP   = "ValidatorOrgMSP"
	PlatformMSP    = "PlatformOrgMSP"
	TokenNamespace = "cftoken"
	// CustodyPlatform marks token accounts controlled by PlatformOrg (treasury,
	// platform-created and implicitly created accounts).
	CustodyPlatform = "PLATFORM_CUSTODY"
)

var contractRole = map[string]string{
	"StartupContract":   StartupMSP,
	"InvestorContract":  InvestorMSP,
	"ValidatorContract": ValidatorMSP,
	"PlatformContract":  PlatformMSP,
}

// functions any participant may call (each checks the caller in its own body)
var contractRoleOverride = map[string][]string{
	// disputes can be raised by the affected party; CreateDispute checks initiatorType == caller org
	"PlatformContract:CreateDispute": {StartupMSP, InvestorMSP, ValidatorMSP, PlatformMSP},
}

// privileged token operations: PlatformOrg only
var tokenPlatformOnly = map[string]bool{
	"InitTokenLedger": true, "IssueTokens": true, "CollectFeeTokens": true, "FreezeTokens": true,
	"UnfreezeTokens": true, "InitializeToken": true, "SetExchangeRate": true, "PurchaseTokens": true,
	"MintTokens": true, "BurnTokens": true, "DistributeRewards": true, "FreezePenaltyTokens": true,
	"ExecutePenalty": true, "ApplyBlacklist": true, "InitializeMLRating": true, "UpdateMLRating": true,
	"AddRewardBonus": true,
}

// token operations open to every org; each performs its own ownership check
var tokenAnyOrg = map[string]bool{
	"CreateTokenAccount": true, "TransferTokens": true, "RedeemRewardTokens": true,
	"WithdrawToFiat": true, "CreateDisputeTicket": true,
}

func isReadOnly(method string) bool {
	return strings.HasPrefix(method, "Get") || strings.HasPrefix(method, "Is") || strings.HasPrefix(method, "Calculate")
}

func callerMSP(ctx contractapi.TransactionContextInterface) (string, error) {
	return ctx.GetClientIdentity().GetMSPID()
}

// callerID is the unique, endorser-independent identity of the submitting client.
func callerID(ctx contractapi.TransactionContextInterface) (string, error) {
	return ctx.GetClientIdentity().GetID()
}

func requireMSP(ctx contractapi.TransactionContextInterface, allowed ...string) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return fmt.Errorf("access denied: cannot read caller MSP: %v", err)
	}
	for _, a := range allowed {
		if msp == a {
			return nil
		}
	}
	return fmt.Errorf("access denied: caller %s is not authorised (requires %s)", msp, strings.Join(allowed, " or "))
}

// chaincodeName returns the namespace this invocation targets (from the signed proposal).
func chaincodeName(stub shim.ChaincodeStubInterface) string {
	sp, err := stub.GetSignedProposal()
	if err != nil || sp == nil {
		return ""
	}
	prop := &peer.Proposal{}
	if proto.Unmarshal(sp.ProposalBytes, prop) != nil {
		return ""
	}
	payload := &peer.ChaincodeProposalPayload{}
	if proto.Unmarshal(prop.Payload, payload) != nil {
		return ""
	}
	cis := &peer.ChaincodeInvocationSpec{}
	if proto.Unmarshal(payload.Input, cis) != nil || cis.ChaincodeSpec == nil || cis.ChaincodeSpec.ChaincodeId == nil {
		return ""
	}
	return cis.ChaincodeSpec.ChaincodeId.Name
}

// roleGuard is registered as BeforeTransaction on every contract.
func roleGuard(ctx contractapi.TransactionContextInterface) error {
	fn, _ := ctx.GetStub().GetFunctionAndParameters()
	if strings.HasPrefix(fn, "org.hyperledger.fabric:") {
		return nil // contract metadata
	}
	i := strings.Index(fn, ":")
	if i < 0 {
		return fmt.Errorf("access denied: use a fully-qualified function name (Contract:Function)")
	}
	contract, method := fn[:i], fn[i+1:]

	ns := chaincodeName(ctx.GetStub())
	if contract == "TokenContract" && ns != TokenNamespace {
		return fmt.Errorf("access denied: token functions are served only by the %q chaincode (2-of-4 endorsement)", TokenNamespace)
	}
	if contract != "TokenContract" && ns == TokenNamespace {
		return fmt.Errorf("access denied: the %q chaincode serves TokenContract only", TokenNamespace)
	}
	if isReadOnly(method) || contract == "DataBridgeContract" {
		return nil // reads are protected by PDC membership; bridge calls verify their input
	}
	if contract == "TokenContract" {
		if tokenPlatformOnly[method] {
			return requireMSP(ctx, PlatformMSP)
		}
		if tokenAnyOrg[method] {
			return nil
		}
		return fmt.Errorf("access denied: unknown token function %s", method)
	}
	if allowed, ok := contractRoleOverride[fn]; ok {
		return requireMSP(ctx, allowed...)
	}
	if role, ok := contractRole[contract]; ok {
		return requireMSP(ctx, role)
	}
	return fmt.Errorf("access denied: unknown contract %s", contract)
}

// txNow is the transaction's proposal timestamp: identical on every endorser.
func txNow(ctx contractapi.TransactionContextInterface) time.Time {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil || ts == nil {
		return time.Unix(0, 0).UTC()
	}
	return time.Unix(ts.Seconds, int64(ts.Nanos)).UTC()
}

// accountController returns the identity that may spend from a newly created account.
func accountController(ctx contractapi.TransactionContextInterface) (string, error) {
	msp, err := callerMSP(ctx)
	if err != nil {
		return "", err
	}
	if msp == PlatformMSP {
		return CustodyPlatform, nil
	}
	return callerID(ctx)
}

// requireAccountControl: only the account's controller may debit it.
func requireAccountControl(ctx contractapi.TransactionContextInterface, acct *TokenAccount) error {
	msp, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	controller := acct.Controller
	if controller == "" {
		controller = CustodyPlatform // legacy accounts are platform-custodied
	}
	if controller == CustodyPlatform {
		if msp == PlatformMSP {
			return nil
		}
		return fmt.Errorf("access denied: account %s is platform-custodied", acct.AccountID)
	}
	id, err := callerID(ctx)
	if err != nil {
		return err
	}
	if id != controller {
		return fmt.Errorf("access denied: caller does not control account %s", acct.AccountID)
	}
	return nil
}

// KYC carries investor identity data. Hardening (attack P1): it must arrive in the transient
// map under key "kyc" so it is never written to the block; the plaintext arguments must be empty.
type KYC struct {
	AnnualIncome    float64 `json:"annualIncome"`
	NetWorth        float64 `json:"netWorth"`        // optional: SEBI net-worth routes
	FinancialAssets float64 `json:"financialAssets"` // optional: SEBI net-worth routes
	AadharNumber    string  `json:"aadharNumber"`
	PANNumber       string  `json:"panNumber"`
}

func readKYC(ctx contractapi.TransactionContextInterface, argIncome float64, argAadhar, argPAN string) (*KYC, error) {
	if argIncome != 0 || argAadhar != "" || argPAN != "" {
		return nil, fmt.Errorf("KYC data must not be passed as transaction arguments (it would be stored in the block); send it in the transient map under key \"kyc\"")
	}
	tm, err := ctx.GetStub().GetTransient()
	if err != nil {
		return nil, fmt.Errorf("failed to read transient map: %v", err)
	}
	raw, ok := tm["kyc"]
	if !ok {
		return nil, fmt.Errorf("transient key \"kyc\" is required")
	}
	k := &KYC{}
	if err := json.Unmarshal(raw, k); err != nil {
		return nil, fmt.Errorf("invalid kyc transient data: %v", err)
	}
	return k, nil
}

// investor ownership: the client that registered an investor ID is the only one allowed to act for it
func investorOwnerKey(investorID string) string { return "INVESTOR_OWNER_" + investorID }

func requireInvestorOwner(ctx contractapi.TransactionContextInterface, investorID string) error {
	owner, err := ctx.GetStub().GetState(investorOwnerKey(investorID))
	if err != nil {
		return err
	}
	if owner == nil {
		return fmt.Errorf("investor %s is not registered", investorID)
	}
	id, err := callerID(ctx)
	if err != nil {
		return err
	}
	if string(owner) != id {
		return fmt.Errorf("access denied: caller is not the registered owner of investor %s", investorID)
	}
	return nil
}

func isOpenCampaign(publicJSON []byte) bool {
	var c struct {
		Status string `json:"status"`
	}
	if json.Unmarshal(publicJSON, &c) != nil {
		return false
	}
	return c.Status == "PUBLISHED" || c.Status == "ACTIVE"
}

// ---------------------------------------------------------------------------------------------
// Confidential transaction inputs (hardening, attack P4): investment amounts, proposal terms,
// counter-offers and the investor/campaign relationship are read from the transient map under
// key "private" (a JSON object), so they are never written to the block. The corresponding
// plaintext arguments must be empty / zero; otherwise the transaction is rejected.
// ---------------------------------------------------------------------------------------------
type privIn map[string]json.RawMessage

func privateInput(ctx contractapi.TransactionContextInterface, plaintextEmpty bool) (privIn, error) {
	if !plaintextEmpty {
		return nil, fmt.Errorf("confidential investment data must not be passed as transaction arguments (it would be stored in the block); send it in the transient map under key \"private\"")
	}
	tm, err := ctx.GetStub().GetTransient()
	if err != nil {
		return nil, fmt.Errorf("failed to read transient map: %v", err)
	}
	raw, ok := tm["private"]
	if !ok {
		return nil, fmt.Errorf("transient key \"private\" is required")
	}
	p := privIn{}
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("invalid private transient data: %v", err)
	}
	return p, nil
}

func (p privIn) str(k string, dst *string, required bool) error {
	v, ok := p[k]
	if !ok {
		if required {
			return fmt.Errorf("transient private.%s is required", k)
		}
		return nil
	}
	return json.Unmarshal(v, dst)
}

func (p privIn) num(k string, dst *float64) error {
	v, ok := p[k]
	if !ok {
		return fmt.Errorf("transient private.%s is required", k)
	}
	return json.Unmarshal(v, dst)
}

// blacklistKey is the public fraud-control marker for a campaign (test SE19).
func blacklistKey(campaignID string) string { return "CAMPAIGN_BLACKLIST_" + campaignID }

// ---------------------------------------------------------------------------------------------
// Campaign document confidentiality (privacy test PR11)
// ---------------------------------------------------------------------------------------------

// privateDocs returns a JSON list of document references taken from transient["private"].documents.
// A plaintext documents argument must be empty or "[]": it would otherwise be written to the block,
// which every channel member (including InvestorOrg on the single channel) receives.
func privateDocs(ctx contractapi.TransactionContextInterface, plaintext string) (string, error) {
	if plaintext != "" && plaintext != "[]" {
		return "", fmt.Errorf("campaign documents must not be passed as transaction arguments (they would be stored in the block); send them in the transient map under key \"private\" as {\"documents\": [...]}")
	}
	tm, err := ctx.GetStub().GetTransient()
	if err != nil {
		return "", err
	}
	raw, ok := tm["private"]
	if !ok {
		return "[]", nil
	}
	var p struct {
		Documents json.RawMessage `json:"documents"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return "", fmt.Errorf("invalid private transient data: %v", err)
	}
	if len(p.Documents) == 0 {
		return "[]", nil
	}
	return string(p.Documents), nil
}

// stripDocs removes document fields from a campaign record before it is written to public state
// (or bridged to AllOrgsShared): documents stay in the Startup/Platform private collections.
func stripDocs(record []byte) []byte {
	var m map[string]interface{}
	if json.Unmarshal(record, &m) != nil {
		return record
	}
	for k := range m {
		if strings.Contains(strings.ToLower(k), "document") {
			delete(m, k)
		}
	}
	b, err := json.Marshal(m)
	if err != nil {
		return record
	}
	return b
}

// initiatorMSP maps a dispute initiatorType to the organisation allowed to file it.
var initiatorMSP = map[string]string{"STARTUP": StartupMSP, "INVESTOR": InvestorMSP, "VALIDATOR": ValidatorMSP, "PLATFORM": PlatformMSP}
