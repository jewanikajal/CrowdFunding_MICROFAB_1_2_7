#!/usr/bin/env bash
# Parametrised Fabric 2.5 test network for BlockAssist+ benchmarking.
#
#   ./network.sh up <peersPerOrg> <orderers> <single|dual> [batchTimeout] [batchSize]
#   ./network.sh policy <chaincode> "<signature policy>"     # re-approve/commit with new endorsement policy
#   ./network.sh down
#
#   CC_SUFFIX=_v3 ./network.sh up 1 1 dual                 # deploy the v3 (outbox/relay) dual-channel chaincodes
#   CC_SUFFIX=_hardened TOKEN_BIN=crowdfunding_hardened ./network.sh up 1 1 single   # hardened single channel
#   CC_SUFFIX=_v3 TOKEN_BIN=investment_v3 ./network.sh up 1 1 dual                  # hardened dual channel (v3)
#
# Everything (peers, CouchDBs, Raft orderers, chaincode servers, the CLI and the load generator)
# runs as containers on one Docker host, the same single-host model as Microfab.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NET="$HERE/work/net"
TAG="${FABRIC_TAG:-2.5}"
ORGS=(StartupOrg InvestorOrg ValidatorOrg PlatformOrg)
ORDERER_CA=/w/crypto/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
SINGLE_POLICY_DEFAULT="OR('StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer')"

dom() { echo "$(echo "$1" | tr '[:upper:]' '[:lower:]').example.com"; }
tools() { docker run --rm -v "$NET":/w -w /w -e FABRIC_CFG_PATH=/w "hyperledger/fabric-tools:$TAG" "$@"; }
# run a peer CLI command as <org> admin against <peerhost>
cli() { local org=$1 host=$2; shift 2; local d; d=$(dom "$org")
  docker exec -e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_LOCALMSPID="${org}MSP" \
    -e CORE_PEER_MSPCONFIGPATH="/w/crypto/peerOrganizations/$d/users/Admin@$d/msp" \
    -e CORE_PEER_TLS_ROOTCERT_FILE="/w/crypto/peerOrganizations/$d/peers/$host/tls/ca.crt" \
    -e CORE_PEER_ADDRESS="$host:7051" cfcli "$@"; }
jq_py() { python3 -c "import json,sys; d=json.load(open('$NET/net.json')); $1"; }

channels_of() { jq_py "print(' '.join(k for k,v in d['channels'].items() if '$1' in v))"; }
orgs_of()     { jq_py "print(' '.join(d['channels']['$1']))"; }
all_channels(){ jq_py "print(' '.join(d['channels']))"; }
peers_of()    { jq_py "print(' '.join(p['host'] for p in d['peers'] if p['org']=='$1'))"; }
short_of()    { jq_py "print([p['short'] for p in d['peers'] if p['host']=='$1'][0])"; }
cc_for()      { case "$1" in crowdfunding-channel) echo crowdfunding;; governance-validation-channel) echo governance;; investment-execution-channel) echo investment;; esac; }
collections_for() {
  if [ -n "${HARDENED:-}" ]; then case "$1" in   # hardened v3: PDC-consistent collection policies
    governance) echo "$HERE/../CF_DualChannel/crowdfunding_dualchannel_v3/collections_config_governance_hardened.json"; return;;
    investment) echo "$HERE/../CF_DualChannel/crowdfunding_dualchannel_v3/collections_config_investment_hardened.json"; return;;
  esac; fi
  case "$1" in
  crowdfunding) echo "$HERE/../CF_SingleChannel/crowdfundingv2/collections_config.json";;
  governance)   echo "$HERE/../CF_DualChannel/crowdfunding_dualchannel_v2/collections_config_governance.json";;
  investment)   echo "$HERE/../CF_DualChannel/crowdfunding_dualchannel_v2/collections_config_investment.json";;
  cftoken)      echo "";; esac; }
