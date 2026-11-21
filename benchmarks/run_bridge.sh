#!/usr/bin/env bash
# Cross-channel synchronisation evaluation (reviewer comment 3).
set -euo pipefail
cd "$(dirname "$0")"
OUT=results/bridge; mkdir -p "$OUT" work/relay
NODE=(docker run --rm --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules node:22-slim node)
STATS=/b/$OUT/.relay_stats.jsonl
relay_start() { docker run -d --name relay --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
  node:22-slim node /b/bridge/relay.js "{\"org\":\"PlatformOrg\",\"stateDir\":\"/b/work/relay\",\"statsFile\":\"$STATS\"}" >/dev/null; }
bench() { "${NODE[@]}" /b/bridge/bridge_bench.js "{\"tps\":$1,\"n\":$2,\"statsFile\":\"$STATS\",\"out\":\"/b/$OUT/$3.json\",\"waitSec\":${4:-180},\"tag\":\"$3\"}"; }

# --- v2 baseline (no relay; v2 relies on cross-channel InvokeChaincode writes)
./network.sh up 1 1 dual
rm -f "$OUT/.relay_stats.jsonl"
bench 25 750 v2_baseline_25 15 || true

# --- v3 outbox + relay
rm -rf work/relay/*; rm -f "$OUT/.relay_stats.jsonl"
CC_SUFFIX=_v3 ./network.sh up 1 1 dual
relay_start; sleep 5
for t in 10 25 50 100 150; do bench $t $((t*30)) v3_sync_$t; sleep 5; done
# crash/recovery: relay killed 10 s into a 30 s run, restarted 20 s later
( sleep 10; docker kill relay >/dev/null; docker rm relay >/dev/null; echo "[relay killed]"; sleep 20; relay_start; echo "[relay restarted]" ) &
bench 50 1500 v3_crash_50 240
wait
"${NODE[@]}" /b/bridge/tamper.js /b/$OUT/v3_tamper.json
docker rm -f relay >/dev/null 2>&1 || true
./network.sh down
echo BRIDGE_DONE
