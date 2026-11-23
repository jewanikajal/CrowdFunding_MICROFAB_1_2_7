#!/usr/bin/env bash
# One-shot: full E2E seed → Caliper (Dual) → save report.
# Usage:
#   bash scripts/run-dual-caliper.sh           # DEFAULT: 25 ops × low/medium/stress
#   bash scripts/run-dual-caliper.sh full      # same as default
#   bash scripts/run-dual-caliper.sh smoke     # CreateStartup L/M/S only
#   SKIP_SEED=1 bash scripts/run-dual-caliper.sh
set -euo pipefail

export CALIPER_TX_TIMEOUT_MS="${CALIPER_TX_TIMEOUT_MS:-30000}"

WS="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WS"

MODE="${1:-full}"
case "$MODE" in
  smoke|t12)
    BENCH="benchconfig-dual.yaml"
    REPORT="report-dual-smoke.html"
    ;;
  full|*)
    BENCH="benchconfig-dual-full.yaml"
    REPORT="report-dual-full.html"
    ;;
esac

echo "============================================================"
echo " Dual-channel Caliper pipeline"
echo " Workspace : $WS"
echo " Mode      : $MODE"
echo " Bench     : $BENCH"
echo " Report    : $REPORT"
echo " Microfab  : http://127.0.0.1:7070"
echo "============================================================"

echo ""
echo ">>> STEP 0/3: Dual peer health (abort if validator/platform 502)"
bash "$WS/scripts/check-dual-peers.sh"

echo ""
echo ">>> STEP 1/3: Sync + verify crypto PEMs (wallets ↔ crypto/dual)"
bash "$WS/scripts/sync-crypto-pems.sh" dual

if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  echo ""
  echo ">>> STEP 2/3: Full E2E seed (tokens → publish → proposal)"
  bash "$WS/scripts/seed-dual-full.sh"
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
  --caliper-networkconfig network-dual.yaml \
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
