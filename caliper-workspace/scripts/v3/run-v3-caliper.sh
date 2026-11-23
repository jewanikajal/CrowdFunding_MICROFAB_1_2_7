#!/usr/bin/env bash
# Run the Caliper Table 12 benchmark on the v3 chaincode.
#   scripts/v3/run-v3-caliper.sh <single|dual> [benchconfig] [report-name]
# Network: benchmarks/network.sh (Fabric 2.5.16, 4 orgs x 1 peer, 1 Raft orderer, CouchDB, TLS) with
# Microfab's orderer batching (BatchTimeout 100ms, MaxMessageCount 10). Caliper 0.5.0 (package-lock.json)
# runs inside the Fabric docker network.
set -euo pipefail
ARCH="${1:?single|dual}"
WS="$(cd "$(dirname "$0")/../.." && pwd)"; BM="$WS/../benchmarks"
BENCH="${2:-benchconfig-$ARCH-full.yaml}"
REPORT="${3:-report-v3-$ARCH-full.html}"
NODE_IMG=node:22-slim
cd "$BM"
./build_chaincode.sh >/dev/null
if [ "$ARCH" = single ]; then
  HARDENED=1 CC_SUFFIX=_hardened TOKEN_BIN=crowdfunding_hardened ./network.sh up 1 1 single 100ms 10
else
  HARDENED=1 CC_SUFFIX=_v3 TOKEN_BIN=investment_v3 ./network.sh up 1 1 dual 100ms 10
  rm -rf work/relay/*; mkdir -p work/relay
  docker run -d --name relay --network cfnet -v "$BM":/b -v "$BM/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
    $NODE_IMG node /b/bridge/relay.js '{"org":"PlatformOrg","stateDir":"/b/work/relay","statsFile":"/b/work/relay/stats.jsonl","batch":50}' >/dev/null
  sleep 5
fi
python3 "$WS/scripts/v3/make-network.py" "$ARCH" "$BM/work/net/crypto"
RUN=(docker run --rm --network cfnet -v "$WS":/ws -w /ws -e CALIPER_TX_TIMEOUT_MS="${CALIPER_TX_TIMEOUT_MS:-30000}" -e BRIDGE_WAIT_MS="${BRIDGE_WAIT_MS:-4000}" -e CALIPER_OPLOG_DIR="/ws/oplog-v3-$ARCH" $NODE_IMG)
rm -rf "$WS/oplog-v3-$ARCH"
"${RUN[@]}" node scripts/v3/seed-v3.js "$ARCH"
"${RUN[@]}" npx caliper launch manager \
  --caliper-workspace ./ \
  --caliper-networkconfig "network-v3-$ARCH.yaml" \
  --caliper-benchconfig "$BENCH" \
  --caliper-report-path "$REPORT" \
  --caliper-flow-only-test \
  --caliper-fabric-gateway-enabled 2>&1 | tee "$WS/caliper-v3-$ARCH.log" | grep -E "Finished round|Started round|Failed|Error|error" | grep -v "^\s*$" || true
docker rm -f relay >/dev/null 2>&1 || true
cd "$BM" && ./network.sh down
echo "V3_CALIPER_DONE $ARCH $REPORT"
