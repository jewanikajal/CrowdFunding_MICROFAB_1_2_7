#!/usr/bin/env bash
# Re-run the adversarial suite against the HARDENED chaincodes (same attack IDs) + positive controls.
#   results/security_hardened/{single,malicious,dual}.json
set -euo pipefail
cd "$(dirname "$0")"
OUT=results/security_hardened; mkdir -p "$OUT" work/relay
run() { docker run --rm --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
          node:22-slim node /b/attacks/hardened.js "$1" "/b/$OUT/$1.json"; }
[ -f attacks/forged/c.pem ] || { mkdir -p attacks/forged
  openssl ecparam -name prime256v1 -genkey -noout -out attacks/forged/k.pem
  openssl req -new -x509 -key attacks/forged/k.pem -out attacks/forged/c.pem -days 30 \
    -subj "/C=US/O=investororg.example.com/OU=client/CN=User1@investororg.example.com"; }

# tampered cftoken for the compromised StartupOrg: balance AND ownership checks removed
M=work/build/crowdfunding_hardened_malicious; rm -rf "$M"; cp -r work/build/crowdfunding_hardened "$M"
sed -i 's/if fromAccount.Balances\[tokenType\] < amount {/if false \&\& fromAccount.Balances[tokenType] < amount {/' "$M/token_operations.go"
sed -i 's/^func requireAccountControl(ctx contractapi.TransactionContextInterface, acct \*TokenAccount) error {/&\n\tif true {\n\t\treturn nil\n\t}/' "$M/security.go"
grep -q 'if false && fromAccount' "$M/token_operations.go"
(cd "$M" && CGO_ENABLED=0 go build -o ../../bin/crowdfunding_hardened_malicious .)

# 1. hardened single channel
STAGES=${STAGES:-"single malicious dual"}
if [[ " $STAGES " == *" single "* ]]; then
HARDENED=1 CC_SUFFIX=_hardened TOKEN_BIN=crowdfunding_hardened ./network.sh up 1 1 single
run single
# 2. compromise StartupOrg's cftoken chaincode server
PKG=$(cat work/net/pkgid_cftoken)
docker rm -f peer0startuporg-cftoken >/dev/null
docker run -d --restart unless-stopped --name peer0startuporg-cftoken --hostname peer0startuporg-cftoken --network cfnet -v "$PWD/work/bin":/bin-cc:ro \
  -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 -e CHAINCODE_ID="$PKG" hyperledger/fabric-baseos:2.5 /bin-cc/crowdfunding_hardened_malicious >/dev/null
sleep 3
run malicious
fi
# 3. hardened dual channel (v3) with relay
if [[ " $STAGES " == *" dual "* ]]; then
rm -rf work/relay/*
HARDENED=1 CC_SUFFIX=_v3 TOKEN_BIN=investment_v3 ./network.sh up 1 1 dual
docker run -d --name relay --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
  node:22-slim node /b/bridge/relay.js '{"org":"PlatformOrg","stateDir":"/b/work/relay","statsFile":"/b/results/security_hardened/.relay.jsonl","batch":50}' >/dev/null
sleep 5
run dual
docker rm -f relay >/dev/null 2>&1 || true
fi
./network.sh down
echo HARDENED_ATTACKS_DONE
