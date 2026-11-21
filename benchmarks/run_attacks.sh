#!/usr/bin/env bash
# Adversarial evaluation (reviewer comment 4) against live networks.
#  1. single-channel suite            -> results/security/single.json
#  2. malicious endorser, OR policy   -> results/security/malicious_or.json
#     malicious endorser, 2-of-4      -> results/security/malicious_k2.json
#  3. dual-channel suite              -> results/security/dual.json
set -euo pipefail
cd "$(dirname "$0")"
OUT=results/security; mkdir -p "$OUT"
ALL4="'StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer'"
run() { docker run --rm --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro -e NODE_PATH=/b/loadgen/node_modules \
          node:22-slim node /b/attacks/attacks.js "$1" "/b/$OUT/$2.json"; }

[ -f attacks/forged/c.pem ] || { mkdir -p attacks/forged
  openssl ecparam -name prime256v1 -genkey -noout -out attacks/forged/k.pem
  openssl req -new -x509 -key attacks/forged/k.pem -out attacks/forged/c.pem -days 30 \
    -subj "/C=US/O=investororg.example.com/OU=client/CN=User1@investororg.example.com"; }

# tampered chaincode: identical except the insufficient-balance check is removed
M=work/build/crowdfunding_malicious; rm -rf "$M"; cp -r work/build/crowdfunding "$M"
sed -i 's/if fromAccount.Balances\[tokenType\] < amount {/if false \&\& fromAccount.Balances[tokenType] < amount {/' "$M/token_operations.go"
grep -q 'if false && fromAccount' "$M/token_operations.go"
(cd "$M" && CGO_ENABLED=0 go build -o ../../bin/crowdfunding_malicious .)

./network.sh up 1 1 single
run single single
# compromise StartupOrg: swap its chaincode server for the tampered build (same package ID)
PKG=$(cat work/net/pkgid_crowdfunding)
docker rm -f peer0startuporg-crowdfunding >/dev/null
docker run -d --restart unless-stopped --name peer0startuporg-crowdfunding --hostname peer0startuporg-crowdfunding --network cfnet -v "$PWD/work/bin":/bin-cc:ro \
  -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 -e CHAINCODE_ID="$PKG" hyperledger/fabric-baseos:2.5 /bin-cc/crowdfunding_malicious >/dev/null
sleep 3
run malicious-OR malicious_or
./network.sh policy crowdfunding "OutOf(2,$ALL4)"; sleep 5
run malicious-K2 malicious_k2

./network.sh up 1 1 dual
run dual dual
./network.sh down
echo ATTACKS_DONE
