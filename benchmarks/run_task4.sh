#!/usr/bin/env bash
# Task 4: reproduce concurrency failures of TransferTokens, RespondToInvestmentProposal and CreateDispute
# on the ORIGINAL v2 single-channel chaincode with the paper's three Caliper rounds
# (light 50 tx @ 10 TPS, medium 100 tx @ 25 TPS, stress 1000 tx @ 100 TPS) and record Fabric validation codes.
set -uo pipefail
cd "$(dirname "$0")"
./network.sh up 1 1 single "${BT:-2s}" "${BS:-500}"
docker run --rm --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
  node:22-slim node /b/attacks/task4_setup.js 10 1200
round() { timeout 900 python3 bench.py "$1" "$2" "$3" "$4" --tag T4 ${5:+--pool $5} || echo "FAILED $1"; sleep 5; }
for spec in "transfer_v2 hot10 10" "respond_v2 hot10 10" "respond_v2 unique 1200" "dispute_v2 unique 0"; do
  set -- $spec
  for r in "light 10 50" "medium 25 100" "stress 100 1000"; do set -- $spec $r
    round "T4${TAG4:-}_$1_$2_$4" "$1" "$5" "$6" "$([ "$3" != 0 ] && echo $3)"
  done
done
./network.sh down
echo TASK4_DONE
