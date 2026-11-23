#!/usr/bin/env bash
# Full Dual-channel E2E seed for Caliper (tokens → publish → proposal).
# Governance invokes need BOTH validator + platform peers (AND endorsement).
# Investment invokes use a single peer (OR endorsement).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DUAL="$ROOT/crowdfunding_dualchannel_v2"
WS="$ROOT/caliper-workspace"
ORDERER="orderer-api.127-0-0-1.nip.io:7070"
GOV_CH="governance-validation-channel"
INV_CH="investment-execution-channel"
GOV_CC="governance"
INV_CC="investment"
PEER_PLAT="platformorgpeer-api.127-0-0-1.nip.io:7070"
PEER_STU="startuporgpeer-api.127-0-0-1.nip.io:7070"
PEER_INV="investororgpeer-api.127-0-0-1.nip.io:7070"
PEER_VAL="validatororgpeer-api.127-0-0-1.nip.io:7070"
STATE_FILE="$WS/seed-state.json"

STARTUP_ID="${STARTUP_ID:-STARTUP001}"
CAMP_ID="${CAMP_ID:-CAMP001}"
VAL_ID="${VAL_ID:-VAL001}"
INV_ID="${INV_ID:-INVESTOR001}"
PROP_ID="${PROP_ID:-PROPOSAL001}"
AGREE_ID="${AGREE_ID:-AGREEMENT001}"
REPORT_ID="${REPORT_ID:-MILESTONE_RPT001}"
VER_ID="${VER_ID:-MILESTONE_VER001}"
MILESTONE_ID="${MILESTONE_ID:-M1}"
ESCROW_ID="${ESCROW_ID:-ESCROW_${AGREE_ID}}"

cd "$DUAL"

log() { echo ""; echo "======== $* ========"; }

is_idempotent_error() {
  local msg="$1"
  [[ "$msg" == *"already initialized"* ]] \
    || [[ "$msg" == *"already exists"* ]] \
    || [[ "$msg" == *"already exist"* ]] \
    || [[ "$msg" == *"already final"* ]] \
    || [[ "$msg" == *"already shared"* ]] \
    || [[ "$msg" == *"already published"* ]] \
    || [[ "$msg" == *"cannot be submitted"* ]] \
    || [[ "$msg" == *"validation request not found"* ]] \
    || [[ "$msg" == *"already done"* ]]
}

# Governance: AND(Validator, Platform) — always both peerAddresses + waitForEvent.
invoke_gov() {
  local payload="$1"
  local attempt=1
  local max=4
  local err=""
  echo "INVOKE GOV → $payload"
  while true; do
    err="$(peer chaincode invoke -o "$ORDERER" --channelID "$GOV_CH" -n "$GOV_CC" \
      --peerAddresses "$PEER_VAL" --peerAddresses "$PEER_PLAT" --waitForEvent \
      -c "$payload" 2>&1)" && {
      echo "$err" | tail -1
      sleep 3
      return 0
    }
    echo "$err" | tail -3
    if is_idempotent_error "$err"; then
      echo "(OK — already applied, continuing)"
      return 0
    fi
    if (( attempt >= max )); then
      echo "INVOKE GOV FAILED after $max attempts"
      return 1
    fi
    echo "(retry $attempt/$max after chaincode error…)"
    sleep $(( attempt * 4 ))
    attempt=$((attempt + 1))
  done
}

# Investment: OR policy — one peer is enough.
invoke_inv() {
  local peer="$1"; shift
  local payload="$1"
  local attempt=1
  local max=4
  local err=""
  echo "INVOKE INV → $payload"
  while true; do
    err="$(peer chaincode invoke -o "$ORDERER" --channelID "$INV_CH" -n "$INV_CC" \
      --peerAddresses "$peer" -c "$payload" 2>&1)" && {
      echo "$err" | tail -1
      sleep 3
      return 0
    }
    echo "$err" | tail -3
    if is_idempotent_error "$err"; then
      echo "(OK — already applied, continuing)"
      return 0
    fi
    if (( attempt >= max )); then
      echo "INVOKE INV FAILED after $max attempts"
      return 1
    fi
    echo "(retry $attempt/$max after chaincode error…)"
    sleep $(( attempt * 4 ))
    attempt=$((attempt + 1))
  done
}