policy_for() { case "$1" in
  crowdfunding) echo "${SINGLE_POLICY:-$SINGLE_POLICY_DEFAULT}";;
  governance)   if [ -n "${HARDENED:-}" ]; then   # AND(Validator,Platform) cannot coexist with Startup-only PDC reads
                  echo "OR('StartupOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer')"
                else echo "AND('ValidatorOrgMSP.peer','PlatformOrgMSP.peer')"; fi;;   # as in the paper / deploy_chaincode.sh
  investment)   echo "OR('StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer')";;
  cftoken)      echo "OutOf(2,'StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer')";; esac; }

down() {
  docker ps -aq --filter network=cfnet | xargs -r docker rm -f >/dev/null 2>&1 || true
  docker network rm cfnet >/dev/null 2>&1 || true
  docker volume prune -f >/dev/null 2>&1 || true
  rm -rf "$NET"
}

approve_commit() { # cc channel sequence policy
  local cc=$1 ch=$2 seq=$3 pol=$4 pkg; pkg=$(cat "$NET/pkgid_$cc")
  local coll=(); local cf; cf=$(collections_for "$cc")
  if [ -n "$cf" ]; then cp "$cf" "$NET/coll_$cc.json"; coll=(--collections-config "/w/coll_$cc.json"); fi
  local o; local peerargs=()
  for o in $(orgs_of "$ch"); do
    local d; d=$(dom "$o")
    cli "$o" "peer0.$d" peer lifecycle chaincode approveformyorg -o orderer0.example.com:7050 --tls --cafile $ORDERER_CA \
      --channelID "$ch" --name "$cc" --version 1.0 --package-id "$pkg" --sequence "$seq" \
      --signature-policy "$pol" "${coll[@]}" >/dev/null 2>&1
    peerargs+=(--peerAddresses "peer0.$d:7051" --tlsRootCertFiles "/w/crypto/peerOrganizations/$d/peers/peer0.$d/tls/ca.crt")
  done
  local first; first=$(orgs_of "$ch" | awk '{print $1}')
  cli "$first" "peer0.$(dom "$first")" peer lifecycle chaincode commit -o orderer0.example.com:7050 --tls --cafile $ORDERER_CA \
    --channelID "$ch" --name "$cc" --version 1.0 --sequence "$seq" \
    --signature-policy "$pol" "${coll[@]}" "${peerargs[@]}" >/dev/null 2>&1
  echo "$seq" > "$NET/seq_$cc"; echo "$pol" > "$NET/policy_$cc"; echo "  committed $cc seq=$seq policy=$pol"
}

up() {
  local P=${1:-1} M=${2:-1} T=${3:-single} BT=${4:-2s} BS=${5:-500}
  down
  python3 "$HERE/netgen.py" --peers "$P" --orderers "$M" --topology "$T" --batch-timeout "$BT" --batch-size "$BS" --workdir "$NET"
  tools cryptogen generate --config=crypto-config.yaml --output=crypto >/dev/null
  mkdir -p "$NET/blocks"
  for ch in $(all_channels); do tools configtxgen -profile "$ch" -outputBlock "blocks/$ch.block" -channelID "$ch" >/dev/null 2>&1; done
  chmod -R a+rX "$NET"
  (cd "$NET" && docker compose up -d >/dev/null 2>&1)
  docker run -d --name cfcli --network cfnet -v "$NET":/w -w /w "hyperledger/fabric-tools:$TAG" sleep infinity >/dev/null
  sleep 6
  local i ch
  for ((i=0;i<M;i++)); do local ob=/w/crypto/ordererOrganizations/example.com/orderers/orderer$i.example.com/tls
    for ch in $(all_channels); do
      docker exec cfcli osnadmin channel join --channelID "$ch" --config-block "/w/blocks/$ch.block" -o "orderer$i.example.com:7053" \
        --ca-file "$ob/ca.crt" --client-cert "$ob/server.crt" --client-key "$ob/server.key" >/dev/null
    done; done
  sleep 4
  local o h
  for o in "${ORGS[@]}"; do for ch in $(channels_of "$o"); do for h in $(peers_of "$o"); do
    local n; for n in 1 2 3 4 5; do cli "$o" "$h" peer channel join -b "/w/blocks/$ch.block" >/dev/null 2>&1 && break; sleep 3; done
  done; done; done
  echo "network up: peersPerOrg=$P orderers=$M topology=$T batch=$BT/$BS"
  deploy
  sleep 3; seed
}

