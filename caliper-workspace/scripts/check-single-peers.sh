#!/usr/bin/env bash
# Fail fast if single Microfab peers cannot endorse (502/Unavailable).
# Empty ledger ("not found") is HEALTHY on a fresh deploy — seed creates data later.
# Usage: bash scripts/check-single-peers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SINGLE="$ROOT/crowdfundingv2"
ORDERER="orderer-api.127-0-0-1.nip.io:9090"
CHANNEL="crowdfunding-channel"
CC="crowdfunding"

cd "$SINGLE"

ok=0
fail=0

peer_reachable() {
  local out="$1"
  if [[ "$out" == *"502"* || "$out" == *"Unavailable"* || "$out" == *"Bad Gateway"* \
     || "$out" == *"connection refused"* || "$out" == *"error endorsing"* \
     || "$out" == *"rpc error"* ]]; then
    if [[ "$out" == *"not found"* || "$out" == *"does not exist"* \
       || "$out" == *"already initialized"* || "$out" == *"no such"* ]]; then
      return 0
    fi
    return 1
  fi
  return 0
}

switch_org() {
  # deploy_chaincode.sh main() may read unbound $3 under set -u.
  set +u
  # shellcheck disable=SC1091
  source ./deploy_chaincode.sh switch "$1" >/dev/null
  set -u
}

check_query() {
  local org="$1"
  local fcn="$2"
  local args_json="$3"
  local label="${4:-$org}"
  switch_org "$org"
  local out
  out="$(peer chaincode query -o "$ORDERER" --channelID "$CHANNEL" -n "$CC" \
      -c "{\"function\":\"$fcn\",\"Args\":$args_json}" 2>&1)" || true
  if peer_reachable "$out"; then
    if [[ "$out" == *"startupId"* || "$out" == *"symbol"* || "$out" == *"accountId"* ]]; then
      echo "  OK  $label ($CORE_PEER_ADDRESS) — ledger has data"
    else
      echo "  OK  $label ($CORE_PEER_ADDRESS) — peer endorsing (empty ledger OK)"
    fi
    ok=$((ok + 1))
    return 0
  fi
  echo "  FAIL $label ($CORE_PEER_ADDRESS): $(echo "$out" | head -c 160)"
  fail=$((fail + 1))
  return 1
}

echo "============================================================"
echo " Single peer health (fresh network OK — missing seed data is fine)"
echo "============================================================"

if ! curl -sf -m 5 "http://127.0.0.1:9090/ak/api/v1/health" >/dev/null; then
  echo "FAIL Microfab health http://127.0.0.1:9090/ak/api/v1/health"
  echo "Start single Microfab + deploy chaincode first (crowdfundingv2)."
  exit 1
fi
echo "  OK  Microfab HTTP :9090"

check_query startup "StartupContract:GetStartup" '["STARTUP001"]' "startup" || true
check_query validator "StartupContract:GetStartup" '["STARTUP001"]' "validator" || true
check_query platform "TokenContract:GetTokenMetadata" '["CFT"]' "platform" || true
check_query investor "InvestorContract:GetInvestor" '["INVESTOR001"]' "investor" || true

echo "------------------------------------------------------------"
if (( fail > 0 )); then
  echo "UNHEALTHY: $fail peer(s) unreachable (502/Unavailable)."
  echo "Restart Microfab single + redeploy, then re-run this check."
  exit 1
fi
echo "All single peers healthy ($ok checks). Safe to seed / Caliper."
exit 0