query_gov() {
  local out err
  err="$(mktemp)"
  out="$(peer chaincode query -o "$ORDERER" --channelID "$GOV_CH" -n "$GOV_CC" -c "$1" 2>"$err")" || true
  if [[ -z "$out" && -s "$err" ]]; then
    echo "QUERY GOV failed: $(head -c 240 "$err")" >&2
  fi
  rm -f "$err"
  printf '%s' "$out"
}

query_inv() {
  local out err
  err="$(mktemp)"
  out="$(peer chaincode query -o "$ORDERER" --channelID "$INV_CH" -n "$INV_CC" -c "$1" 2>"$err")" || true
  if [[ -z "$out" && -s "$err" ]]; then
    echo "QUERY INV failed: $(head -c 240 "$err")" >&2
  fi
  rm -f "$err"
  printf '%s' "$out"
}

# Retry query briefly (peers can briefly 502 after heavy load).
query_gov_retry() {
  local payload="$1" out="" i
  for i in 1 2 3 4 5 6; do
    out="$(query_gov "$payload")"
    if [[ -n "$out" && "$out" != *"Error"* && "$out" != *"not found"* ]]; then
      printf '%s' "$out"
      return 0
    fi
    sleep 2
  done
  printf '%s' "$out"
  return 1
}

json_field() {
  local json="$1" field="$2"
  python3 - "$json" "$field" <<'PY'
import json,sys
raw, field = sys.argv[1], sys.argv[2]
if not raw or raw.strip()=="":
    print(""); sys.exit(0)
try:
    data = json.loads(raw)
except Exception:
    print(""); sys.exit(0)
cur = data
for part in field.split("."):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        print(""); sys.exit(0)
if cur is None:
    print("")
else:
    print(cur)
PY
}

switch() {
  # shellcheck disable=SC1091
  source ./deploy_chaincode.sh switch "$1"
}

write_state() {
  local submission_hash="$1" proof_hash="$2"
  python3 - "$STATE_FILE" "$STARTUP_ID" "$CAMP_ID" "$VAL_ID" "$INV_ID" "$PROP_ID" "$AGREE_ID" \
    "$submission_hash" "$proof_hash" "$ESCROW_ID" "$VER_ID" "$REPORT_ID" "$MILESTONE_ID" <<'PY'
import json,sys
path = sys.argv[1]
state = {
  "arch": "dual",
  "startupId": sys.argv[2],
  "campaignId": sys.argv[3],
  "validationId": sys.argv[4],
  "investorId": sys.argv[5],
  "proposalId": sys.argv[6],
  "agreementId": sys.argv[7],
  "submissionHash": sys.argv[8],
  "validationProofHash": sys.argv[9],
  "escrowId": sys.argv[10],
  "verificationId": sys.argv[11],
  "reportId": sys.argv[12],
  "milestoneId": sys.argv[13],
}
open(path,"w").write(json.dumps(state, indent=2) + "\n")
print(f"Wrote {path}")
print(json.dumps(state, indent=2))
PY
}

log "0) Tokens + fee tiers (investment / PlatformOrg)"
switch platform
invoke_inv "$PEER_PLAT" \
  '{"function":"TokenContract:InitializeToken","Args":["CFT","CrowdToken","18","100000000","1000000000"]}' \
  || echo "(InitializeToken already done)"
invoke_inv "$PEER_PLAT" \
  '{"function":"TokenContract:MintTokens","Args":["CFT","PLATFORM","150000000"]}' \
  || echo "(Mint skipped/failed — may already have supply)"
invoke_inv "$PEER_PLAT" \
  '{"function":"PlatformContract:SetCampaignFeeTier","Args":["TIER_001","0","100000","5","5% under 100K"]}' \
  || true
