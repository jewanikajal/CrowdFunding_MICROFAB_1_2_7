#!/usr/bin/env bash
# Cost of the security hardening: same hardware/topology as E1 (4 peers, 1 orderer, batch 2s/500).
set -uo pipefail
cd "$(dirname "$0")"
R=results/raw; DUR=20
round() { [ -f "$R/$1.json" ] && return; timeout 900 python3 bench.py "$1" "$2" "$3" $(( $3 * DUR )) --tag H ${4:+--chaincode $4} || echo "FAILED $1"; sleep 5; }
HARDENED=1 CC_SUFFIX=_hardened TOKEN_BIN=crowdfunding_hardened ./network.sh up 1 1 single
for t in 25 50 100 150 200; do round "H_single_register_h_$t" register_h $t; done
for t in 25 50 100 150 200 300; do round "H_single_token_h_$t" token_h $t cftoken; done
./network.sh down
echo HPERF_DONE
