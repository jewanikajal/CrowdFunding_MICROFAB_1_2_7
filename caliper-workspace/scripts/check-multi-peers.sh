#!/usr/bin/env bash
# Fail fast if multi Microfab peers cannot endorse (502/Unavailable).
# Empty ledger ("not found") is HEALTHY on a fresh deploy — seed creates data later.
# Usage: bash scripts/check-multi-peers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ORDERER="orderer-api.127-0-0-1.nip.io:8080"
SV_CH="startup-validator-channel"
COMMON_CH="common-channel"

cd "$ROOT"

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
  # deploy_chaincode.sh main() reads $3; under set -u that unbound arg aborts.
  set +u
  # shellcheck disable=SC1091
  source ./deploy_chaincode.sh switch "$1" >/dev/null
  set -u
}

check_startup_query() {
  local org="$1"
  switch_org "$org"
  local out
  out="$(peer chaincode query -o "$ORDERER" --channelID "$SV_CH" -n startup \
      -c '{"function":"GetStartup","Args":["STARTUP001"]}' 2>&1)" || true
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
echo " Multi peer health (fresh network OK — missing seed data is fine)"
echo "============================================================"

if ! curl -sf -m 5 "http://127.0.0.1:8080/ak/api/v1/health" >/dev/null; then
  echo "FAIL Microfab health http://127.0.0.1:8080/ak/api/v1/health"
  echo "Start multi Microfab + deploy chaincodes first (see MICROFAB.txt)."
  exit 1
fi
echo "  OK  Microfab HTTP :8080"

check_startup_query startup || true
check_startup_query validator || true

switch_org platform
plat_out="$(peer chaincode query -o "$ORDERER" --channelID "$COMMON_CH" -n platform \
    -c '{"function":"TokenContract:GetTokenMetadata","Args":["CFT"]}' 2>&1)" || true
if peer_reachable "$plat_out"; then
  echo "  OK  common/platform — peer endorsing"
  ok=$((ok + 1))
else
  echo "  FAIL common/platform: $(echo "$plat_out" | head -c 160)"
  fail=$((fail + 1))
fi

switch_org investor
inv_out="$(peer chaincode query -o "$ORDERER" --channelID "investor-platform-channel" -n investor \
    -c '{"function":"GetInvestor","Args":["INVESTOR001"]}' 2>&1)" || true
if peer_reachable "$inv_out"; then
  echo "  OK  investor-platform/investor — peer endorsing"
  ok=$((ok + 1))
else
  # GetInvestor may not exist — retry with a harmless missing key style
  if [[ "$inv_out" == *"Unknown"* || "$inv_out" == *"function"* ]]; then
    echo "  OK  investor-platform/investor — peer answered (fn may differ; empty OK)"
    ok=$((ok + 1))
  else
    echo "  FAIL investor-platform/investor: $(echo "$inv_out" | head -c 160)"
    fail=$((fail + 1))
  fi
fi

echo "------------------------------------------------------------"
if (( fail > 0 )); then
  echo "UNHEALTHY: $fail peer(s) unreachable (502/Unavailable)."
  echo "Restart Microfab multi + redeploy, then re-run this check."
  exit 1
fi
echo "All multi peers healthy ($ok checks). Safe to seed / Caliper."
exit 0
