#!/usr/bin/env bash
# Fail fast if dual Microfab peers cannot endorse (502/Unavailable).
# Empty ledger ("not found") is HEALTHY on a fresh deploy — seed creates data later.
# Usage: bash scripts/check-dual-peers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DUAL="$ROOT/crowdfunding_dualchannel_v2"
ORDERER="orderer-api.127-0-0-1.nip.io:7070"
GOV_CH="governance-validation-channel"
GOV_CC="governance"
INV_CH="investment-execution-channel"
INV_CC="investment"

cd "$DUAL"

ok=0
fail=0

# Peer answered endorsement if we get chaincode payload OR a business "not found",
# not a transport 502/Unavailable.
peer_reachable() {
  local out="$1"
  if [[ "$out" == *"502"* || "$out" == *"Unavailable"* || "$out" == *"Bad Gateway"* \
     || "$out" == *"connection refused"* || "$out" == *"error endorsing"* \
     || "$out" == *"rpc error"* ]]; then
    # chaincode "not found" sometimes wraps as endorsement failure — allow those
    if [[ "$out" == *"not found"* || "$out" == *"does not exist"* \
       || "$out" == *"already initialized"* || "$out" == *"no such"* ]]; then
      return 0
    fi
    return 1
  fi
  return 0
}

check_gov_query() {
  local org="$1"
  # shellcheck disable=SC1091
  source ./deploy_chaincode.sh switch "$org" >/dev/null
  local out
  out="$(peer chaincode query -o "$ORDERER" --channelID "$GOV_CH" -n "$GOV_CC" \
      -c '{"function":"StartupContract:GetStartup","Args":["STARTUP001"]}' 2>&1)" || true
  if peer_reachable "$out"; then
    if [[ "$out" == *"startupId"* ]]; then
      echo "  OK  $org ($CORE_PEER_ADDRESS) — ledger has STARTUP001"
    else
      echo "  OK  $org ($CORE_PEER_ADDRESS) — peer endorsing (empty ledger OK)"
    fi
    ok=$((ok + 1))
    return 0
  fi
  echo "  FAIL $org ($CORE_PEER_ADDRESS): $(echo "$out" | head -c 160)"
  fail=$((fail + 1))
  return 1
}

echo "============================================================"
echo " Dual peer health (fresh network OK — missing seed data is fine)"
echo "============================================================"

check_gov_query startup || true
check_gov_query validator || true
check_gov_query platform || true

# shellcheck disable=SC1091
source ./deploy_chaincode.sh switch platform >/dev/null
inv_out="$(peer chaincode query -o "$ORDERER" --channelID "$INV_CH" -n "$INV_CC" \
    -c '{"function":"TokenContract:GetTokenMetadata","Args":["CFT"]}' 2>&1)" || true
if peer_reachable "$inv_out"; then
  echo "  OK  investment/platform — peer endorsing"
  ok=$((ok + 1))
else
  echo "  FAIL investment/platform: $(echo "$inv_out" | head -c 160)"
  fail=$((fail + 1))
fi

echo "------------------------------------------------------------"
if (( fail > 0 )); then
  echo "UNHEALTHY: $fail peer(s) unreachable (502/Unavailable)."
  echo "Restart Microfab dual + redeploy, then re-run this check."
  exit 1
fi
echo "All dual peers healthy ($ok checks). Safe to seed / Caliper."
exit 0
