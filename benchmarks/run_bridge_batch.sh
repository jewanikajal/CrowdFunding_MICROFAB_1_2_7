#!/usr/bin/env bash
# v3 bridge with batched ApplySyncBatch (relay groups up to 100 outbox entries per transaction).
set -euo pipefail
cd "$(dirname "$0")"
OUT=results/bridge; mkdir -p "$OUT" work/relay
NODE=(docker run --rm --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules node:22-slim node)
STATS=/b/$OUT/.relay_stats_batch.jsonl
rm -rf work/relay/*; rm -f "$OUT/.relay_stats_batch.jsonl"
CC_SUFFIX=_v3 ./network.sh up 1 1 dual
docker run -d --name relay --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
  node:22-slim node /b/bridge/relay.js "{\"org\":\"PlatformOrg\",\"stateDir\":\"/b/work/relay\",\"statsFile\":\"$STATS\",\"batch\":100}" >/dev/null
sleep 5
for t in 25 50 100 150; do
  "${NODE[@]}" /b/bridge/bridge_bench.js "{\"tps\":$t,\"n\":$((t*30)),\"statsFile\":\"$STATS\",\"out\":\"/b/$OUT/v3batch_sync_$t.json\",\"waitSec\":240,\"tag\":\"v3batch_sync_$t\"}"
  sleep 5
done
docker rm -f relay >/dev/null 2>&1 || true
./network.sh down
echo BRIDGE_BATCH_DONE