invoke_inv "$PEER_PLAT" \
  '{"function":"PlatformContract:SetDisputeFeeTier","Args":["TIER_STD","0","100000","750","Standard dispute fee"]}' \
  || true

log "1) CreateStartup $STARTUP_ID (governance / StartupOrg)"
switch startup
invoke_gov \
  "{\"function\":\"StartupContract:CreateStartup\",\"Args\":[\"$STARTUP_ID\",\"STU_user123_001\",\"TechVentures Inc\",\"Caliper dual-seed startup\",\"S-001\"]}" \
  || echo "(startup may already exist)"

STU_Q="$(query_gov_retry "{\"function\":\"StartupContract:GetStartup\",\"Args\":[\"$STARTUP_ID\"]}" || true)"
echo "GetStartup: ${STU_Q:0:160}"
if [[ -z "$STU_Q" || "$STU_Q" == *"Error"* || "$STU_Q" == *"not found"* ]]; then
  echo "FATAL: cannot read $STARTUP_ID (CreateStartup may have succeeded earlier)."
  echo "       If peers return 502/Unavailable, restart Microfab dual and redeploy, then re-run."
  exit 1
fi

log "2) CreateCampaign $CAMP_ID (governance)"
invoke_gov \
  "{\"function\":\"StartupContract:CreateCampaign\",\"Args\":[\"$CAMP_ID\",\"$STARTUP_ID\",\"Technology\",\"2025-12-31\",\"USD\",\"false\",\"false\",\"2025-01-01\",\"Prototype\",\"Hardware\",\"[\\\"IoT\\\",\\\"SmartHome\\\",\\\"AI\\\"]\",\"false\",\"false\",\"90\",\"1\",\"1\",\"2025\",\"50000\",\"50K-100K\",\"Smart Home IoT Platform\",\"Caliper dual-seed campaign\",\"[\\\"business_plan.pdf\\\",\\\"pitch_deck.pdf\\\"]\"]}" \
  || echo "(campaign may already exist)"

log "3) SubmitForValidation (governance)"
invoke_gov \
  "{\"function\":\"StartupContract:SubmitForValidation\",\"Args\":[\"$CAMP_ID\",\"[\\\"business_plan_v2.pdf\\\"]\",\"Please validate Caliper dual seed campaign\"]}" \
  || echo "(submit may already be done)"

log "4) Read submissionHash (ValidatorOrg GetCampaign)"
switch validator
CAMP_VAL_Q=$(query_gov "{\"function\":\"ValidatorContract:GetCampaign\",\"Args\":[\"$CAMP_ID\"]}")
echo "Validator GetCampaign: ${CAMP_VAL_Q:0:240}"
SUB_HASH=$(json_field "$CAMP_VAL_Q" "submissionHash")
if [[ -z "$SUB_HASH" ]]; then
  switch startup
  CAMP_STU_Q=$(query_gov "{\"function\":\"StartupContract:GetCampaign\",\"Args\":[\"$CAMP_ID\"]}")
  SUB_HASH=$(json_field "$CAMP_STU_Q" "submissionHash")
  switch validator
fi
echo "submissionHash=$SUB_HASH"
[[ -n "$SUB_HASH" ]] || { echo "FATAL: could not read submissionHash — submit step failed?"; exit 1; }

log "5) ValidateCampaign $VAL_ID (governance)"
invoke_gov \
  "{\"function\":\"ValidatorContract:ValidateCampaign\",\"Args\":[\"$VAL_ID\",\"$CAMP_ID\",\"VALIDATOR001\",\"$SUB_HASH\",\"[\\\"business_plan_v2.pdf\\\"]\"]}" \
  || echo "(validate may already be in progress/final)"

log "6) ApproveOrRejectCampaign APPROVED (governance)"
invoke_gov \
  "{\"function\":\"ValidatorContract:ApproveOrRejectCampaign\",\"Args\":[\"$VAL_ID\",\"$CAMP_ID\",\"APPROVED\",\"8.5\",\"3.2\",\"LOW\",\"[\\\"Strong technical team\\\",\\\"Viable market\\\"]\",\"[]\",\"\"]}" \
  || echo "(approve may already be final)"

