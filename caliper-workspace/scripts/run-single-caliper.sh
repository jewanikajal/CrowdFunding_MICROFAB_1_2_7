#!/usr/bin/env bash
# One-shot: full E2E seed → Caliper (Single) → save report.
# Usage:
#   bash scripts/run-single-caliper.sh           # DEFAULT: 25 ops × low/medium/stress
#   bash scripts/run-single-caliper.sh full      # same as default
#   bash scripts/run-single-caliper.sh t12       # 25 ops, low only (smoke)
#   bash scripts/run-single-caliper.sh all6      # 6 core ops × L/M/S
#   SKIP_SEED=1 bash scripts/run-single-caliper.sh
set -euo pipefail

# Fail hung peer calls instead of freezing the round (multi-step workloads kept).
export CALIPER_TX_TIMEOUT_MS="${CALIPER_TX_TIMEOUT_MS:-30000}"

WS="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WS"

MODE="${1:-full}"
case "$MODE" in
  t12|smoke)
    BENCH="benchconfig-single-t12.yaml"
    REPORT="report-single-t12.html"
    ;;
  all6|six)
    BENCH="benchconfig-single.yaml"
    REPORT="report-single-all6.html"
    ;;
  full|*)
    BENCH="benchconfig-single-full.yaml"
    REPORT="report-single-full.html"
    ;;
esac

echo "============================================================"
echo " Single-channel Caliper pipeline"
echo " Workspace : $WS"
echo " Mode      : $MODE"
echo " Bench     : $BENCH"
echo " Report    : $REPORT"
echo "============================================================"

echo ""
echo ">>> STEP 1/3: Sync + verify crypto PEMs (wallets ↔ crypto/single)"
bash "$WS/scripts/sync-crypto-pems.sh" single

if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  echo ""
  echo ">>> STEP 2/3: Full E2E seed (tokens → publish → proposal)"
  bash "$WS/scripts/seed-single-full.sh"
  if [[ ! -f "$WS/seed-state.json" ]]; then
    echo "ERROR: seed-state.json was not created"
    exit 1
  fi
  echo "seed-state.json:"
  cat "$WS/seed-state.json"
else
  echo "SKIP_SEED=1 — using existing seed-state.json (if any)"
fi

echo ""
echo ">>> STEP 3/3: Caliper launch manager"
npx caliper launch manager \
  --caliper-workspace ./ \
  --caliper-networkconfig network-single.yaml \
  --caliper-benchconfig "$BENCH" \
  --caliper-flow-only-test \
  --caliper-fabric-gateway-enabled

if [[ -f report.html ]]; then
  mv -f report.html "$REPORT"
  echo "Saved report → $WS/$REPORT"
else
  echo "WARNING: report.html not found"
fi

echo "============================================================"
echo " DONE"
echo "============================================================"
