#!/usr/bin/env bash
# Full benchmark matrix answering reviewer comment 2. Resumable: rounds whose result exists are skipped.
#   ./run_matrix.sh [E1 E2 ...]      (default: all experiments)
set -uo pipefail
cd "$(dirname "$0")"
DUR=${DUR:-20}           # seconds of offered load per round
R=results/raw
ALL4="'StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer'"
round() { # name workload tps
  [ -f "$R/$1.json" ] && { echo "skip $1"; return; }
  local tx=$(( ${3%.*} * DUR )); [ $tx -lt 200 ] && tx=200
  timeout 900 python3 bench.py "$1" "$2" "$3" "$tx" --tag "${TAG:-}" || echo "FAILED $1"
  sleep 5
}
need() { # exp-prefix -> true if any round of this config is missing
  local n; for n in "$@"; do [ -f "$R/$n.json" ] || return 0; done; return 1; }
RATES="25 50 100 150 200 300 500"   # register additionally run at 1000 (see E1)
EXPS="${*:-E1 E2 E3 E4 E5 E6}"

for E in $EXPS; do case $E in
E1) # throughput/latency vs offered load, single channel baseline (4 peers, 1 orderer) -- all workloads
  ./network.sh up 1 1 single
  TAG=E1 round E1_single_register_1000 register 1000
  for wl in register invest startup token; do for t in $RATES; do TAG=E1 round "E1_single_${wl}_$t" $wl $t; done; done
  for t in 100 500 1000 2000 4000; do TAG=E1 round "E1_single_query_$t" query $t; done ;;
E2) # dual-channel architecture under the same load
  ./network.sh up 1 1 dual
  for wl in startup invest token; do for t in 25 50 100 150 200 300; do TAG=E2 round "E2_dual_${wl}_$t" $wl $t; done; done
  for t in 100 500 1000 2000 4000; do TAG=E2 round "E2_dual_query_$t" query $t; done ;;
E3) # peer count scaling: 4, 8, 12 peers (1/2/3 per org), 1 orderer
  for P in 1 2 3; do
    ./network.sh up $P 1 single
    for wl in register token; do for t in 50 100 200 300; do TAG=E3 round "E3_p$((P*4))_${wl}_$t" $wl $t; done; done
    TAG=E3 round "E3_p$((P*4))_query_2000" query 2000
  done ;;
E4) # ordering-service scaling: 1, 3, 5 Raft orderers
  for M in 1 3 5; do
    ./network.sh up 1 $M single
    for t in 50 100 200 300; do TAG=E4 round "E4_o${M}_token_$t" token $t; done
  done ;;
E5) # number of endorsers required: 1..4 of 4 orgs (public-state workload)
  ./network.sh up 1 1 single
  for k in 1 2 3 4; do
    ./network.sh policy crowdfunding "OutOf($k,$ALL4)"
    sleep 5
    for t in 50 100 200; do TAG=E5 round "E5_e${k}_token_$t" token $t; done
  done ;;
E6) # orderer batch configuration (latency/throughput trade-off) at 100 TPS
  for cfg in "2s 500" "1s 100" "500ms 50" "250ms 25"; do set -- $cfg
    ./network.sh up 1 1 single "$1" "$2"
    for t in 50 100 200; do TAG=E6 round "E6_bt${1}_bs${2}_token_$t" token $t; done
  done ;;
esac; done
./network.sh down
echo MATRIX_DONE
