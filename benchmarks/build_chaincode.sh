#!/usr/bin/env bash
# Build the three original chaincodes as static CCaaS binaries (source is copied, never modified).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
OUT="$HERE/work/bin"; mkdir -p "$OUT"
build() { # name srcdir
  local b="$HERE/work/build/$1"; rm -rf "$b"; mkdir -p "$b"
  cp "$2"/*.go "$2"/go.mod "$b"/; [ -f "$2/go.sum" ] && cp "$2/go.sum" "$b"/
  [ -d "$2/META-INF" ] && cp -r "$2/META-INF" "$b"/
  sed -i -E 's/([A-Za-z_]+)\.Start\(\)/startCC(\1)/' "$b/main.go"
  cp "$HERE/chaincode/ccaas.go.tmpl" "$b/ccaas.go"
  (cd "$b" && go mod tidy >/dev/null 2>&1 && CGO_ENABLED=0 go build -o "$OUT/$1" .)
  echo "built $1"
}
build crowdfunding "$ROOT/CF_SingleChannel/crowdfundingv2/contracts"
build crowdfunding_hardened "$ROOT/CF_SingleChannel/crowdfundingv2_hardened/contracts"
build governance   "$ROOT/CF_DualChannel/crowdfunding_dualchannel_v2/contracts/governance"
build investment   "$ROOT/CF_DualChannel/crowdfunding_dualchannel_v2/contracts/investment"
# v3: verifiable outbox + relay cross-channel synchronisation + security hardening
build governance_v3 "$ROOT/CF_DualChannel/crowdfunding_dualchannel_v3/contracts/governance"
build investment_v3 "$ROOT/CF_DualChannel/crowdfunding_dualchannel_v3/contracts/investment"