log "7) Read validationProofHash"
CAMP_VAL_Q2=$(query_gov "{\"function\":\"ValidatorContract:GetCampaign\",\"Args\":[\"$CAMP_ID\"]}")
PROOF=$(json_field "$CAMP_VAL_Q2" "validationProofHash")
if [[ -z "$PROOF" ]]; then
  switch startup
  CAMP_STU_Q2=$(query_gov "{\"function\":\"StartupContract:GetCampaign\",\"Args\":[\"$CAMP_ID\"]}")
  PROOF=$(json_field "$CAMP_STU_Q2" "validationProofHash")
  [[ -n "$PROOF" ]] || PROOF=$(json_field "$CAMP_STU_Q2" "ValidationProofHash")
fi
echo "validationProofHash=$PROOF"
[[ -n "$PROOF" ]] || { echo "FATAL: validationProofHash empty after approve"; exit 1; }

# Dual-only: writes ValidatorPlatformShared_VALIDATION_APPROVAL_* (required by Publish)
log "7b) ShareValidationToPlatform (governance / ValidatorOrg)"
switch validator
invoke_gov \
  "{\"function\":\"ValidatorContract:ShareValidationToPlatform\",\"Args\":[\"$VAL_ID\",\"$CAMP_ID\"]}" \
  || { echo "FATAL: ShareValidationToPlatform failed"; exit 1; }

log "8) ShareCampaignToPlatform (governance / StartupOrg)"
switch startup
invoke_gov \
  "{\"function\":\"StartupContract:ShareCampaignToPlatform\",\"Args\":[\"$CAMP_ID\",\"$PROOF\"]}" \
  || { echo "FATAL: ShareCampaignToPlatform failed"; exit 1; }

log "9) PublishCampaignToPortal (investment / PlatformOrg)"
switch platform
invoke_inv "$PEER_PLAT" \
  "{\"function\":\"PlatformContract:PublishCampaignToPortal\",\"Args\":[\"$CAMP_ID\",\"$PROOF\"]}" \
  || { echo "FATAL: PublishCampaignToPortal failed"; exit 1; }

log "10) RegisterInvestor $INV_ID (investment)"
switch investor
invoke_inv "$PEER_INV" \
  "{\"function\":\"InvestorContract:RegisterInvestor\",\"Args\":[\"$INV_ID\",\"Seed Investor\",\"25000000\",\"123456789012\",\"ABCDE1234F\"]}" \
  || echo "(investor may already exist)"

log "11) Fund token accounts (investment / PlatformOrg)"
switch platform
for ACC_SPEC in "$STARTUP_ID:STARTUP" "$INV_ID:INVESTOR" "VALIDATOR001:VALIDATOR"; do
  ACC="${ACC_SPEC%%:*}"
  OTYPE="${ACC_SPEC##*:}"
  invoke_inv "$PEER_PLAT" \
    "{\"function\":\"TokenContract:CreateTokenAccount\",\"Args\":[\"$ACC\",\"$ACC\",\"$OTYPE\",\"{}\"]}" \
    || echo "(account $ACC may already exist)"
done
TS=$(date +%s)
invoke_inv "$PEER_PLAT" \
  "{\"function\":\"TokenContract:TransferTokens\",\"Args\":[\"TRX_SEED_STU_${TS}\",\"CFT\",\"PLATFORM\",\"$STARTUP_ID\",\"5000\",\"INR\",\"INITIAL_FUNDING\",\"\"]}"
invoke_inv "$PEER_PLAT" \
  "{\"function\":\"TokenContract:TransferTokens\",\"Args\":[\"TRX_SEED_INV_${TS}\",\"CFT\",\"PLATFORM\",\"$INV_ID\",\"50000000\",\"INR\",\"INITIAL_FUNDING\",\"\"]}"