deploy_cc() { # channel chaincode-name binary
  local ch=$1 cc=$2 bin=$3
  # ---- CCaaS package (connection.json is templated per peer by the ccaas builder)
  local pk="$NET/pkg_$cc"; mkdir -p "$pk"
  printf '{"address":"{{.peername}}-%s:9999","dial_timeout":"10s","tls_required":false}' "$cc" > "$pk/connection.json"
  printf '{"type":"ccaas","label":"%s_1.0"}' "$cc" > "$pk/metadata.json"
  (cd "$pk" && tar czf code.tar.gz connection.json && tar czf "$NET/$cc.tgz" metadata.json code.tar.gz)
  local pkg; pkg=$(docker exec cfcli peer lifecycle chaincode calculatepackageid "/w/$cc.tgz")
  echo "$pkg" > "$NET/pkgid_$cc"; echo "$bin" > "$NET/bin_$cc"
  local o h
  for o in $(orgs_of "$ch"); do for h in $(peers_of "$o"); do
    local s; s=$(short_of "$h")
    docker run -d --restart unless-stopped --name "$s-$cc" --hostname "$s-$cc" --network cfnet -v "$HERE/work/bin":/bin-cc:ro \
      -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 -e CHAINCODE_ID="$pkg" "hyperledger/fabric-baseos:$TAG" "/bin-cc/$bin" >/dev/null
    cli "$o" "$h" peer lifecycle chaincode install "/w/$cc.tgz" >/dev/null 2>&1 || true
  done; done
  approve_commit "$cc" "$ch" 1 "$(policy_for "$cc")"
}

# Hardened mode: TOKEN_BIN=<binary> additionally deploys the token ledger as its own
# chaincode "cftoken" with an OutOf(2,4) endorsement policy (CC_SUFFIX selects main binaries).
deploy() {
  local ch cc
  for ch in $(all_channels); do
    cc=$(cc_for "$ch"); deploy_cc "$ch" "$cc" "$cc${CC_SUFFIX:-}"
  done
  if [ -n "${TOKEN_BIN:-}" ]; then
    local tch=crowdfunding-channel; [ -f "$NET/pkgid_investment" ] && tch=investment-execution-channel
    deploy_cc "$tch" cftoken "$TOKEN_BIN"
  fi
}

seed() { # create ACC_SEED for the read-only query workload
  local ch=crowdfunding-channel cc=crowdfunding extra=()
  [ -f "$NET/pkgid_investment" ] && ch=investment-execution-channel && cc=investment
  if [ -f "$NET/pkgid_cftoken" ]; then cc=cftoken   # hardened: token ledger needs 2 endorsing orgs
    extra=(--peerAddresses peer0.investororg.example.com:7051 --tlsRootCertFiles /w/crypto/peerOrganizations/investororg.example.com/peers/peer0.investororg.example.com/tls/ca.crt); fi
  cli PlatformOrg peer0.platformorg.example.com peer chaincode invoke -o orderer0.example.com:7050 --tls --cafile $ORDERER_CA \
    -C "$ch" -n "$cc" --peerAddresses peer0.platformorg.example.com:7051 \
    --tlsRootCertFiles /w/crypto/peerOrganizations/platformorg.example.com/peers/peer0.platformorg.example.com/tls/ca.crt "${extra[@]}" \
    --waitForEvent -c '{"function":"TokenContract:CreateTokenAccount","Args":["ACC_SEED","seed","USER","{}"]}' >/dev/null 2>&1
  echo "  seeded ACC_SEED on $ch"
}

case "${1:-}" in
  seed) seed;;
  up) shift; up "$@";;
  down) down; echo "network down";;
  policy) cc=$2; pol=$3; ch=$(jq_py "print([k for k in d['channels']][0])")
          for c in $(all_channels); do [ "$(cc_for "$c")" = "$cc" ] && ch=$c; done
          approve_commit "$cc" "$ch" $(( $(cat "$NET/seq_$cc") + 1 )) "$pol";;
  *) echo "usage: $0 up P M single|dual [bt] [bs] | policy cc 'pol' | down"; exit 1;;
esac
