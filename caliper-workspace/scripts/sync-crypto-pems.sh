#!/usr/bin/env bash
# Export wallet identities → crypto/<arch>/<Org>/{cert,key,mspId}.pem
# Then verify Caliper PEMs match Microfab wallets (re-export + recheck on mismatch).
#
# Usage:
#   bash scripts/sync-crypto-pems.sh              # single (default)
#   bash scripts/sync-crypto-pems.sh single
#   bash scripts/sync-crypto-pems.sh dual
#   bash scripts/sync-crypto-pems.sh multi
set -euo pipefail

WS="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$WS/.." && pwd)"
ARCH="${1:-single}"

case "$ARCH" in
  single) WALLETS="$ROOT/crowdfundingv2/_wallets" ;;
  dual)   WALLETS="$ROOT/crowdfunding_dualchannel_v2/_wallets" ;;
  multi)  WALLETS="$ROOT/_wallets" ;;
  *)
    echo "ERROR: unknown arch '$ARCH' (use single|dual|multi)"
    exit 1
    ;;
esac

CRYPTO="$WS/crypto/$ARCH"
ORGS=(StartupOrg InvestorOrg PlatformOrg ValidatorOrg)

if [[ ! -d "$WALLETS" ]]; then
  echo "ERROR: wallets dir not found: $WALLETS"
  exit 1
fi

export_pems() {
  echo ">>> Exporting PEMs from $WALLETS → $CRYPTO"
  python3 - "$WALLETS" "$CRYPTO" <<'PY'
import json, sys
from pathlib import Path

wallets = Path(sys.argv[1])
crypto = Path(sys.argv[2])
orgs = ["StartupOrg", "InvestorOrg", "PlatformOrg", "ValidatorOrg"]

for org in orgs:
    org_dir = wallets / org
    if not org_dir.is_dir():
        raise SystemExit(f"missing wallet org dir: {org_dir}")
    ids = sorted(org_dir.glob("*.id"))
    # Prefer *admin.id that is not *caadmin.id
    admin = [p for p in ids if p.name.lower().endswith("admin.id") and "caadmin" not in p.name.lower()]
    if not admin:
        admin = [p for p in ids if "caadmin" not in p.name.lower()]
    if not admin:
        raise SystemExit(f"no usable .id for {org} in {org_dir}")
    data = json.loads(admin[0].read_text())
    creds = data["credentials"]
    cert = creds["certificate"].replace("\r\n", "\n").strip() + "\n"
    key = creds["privateKey"].replace("\r\n", "\n").strip() + "\n"
    msp = (data.get("mspId") or f"{org}MSP").strip() + "\n"
    out = crypto / org
    out.mkdir(parents=True, exist_ok=True)
    (out / "cert.pem").write_text(cert)
    (out / "key.pem").write_text(key)
    (out / "mspId.txt").write_text(msp)
    print(f"  {org}: wrote cert.pem key.pem mspId.txt ← {admin[0].name}")
PY
}

verify_pems() {
  python3 - "$WALLETS" "$CRYPTO" <<'PY'
import json, sys
from pathlib import Path

wallets = Path(sys.argv[1])
crypto = Path(sys.argv[2])
orgs = ["StartupOrg", "InvestorOrg", "PlatformOrg", "ValidatorOrg"]
ok = True

def norm(s: str) -> str:
    return s.replace("\r\n", "\n").strip()

for org in orgs:
    org_dir = wallets / org
    ids = sorted(org_dir.glob("*.id"))
    admin = [p for p in ids if p.name.lower().endswith("admin.id") and "caadmin" not in p.name.lower()]
    if not admin:
        admin = [p for p in ids if "caadmin" not in p.name.lower()]
    if not admin:
        print(f"  MISMATCH {org}: no wallet identity")
        ok = False
        continue
    data = json.loads(admin[0].read_text())
    w_cert = norm(data["credentials"]["certificate"])
    w_key = norm(data["credentials"]["privateKey"])
    w_msp = norm(data.get("mspId") or f"{org}MSP")
    c_cert_p = crypto / org / "cert.pem"
    c_key_p = crypto / org / "key.pem"
    c_msp_p = crypto / org / "mspId.txt"
    if not c_cert_p.exists() or not c_key_p.exists():
        print(f"  MISMATCH {org}: missing crypto PEMs under {crypto/org}")
        ok = False
        continue
    c_cert = norm(c_cert_p.read_text())
    c_key = norm(c_key_p.read_text())
    c_msp = norm(c_msp_p.read_text()) if c_msp_p.exists() else ""
    cert_ok = w_cert == c_cert
    key_ok = w_key == c_key
    msp_ok = (not c_msp) or (w_msp == c_msp)
    if cert_ok and key_ok and msp_ok:
        print(f"  MATCH {org}")
    else:
        parts = []
        if not cert_ok:
            parts.append("cert")
        if not key_ok:
            parts.append("key")
        if not msp_ok:
            parts.append("mspId")
        print(f"  MISMATCH {org}: {', '.join(parts)}")
        ok = False

sys.exit(0 if ok else 1)
PY
}

echo "============================================================"
echo " Crypto PEM sync ($ARCH)"
echo " Wallets : $WALLETS"
echo " Crypto  : $CRYPTO"
echo "============================================================"

# Ensure PEMs exist first (add them if missing).
missing=0
for org in "${ORGS[@]}"; do
  if [[ ! -f "$CRYPTO/$org/cert.pem" || ! -f "$CRYPTO/$org/key.pem" ]]; then
    missing=1
    break
  fi
done
if (( missing )); then
  echo ">>> PEMs missing — exporting from wallets"
  export_pems
fi

echo ">>> Check 1: do crypto PEMs match wallets?"
if verify_pems; then
  echo ">>> All PEMs match — OK"
  exit 0
fi

echo ">>> Mismatch detected — re-exporting PEMs from wallets"
export_pems

echo ">>> Check 2: recheck after export"
if verify_pems; then
  echo ">>> All PEMs match after export — OK"
  exit 0
fi

echo "ERROR: PEMs still do not match wallets after export"
exit 1
