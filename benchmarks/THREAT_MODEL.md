# BlockAssist+ — Threat Model (reviewer comment 4)

This document gives the formal threat model against which the attack simulations in
`attacks/attacks.js` and `bridge/tamper.js` were designed. Results are in
`results/RESULTS_TABLES.md` (section *Security*) and summarised in `REVIEWER_RESPONSE.md`.

## 1. System model

| Element | Single-channel (crowdfundingv2) | Dual-channel (v2 as in paper) | Dual-channel v3 (this revision) |
|---|---|---|---|
| Organisations | StartupOrg, InvestorOrg, ValidatorOrg, PlatformOrg (one MSP each) | same | same |
| Channels | `crowdfunding-channel` (4 orgs) | `governance-validation-channel` (Startup, Validator, Platform); `investment-execution-channel` (4 orgs) | same |
| Chaincode endorsement policy | `OR(any of 4 peers)` | governance `AND(Validator, Platform)`; investment `OR(any of 4)` | same |
| Confidential data | Private Data Collections (`PutPrivateData`) with `memberOnlyRead/Write` | **public world state** (`PutState` with collection-name prefix) — collections are configured but unused | as v2 (outbox/relay changes only) |
| Cross-channel data flow | n/a | `InvokeChaincode` to the other channel (reads *and* writes) | verifiable outbox + relay (`ApplySync`) |

Trusted computing base: Fabric peer/orderer binaries, the MSP/CA hierarchy, TLS, the Raft
ordering service (crash-fault tolerant, **not** Byzantine-fault tolerant), and the
honest-majority assumption encoded in each endorsement policy.

## 2. Assets

| ID | Asset | Security goal |
|---|---|---|
| S1 | Investor KYC data (Aadhaar, PAN, annual income) | Confidentiality (only InvestorOrg; PAN also ValidatorOrg) |
| S2 | Campaign validation decision (APPROVED/REJECTED, scores) | Integrity, authorisation (only ValidatorOrg) |
| S3 | Token balances / treasury (`PLATFORM` account), total supply | Integrity, authorisation (mint only by PlatformOrg; spend only by owner) |
| S4 | Investment commitments | Integrity, authorisation (only the investor; only into approved campaigns) |
| S5 | Uniqueness of identities (investor/startup/campaign IDs) | No duplicates, including under concurrency |
| S6 | Cross-channel consistency (governance ↔ investment) | Every committed cross-channel update is applied exactly once and unaltered |

## 3. Adversaries

| ID | Adversary | Capabilities | Out of scope |
|---|---|---|---|
| ADV-1 | **Malicious client of a legitimate org** (e.g. a startup user) | holds a valid enrolment certificate of its own org; can call any chaincode function, choose endorsing peers, submit concurrently, read every block of channels it belongs to (`qscc`) | compromise of another org's keys |
| ADV-2 | **Curious channel member** | honest-but-curious org that inspects blocks / world state it legitimately receives | — |
| ADV-3 | **Compromised organisation (malicious endorser)** | controls one org's peer and may run tampered chaincode (Fabric allows each org to install its own package for the same definition) | collusion of a majority of orgs; compromise of the ordering service |
| ADV-4 | **External attacker** | network access to peer endpoints; can capture and replay envelopes; can present self-issued certificates | breaking ECDSA/TLS |
| ADV-5 | **Malicious relay** (v3 only) | operates the cross-channel relay; can drop, delay, reorder, replay or fabricate `ApplySync` calls | — |

## 4. Threats (STRIDE) and the simulation that tests each

| Threat | STRIDE | Asset | Adversary | Simulation |
|---|---|---|---|---|
| Unauthorised minting | Elevation of privilege | S3 | ADV-1 | A1 |
| Self-assigned opening balance | Tampering | S3 | ADV-1 | A2 |
| Spending the PLATFORM treasury | Elevation of privilege | S3 | ADV-1 | A3 |
| Spending another investor's balance | Spoofing / EoP | S3 | ADV-1 | A4 |
| Investing into a non-existent/unapproved campaign | Tampering | S4 | ADV-1 | A5 |
| Investment forged on behalf of another party | Spoofing | S4 | ADV-1 | A6 |
| Startup opens/approves its own validation | Elevation of privilege | S2 | ADV-1 | A7, A8 |
| Duplicate registration (sequential, concurrent) | Tampering | S5 | ADV-1 | A9, A10, A11 |
| Replay of a signed transaction | Spoofing / Repudiation | S3 | ADV-4 | A12 |
| Forged identity (self-signed cert) | Spoofing | all | ADV-4 | A13 |
| Unauthenticated write backdoor (`DataBridgeContract:StoreData`) | Tampering | S1–S4 | ADV-1 | D-A14 |
| KYC data in plaintext transaction arguments | Information disclosure | S1 | ADV-2 | S-P1, D-P1 |
| Non-member reads a PDC | Information disclosure | S1 | ADV-1 | S-P2 |
| "Private" data in public world state | Information disclosure | S1 | ADV-1/2 | D-P3 |
| Single compromised endorser forges state | Tampering | S3 | ADV-3 | M-OR-1/2, M-K2-1/2 |
| Cross-channel writes lost | Tampering (integrity of S6) | S6 | — (design flaw) | D-C1 |
| Cross-channel reads impossible for non-member peers | Denial of service | S6 | — | D-C2 |
| Relay fabricates / replays / mis-routes sync | Tampering | S6 | ADV-5 | B-T1, B-T3, B-T4 |
| Bypass of the bridge via direct write | Tampering | S6 | ADV-1 | B-T2 |
| Endorsement non-determinism (`time.Now()`) | Denial of service | all | — (design flaw) | measured in E2/E5 |

## 5. Comparison with existing secure Fabric patterns

| Concern | BlockAssist+ (as submitted) | Established practice |
|---|---|---|
| Caller authorisation | relies on PDC membership (single-channel) or nothing (dual) | explicit `GetClientIdentity().GetMSPID()` / attribute-based access control (ABAC, `cid.AssertAttributeValue`) in every state-changing function (Fabric docs, *Chaincode access control*) |
| Confidential inputs | passed as transaction arguments | passed through the **transient map** (`GetTransient`) so they never enter the block (Fabric PDC tutorial) |
| Ownership of assets | org-level check only | owner = client ID (`GetID()`), as in Fabric `token-erc-20` and `asset-transfer-private-data` samples |
| Endorsement policy | `OR` of any single org | `MAJORITY`/`OutOf(k)` or state-based endorsement (SBE) per asset |
| Determinism | `time.Now()` in chaincode | `stub.GetTxTimestamp()` (identical on all endorsers) |
| Cross-channel writes | `InvokeChaincode` (writes not committed) | asynchronous relay with verification (as implemented in v3), or Fabric's single-channel design with PDCs |
