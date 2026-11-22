#!/usr/bin/env bash
# Task 1 (SEBI eligibility), Task 5 (SE19 blacklisting), Task 7 (PR04/05/07/09/11) on the v3 code.
set -euo pipefail
cd "$(dirname "$0")"
OUT=results/tasks; mkdir -p "$OUT" work/relay
run() { docker run --rm --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
          node:22-slim node /b/attacks/tasks_tests.js "$1" "/b/$OUT/$1.json"; }
./build_chaincode.sh >/dev/null
HARDENED=1 CC_SUFFIX=_hardened TOKEN_BIN=crowdfunding_hardened ./network.sh up 1 1 single
run single
rm -rf work/relay/*
HARDENED=1 CC_SUFFIX=_v3 TOKEN_BIN=investment_v3 ./network.sh up 1 1 dual
docker run -d --name relay --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
  node:22-slim node /b/bridge/relay.js '{"org":"PlatformOrg","stateDir":"/b/work/relay","statsFile":"/b/work/relay/stats.jsonl","batch":50}' >/dev/null
sleep 5
run dual
docker rm -f relay >/dev/null 2>&1 || true
./network.sh down
echo TASKS_TESTS_DONE
