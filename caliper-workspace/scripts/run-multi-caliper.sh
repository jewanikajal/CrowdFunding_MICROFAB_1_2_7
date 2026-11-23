#!/usr/bin/env bash
# One-shot: full E2E seed → Caliper (Multi) → save report.
# Usage:
#   bash scripts/run-multi-caliper.sh           # DEFAULT: 25 ops × low/medium/stress
#   bash scripts/run-multi-caliper.sh full      # same as default
#   bash scripts/run-multi-caliper.sh smoke     # CreateStartup L/M/S only
#   bash scripts/run-multi-caliper.sh fix       # P10/P11/P18/P23 only (bootstrap-fixed)
#   SKIP_SEED=1 bash scripts/run-multi-caliper.sh fix
set -euo pipefail

export CALIPER_TX_TIMEOUT_MS="${CALIPER_TX_TIMEOUT_MS:-30000}"

WS="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WS"

MODE="${1:-full}"
case "$MODE" in
  smoke|t12)
    BENCH="benchconfig-multi.yaml"
    REPORT="report-multi-smoke.html"
    ;;
  fix|retry|fix-failed)
    BENCH="benchconfig-multi-fix-failed.yaml"
    REPORT="report-multi-fix-failed.html"
    ;;
  full|*)
    BENCH="benchconfig-multi-full.yaml"
    REPORT="report-multi-full.html"
    ;;
esac

echo "============================================================"
echo " Multi-channel Caliper pipeline"
echo " Workspace : $WS"
echo " Mode      : $MODE"
echo " Bench     : $BENCH"
echo " Report    : $REPORT"
echo " Microfab  : http://127.0.0.1:8080"
echo "============================================================"

echo ""
echo ">>> STEP 0/3: Multi peer health (abort if peers 502)"
bash "$WS/scripts/check-multi-peers.sh"

echo ""
echo ">>> STEP 1/3: Sync + verify crypto PEMs (wallets ↔ crypto/multi)"
bash "$WS/scripts/sync-crypto-pems.sh" multi

if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  echo ""
  echo ">>> STEP 2/3: Full E2E seed (tokens → publish → proposal)"
  bash "$WS/scripts/seed-multi-full.sh"
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
  --caliper-networkconfig network-multi.yaml \
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
