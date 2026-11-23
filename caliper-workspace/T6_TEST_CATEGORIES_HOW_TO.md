# T6 Test Categories — How Tests Are Performed

This document explains how the five evaluation categories on Excel sheet **T6** are executed for Single / Dual / Multi Microfab. Traditional Fabric columns stay blank until those nets are run the same way.

| T6 category | Primary method | Where detailed |
|-------------|----------------|----------------|
| Privacy | Peer CLI E2E + channel/PDC checks | Arch E2E guides (Flow 3 / Flow 5) → sheet **T14** |
| Functional | Peer CLI E2E lifecycle + Caliper happy-path | Arch E2E guides → sheet **T13**; Caliper → **T12** |
| Security | Peer CLI E2E (correct org + business locks) | Arch E2E guides + locks tables → sheet **T15** |
| Concurrency | Caliper multi-worker stress | `README.md` + reports → **T7/T9/T12** (esp. TransferTokens) |
| Failure / Recovery | Caliper cool-downs + peer health scripts | `README.md`, `dual-full-partial.md`, `check-*-peers.sh` |

---

## Architecture entry points

| Arch | Microfab port | Deploy / E2E guide | Caliper |
|------|---------------|--------------------|---------|
| **Single** | 9090 | `crowdfundingv2/` + [`E2E_TESTING_22_PARAMS.md`](../crowdfundingv2/E2E_TESTING_22_PARAMS.md) | `bash scripts/run-single-caliper.sh` → `report-single-full.html` |
| **Dual** | 7070 | `crowdfunding_dualchannel_v2/` + [`DUAL_CHANNEL_E2E_TESTING.md`](../crowdfunding_dualchannel_v2/DUAL_CHANNEL_E2E_TESTING.md) | `bash scripts/run-dual-caliper.sh` → dual report / `dual-full-partial.md` |
| **Multi** | 8080 | root deploy + [`MULTI_CHANNEL_E2E_TESTING.md`](../MULTI_CHANNEL_E2E_TESTING.md) | `bash scripts/run-multi-caliper.sh` → `report-multi-full.html` |

Caliper load levels (measured ops): **Light** N=50 @10 TPS, **Medium** N=100 @25 TPS, **Stress** N=1000 @100 TPS.

---

## 1. Privacy

**What it proves:** Sensitive data and channel membership isolation (PDC / separate channels / pairwise).

**How performed**

1. Deploy the architecture and complete Flow 0.0 (tokens) in the matching E2E guide.
2. Run the lifecycle through publish + investor registration so PDC / channel state exists.
3. Run the privacy section of the guide:
   - **Single:** `E2E_TESTING_22_PARAMS.md` → **Test Flow 3: Privacy Verification (PDC Testing)**  
     (e.g. InvestorOrg must **fail** reading Startup private collections; public campaign reads OK).
   - **Dual:** `DUAL_CHANNEL_E2E_TESTING.md` → **Test Flow 5** (Disputes & Privacy) + note that InvestorOrg is **not** on `governance-validation-channel`.
   - **Multi:** `MULTI_CHANNEL_E2E_TESTING.md` → **Test Flow 5.6 Test Channel Privacy Constraint**.
4. Record results on sheet **T14** (and summary row on **T6** / **T10**).

**Not sufficient alone:** Caliper success rates (perf only; uses correct org PEMs).

---

## 2. Functional

**What it proves:** Business lifecycle and rules (create → validate → approve → publish → invest → milestones → release → dispute / refund, plus ID/duplicate locks).

**How performed**

1. Follow the arch E2E guide **step by step** from Flow 0.0 through the full campaign lifecycle (same 22-param campaign pattern on all three arches).
2. Confirm business-logic locks from the table at the top of each E2E guide (duplicate `TriggerFundRelease`, `CreateDispute`, `RequestRefund`, etc.) by retrying the same IDs where the guide says the second call must fail.
3. Optionally corroborate happy-path ops under load with Caliper (25 ops × L/M/S) → **T12** / **T7–T9**.
4. Mark scenario catalog on sheet **T13**.

**Guides**

- Single: [`crowdfundingv2/E2E_TESTING_22_PARAMS.md`](../crowdfundingv2/E2E_TESTING_22_PARAMS.md)
- Dual: [`crowdfunding_dualchannel_v2/DUAL_CHANNEL_E2E_TESTING.md`](../crowdfunding_dualchannel_v2/DUAL_CHANNEL_E2E_TESTING.md)
- Multi: [`MULTI_CHANNEL_E2E_TESTING.md`](../MULTI_CHANNEL_E2E_TESTING.md)

---

## 3. Security