invoke_inv "$PEER_PLAT" \
  "{\"function\":\"TokenContract:TransferTokens\",\"Args\":[\"TRX_SEED_VAL_${TS}\",\"CFT\",\"PLATFORM\",\"VALIDATOR001\",\"1000\",\"INR\",\"INITIAL_FUNDING\",\"\"]}"

log "12) CreateInvestmentProposal $PROP_ID (investment)"
switch investor
invoke_inv "$PEER_INV" \
  "{\"function\":\"InvestorContract:CreateInvestmentProposal\",\"Args\":[\"$PROP_ID\",\"$CAMP_ID\",\"$INV_ID\",\"$STARTUP_ID\",\"20000000\",\"USD\",\"15\",\"3 years\",\"[{\\\"milestoneId\\\":\\\"M1\\\",\\\"title\\\":\\\"Beta Launch\\\",\\\"amount\\\":10000000},{\\\"milestoneId\\\":\\\"M2\\\",\\\"title\\\":\\\"100 Users\\\",\\\"amount\\\":10000000}]\",\"Caliper dual seed proposal terms\"]}" \
  || { echo "FATAL: CreateInvestmentProposal failed (is campaign published?)"; exit 1; }

log "12b) WitnessAgreement $AGREE_ID (investment) → creates $ESCROW_ID"
switch platform
invoke_inv "$PEER_PLAT" \
  "{\"function\":\"PlatformContract:WitnessAgreement\",\"Args\":[\"$AGREE_ID\",\"$CAMP_ID\",\"$STARTUP_ID\",\"$INV_ID\",\"20000000\",\"USD\",\"[{\\\"milestoneId\\\":\\\"$MILESTONE_ID\\\",\\\"title\\\":\\\"Beta Launch\\\",\\\"amount\\\":10000000}]\"]}" \
  || echo "(agreement may already exist)"

log "12c) SubmitMilestoneReport $REPORT_ID (governance / startup)"
switch startup
invoke_gov \
  "{\"function\":\"StartupContract:SubmitMilestoneReport\",\"Args\":[\"$REPORT_ID\",\"$CAMP_ID\",\"$MILESTONE_ID\",\"$AGREE_ID\",\"Beta Launch Completed\",\"Caliper dual seed milestone\",\"[\\\"evidence.pdf\\\"]\"]}" \
  || echo "(milestone report may already exist)"

log "12d) VerifyMilestoneCompletion $VER_ID (governance / validator)"
switch validator
invoke_gov \
  "{\"function\":\"ValidatorContract:VerifyMilestoneCompletion\",\"Args\":[\"$VER_ID\",\"$MILESTONE_ID\",\"$CAMP_ID\",\"$STARTUP_ID\",\"$REPORT_ID\",\"true\",\"9.5\",\"Caliper seed verified\",\"true\"]}" \
  || echo "(verification may already exist)"

log "12e) ShareMilestoneValidationToPlatform $VER_ID (governance / validator)"
invoke_gov \
  "{\"function\":\"ValidatorContract:ShareMilestoneValidationToPlatform\",\"Args\":[\"$VER_ID\"]}" \
  || echo "(share verification may already exist / failed)"

log "13) Verify key state"
switch platform
for ACC in PLATFORM "$STARTUP_ID" "$INV_ID"; do
  ACC_Q=$(query_inv "{\"function\":\"TokenContract:GetTokenAccount\",\"Args\":[\"$ACC\"]}")
  echo "Token $ACC => ${ACC_Q:0:140}"
  [[ -n "$ACC_Q" && "$ACC_Q" != *"does not exist"* ]] || { echo "FATAL: token account $ACC missing"; exit 1; }
done
switch startup
PUB_Q=$(query_gov "{\"function\":\"StartupContract:CheckPublishNotification\",\"Args\":[\"$CAMP_ID\"]}" || true)
echo "Publish notification (gov): ${PUB_Q:0:200}"

write_state "$SUB_HASH" "$PROOF"

log "DUAL FULL SEED COMPLETE"
echo "State file: $STATE_FILE"
echo "Next: bash $WS/scripts/run-dual-caliper.sh"