**What it proves:** Role / MSP boundaries, hash binding, unauthorized release, fee/dispute abuse paths (threat list on **T15**).

**How performed**

1. Use the **same E2E guides** as Functional: each invoke is done as the **correct org** (`source ./deploy_chaincode.sh switch <org>`).
2. Rely on guide + contract locks for negative cases called out in the docs, for example:
   - Publish / share only after approval + matching `validationProofHash`
   - `ExecuteFundReleaseTransfer` Platform-only; duplicate paid release rejected
   - Dispute / refund duplicate IDs rejected; dispute fee debit requires initiator MSP
   - Dual: Investor must not use governance channel
3. Optional hardening: redeploy CC that includes `PlatformOrgMSP` / `ValidatorOrgMSP` checks on mint, fees, approve, etc. (see `crowdfundingv2/contracts/token_operations.go` and related).
4. Record on sheet **T15**.

**There is no separate “security-only” Caliper suite.** Wrong-org attacks are validated via E2E org switching + Fabric endorsement/MSP, not via Caliper workers.

---

## 4. Concurrency

**What it proves:** Behavior under parallel Caliper workers (MVCC / contention), not a separate unit-test harness.

**How performed**

1. Start Microfab for the arch; deploy + seed (`scripts/seed-*-full.sh` or per README).
2. Run full Caliper suite (`run-*-caliper.sh`) with configured workers (typically 2).
3. Inspect HTML report:
   - Most ops should stay high success under stress.
   - **TransferTokens** often shows ~50% fail with Fabric status **11** (MVCC) under Microfab stress — expected contention signal, recorded on **T9/T12/T13**.
4. Peer cool-down rounds (`cooldown-after-*`) are **not** counted as measured concurrency TPS.

**Docs:** [`caliper-workspace/README.md`](README.md). **Reports:** `report-single-full.html`, `report-multi-full.html`, `dual-full-partial.md`.

---

## 5. Failure / Recovery

**What it proves:** Suite can finish (or where it aborts) when peers die, cool-down, or UNAVAILABLE endorsements occur.

**How performed**

1. **Health before run:**  
   `bash scripts/check-single-peers.sh` / `check-dual-peers.sh` / `check-multi-peers.sh`
2. **During Caliper:** cool-down workloads pause and probe HTTP/readiness between medium→stress (and stress→next op on dual/multi). See README “peerCooldown” / `probeGovernance`.
3. **If peers die:**
   - Dual Microfab historically aborts after medium P01 cool-down (`EndorseError: 14 UNAVAILABLE`) — documented in [`dual-full-partial.md`](dual-full-partial.md).
   - Recovery path: restart Microfab → redeploy/seed → re-run; prefer `probeGovernance: false` on dual cool-down.
4. **Pass criteria for T6:** full Caliper suite completes (single/multi); dual may be FAIL/PARTIAL until a full dual report exists.
5. E2E “second invoke fails” checks also cover **application-level** failure handling (duplicate money/decision IDs), not only peer crashes.

---

## Mapping T6 → Excel detail sheets

| T6 row | Detail sheet | Evidence sources |
|--------|--------------|------------------|
| Privacy | **T14**, **T10** | E2E privacy flows |
| Functional | **T13**, **T12** | E2E lifecycle + Caliper |
| Security | **T15**, **T10** | E2E + contract locks / MSP |
| Concurrency | **T7–T9**, **T12** | Caliper stress / MVCC |
| Failure / Recovery | **T6** notes, dual-full-partial | Peer scripts + Caliper completion |

Perf-only summary (CreateStartup / all-ops TPS) lives on **T7–T9 / T12**, not as a sixth privacy/security category.

---

## Quick checklist (per architecture)

```text
[ ] Microfab up + chaincode deployed
[ ] check-*-peers.sh healthy
[ ] E2E Flow 0.0 tokens
[ ] E2E full lifecycle (Functional)
[ ] E2E privacy / channel section (Privacy)
[ ] E2E locks + org-scoped invokes (Security)
[ ] Caliper full suite (Concurrency + Failure/Recovery signal)
[ ] Fill T13 / T14 / T15 / T6 from that evidence
```

---

## Do we already have “this” doc?

**Before this file:** no single T6-oriented guide. Pieces lived in:

- `crowdfundingv2/E2E_TESTING_22_PARAMS.md`
- `crowdfunding_dualchannel_v2/DUAL_CHANNEL_E2E_TESTING.md`
- `MULTI_CHANNEL_E2E_TESTING.md`
- `caliper-workspace/README.md`
- Excel sheets T13–T15

**This file** is the index that ties those five T6 categories to how they are run.
