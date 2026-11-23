# BlockAssist+ — Results for Reviewer Comments 2–5

All numbers below were **measured** on live Hyperledger Fabric networks built from this repository's
chaincode (`CF_SingleChannel/crowdfundingv2`, `CF_DualChannel/crowdfunding_dualchannel_v2`) using the
tooling in [`benchmarks/`](benchmarks/). Raw per-round JSON is in `benchmarks/results/raw/`, the full
auto-generated tables in [`benchmarks/results/RESULTS_TABLES.md`](benchmarks/results/RESULTS_TABLES.md)
and figures in `benchmarks/results/figures/`.

> **Read this first — honesty notes for the revision**
> 1. The experiments ran in a cloud container, **not on the Netcup VPS of Table 7**. Fabric binaries are
>    identical (peer/orderer **v2.5.16, commit f871cf9**), the vCPU count is identical (4), but the CPU
>    (Intel Xeon @2.3 GHz vs AMD EPYC-Rome) and RAM (16 GB vs 8 GB) differ. Peak memory in every run
>    was ≤ 6.3 GB, so all experiments fit in your 8 GB VPS. **Re-run `benchmarks/` on the Table 7 machine
>    before putting numbers in the paper** (commands in §7); expect the same trends, slightly different
>    absolute values.
> 2. The Microfab image could not be pulled here, and Microfab cannot vary orderer count or peers per org.
>    The network was therefore built with the official `hyperledger/fabric-*:2.5` images (docker-compose,
>    Raft ordering, CouchDB, TLS on), the same single-host model as Microfab.
> 3. Several results **contradict claims in the current manuscript** (security of the dual-channel design,
>    cross-channel synchronisation). They are reported as measured. Section 6 lists what must change in the
>    paper and which fixes are already implemented.

---

## 1. Experimental environment (revised Table 7 for this run)

| Parameter | This evaluation | Your Table 7 |
|---|---|---|
| Host | Cloud KVM container | Netcup KVM VPS |
| CPU | Intel Xeon @ 2.30 GHz, **4 vCPU** | AMD EPYC-Rome, 4 vCPU |
| RAM | 16 GB (peak used ≤ 6.3 GB) | 8 GB |
| OS / kernel | Ubuntu 24.04.5 / 6.18 | Debian 13 / 6.12 |
| Docker | 29.10.0, overlayfs, cgroup v1 | 29.9.0, overlayfs |
| Fabric peer / orderer | **2.5.16, commit f871cf9** | 2.5.16, commit f871cf9 |
| State DB | CouchDB 3.3.3 (one per peer) | CouchDB (Microfab) |
| Ordering | etcd **Raft**, 1 / 3 / 5 nodes | Microfab (1 node) |
| TLS | enabled on all endpoints | Microfab default |
| Chaincode | original Go source, run as chaincode-as-a-service (1 container per peer) | in-peer |
| Load generator | open-loop fixed-rate (Caliper "fixed-rate" semantics), Fabric Gateway SDK 1.7.1, 4 worker processes, same host | — |
| Metrics | send rate, committed throughput, success %, latency avg/p50/p95/p99/max (submit → commit event); CPU, RSS, network per container from cgroups/procfs at 1 Hz | — |

Default network: 4 orgs × 1 peer, 1 orderer, BatchTimeout 2 s / MaxMessageCount 500, 20 s of offered load
per round (30 s for E1 register), 120 rounds in total, **offered load from 25 up to 4,000 TPS**.

Workloads (all original chaincode functions):

| Workload | Function | Data path |
|---|---|---|
| `register` | `InvestorContract:RegisterInvestor` | public + 2 PDC writes |
| `invest` | `InvestorContract:MakeInvestment` | 2 PDC writes (single) / public state (dual) |
| `startup` | `StartupContract:CreateStartup` | PDC (single) / governance public state, `AND(Validator,Platform)` (dual) |
| `token` | `TokenContract:CreateTokenAccount` | public state only (used for topology experiments) |
| `query` | `TokenContract:GetTokenAccount` | read-only evaluate |

---

## 2. Reviewer comment 2 — comprehensive performance benchmarking

### 2.1 Throughput / latency under increasing load (E1, single channel)

| Workload | Max sustainable load (≥ 99 % success) | Latency there (avg) | Peak committed TPS | Behaviour beyond peak |
|---|---|---|---|---|
| RegisterInvestor (PDC) | 50 TPS | 1.73 s | **89.3** @ 100 offered | throughput *falls* to 29 TPS at 1,000 offered (latency 41 s) |
| MakeInvestment (PDC) | 100 TPS | 2.68 s | **94.2** @ 100 | falls to 40 TPS at 500 |
| CreateStartup (PDC) | 100 TPS | 2.36 s | **128.4** @ 150 | falls to 58 TPS at 500 |
| CreateTokenAccount (public) | 150 TPS | 1.82 s | **230.4** @ 500 (latency 15.9 s) | — |
| GetTokenAccount (query) | 1,000 TPS | 0.016 s | **1,934.7** @ 2,000 | 1,067 TPS at 4,000 |

Figure: `fig_e1_throughput_latency.png`.

Findings
* The bottleneck is **CPU in peer + CouchDB**, not the orderer (§2.6). Host CPU reaches 85–98 % at the knee.
* Past the knee, throughput **collapses** instead of plateauing; the Fabric Gateway sheds load with
  `RESOURCE_EXHAUSTED: exceeding concurrency limit (500)` (default `peer.limits.concurrency.gatewayService`).
* PDC workloads reach ~40–60 % of public-state throughput (private-data hashing, dissemination and the extra CouchDB documents).

### 2.2 Varying peer count (E3: 4 / 8 / 12 peers, 1 orderer)

| Peers | RegisterInvestor peak TPS | CreateTokenAccount peak TPS | CreateTokenAccount latency @300 offered | Query TPS @2,000 | Peak host RAM |
|---|---|---|---|---|---|
| 4 | 85.0 | 175.3 | 2.1 s | 1,827.6 | 3.0 GB |
| 8 | 54.0 | 177.3 | 13.1 s | 1,656.5 | 4.7 GB |
| 12 | 38.4 | 126.3 | 30.6 s | 1,595.6 | 6.3 GB |

Figure: `fig_e3_peers.png`. On a single 4-vCPU host every added peer (and its CouchDB) competes for the
same cores, so write throughput **decreases** with peer count (−55 % for RegisterInvestor at 12 peers) and
latency grows 15×. This is the expected single-host result and must be stated as a limitation: horizontal
scalability can only be demonstrated on multi-host deployments.

### 2.3 Varying ordering nodes (E4: 1 / 3 / 5 Raft orderers)

| Orderers | Peak TPS (CreateTokenAccount) | Latency avg @300 offered |
|---|---|---|
| 1 | 202.4 | 1.74 s |
| 3 | 197.8 | 1.80 s |
| 5 | 191.4 | 1.87 s |

Figure: `fig_e4_orderers.png`. Raft replication to 5 nodes costs only ~5 % throughput and ~0.13 s latency:
the ordering service is not the bottleneck, and crash-fault tolerance (tolerating 1 or 2 failed orderers)
is almost free at this scale.

### 2.4 Multiple endorsers (E5: endorsement policy `OutOf(k, 4 orgs)`)

| Endorsers required | Peak TPS @200 offered | Rejected by endorsement mismatch @200 | Overall mismatch rate (all rates) |
|---|---|---|---|
| 1 of 4 | 169.5 | 0 % | 0 % |
| 2 of 4 | 143.8 | 3.1 % | 2.8 % |
| 3 of 4 | 119.6 | 26.2 % | 16.5 % |
| 4 of 4 | 95.3 | **43.6 %** | 26.6 % |

Figure: `fig_e5_endorsers.png`. Each extra endorser costs ~15 % throughput. **More importantly, the chaincode
is non-deterministic**: 101 of the 109 state-changing functions in the single-channel chaincode embed
`time.Now()` in the written value, so endorsers that execute in different seconds produce different
read-write sets and Fabric rejects the transaction (`ProposalResponsePayloads do not match`). This is
already visible in the paper's own dual-channel design (§3.2). Fix: use `ctx.GetStub().GetTxTimestamp()`.

### 2.5 Orderer batch configuration (E6) — a free 3× latency improvement

| BatchTimeout / MaxMessageCount | TPS @200 offered | Success | Latency avg / p95 |
|---|---|---|---|
| 2 s / 500 (Fabric default, used in paper) | 166.6 | 86 % | 2.01 / 3.02 s |
| **1 s / 100** | **198.4** | **100 %** | **0.63 / 0.97 s** |
| 500 ms / 50 | 189.1 | 99 % | 1.02 / 2.66 s |
| 250 ms / 25 | 168.3 | 89 % | 2.20 / 3.47 s |

Figure: `fig_e6_batch.png`.

### 2.6 Resource utilisation (CPU, memory, bandwidth)

| Scenario | Host CPU avg | Peer CPU (sum) | CouchDB CPU | Orderer CPU | Chaincode CPU | Peer RAM | Peer net in / out | Orderer net out |
|---|---|---|---|---|---|---|---|---|
| Token @100 TPS (4 peers) | 59 % | 75 % | 49 % | 16 % | 12 % | 555 MB | 2.2 / 1.1 MB/s | 1.3 MB/s |
| Token @300 TPS (4 peers) | 89 % | 105 % | 88 % | 23 % | 13 % | 795 MB | 4.5 / 2.2 MB/s | 2.7 MB/s |
| Register (PDC) @100 TPS | 85 % | 130 % | 125 % | 11 % | 7 % | 510 MB | 2.4 / 1.3 MB/s | 1.4 MB/s |
| Query @2,000 TPS | 94 % | 130 % | 2 % | 0 % | 40 % | 821 MB | 3.4 / 3.5 MB/s | 0 |
| Token @300 TPS (12 peers) | 96 % | 168 % | 125 % | 14 % | 5 % | 2.2 GB | 18.0 / 13.5 MB/s | 4.9 MB/s |

(CPU in % of one vCPU; 4 vCPU = 400 %.) Figure: `fig_resources_cpu.png`. CouchDB consumes as much CPU as
the peers for PDC writes; bandwidth is modest (< 20 MB/s) so a 1 Gbit/s link is never a constraint.

---

## 3. Reviewer comment 3 — cross-channel synchronisation

### 3.1 What the submitted dual-channel code actually does (measured)

`CrossChannelPut` writes to the other channel through `stub.InvokeChaincode(..., otherChannel)`.
**Fabric only permits read-only chaincode-to-chaincode calls across channels**: writes made by the called
chaincode are simulated but never committed on the other channel. The calling transaction still returns
success, so the data is lost silently.

| Test | Result |
|---|---|
| D-C1: governance `PlatformContract:RecordValidatorDecision` (writes a record homed on the investment channel), then read it on the investment channel | governance tx **committed VALID**, record **ABSENT** on investment channel |
| v2 under load: 750 such transactions at 25 TPS | **750 / 750 committed, 0 / 750 present on the investment channel** (`results/bridge/v2_baseline_25.json`) |
| D-C2: investment-channel function reading governance data | succeeds when endorsed by StartupOrg peer (joined to both channels), **fails on the InvestorOrg peer** (not joined to governance) |

36 live governance functions write investment-channel data (publishing, escrow, fees, disputes,
voting, validator decisions); all of them lose these writes. The dual-channel workflow therefore does not
work end-to-end as submitted, which confirms and strengthens the reviewer's point.

### 3.2 Implemented solution: verifiable outbox + relay (`CF_DualChannel/crowdfunding_dualchannel_v3`)

Design (code in `contracts/*/cross_channel.go`, `contracts/*/data_bridge.go`, relay in `benchmarks/bridge/relay.js`):

1. **Outbox** – a cross-channel write stores `OUTBOX_<txID>_<collection>_<key> = {value, sha256, target}` on the
   *source* ledger and emits chaincode event `CrossChannelSync`. The entry exists in committed state only if
   the source transaction is VALID.
2. **Relay** – an off-chain service (any party may run it) subscribes to the event on both channels (with a
   file checkpoint) and calls `DataBridgeContract:ApplySync(sourceChannel, outboxKey)` on the target channel.
3. **Verified apply** – the target endorsers (Validator + Platform, joined to both channels) fetch the outbox
   entry **from their own copy of the source ledger** (a cross-channel *read*, which Fabric allows), check
   the hash and target, write the value and a `SYNCED_<key>` marker.
4. Properties: the relay never supplies data → it **cannot forge or alter** it; `ApplySync` is idempotent →
   **exactly-once** under retries, replays and relay restarts; the relay is crash-tolerant (checkpoint).
   Consistency is **eventual**, bounded by the sync lag measured below.
5. v2's `DataBridgeContract:StoreData`, an unauthenticated public write function (see D-A14), is disabled.

### 3.3 Measured synchronisation performance and correctness

Workload: governance `PlatformContract:RecordValidatorDecision` (governance policy `AND(Validator,Platform)`),
each writing one record homed on the investment channel. 30 s of load per rate, relay operated by PlatformOrg.
"Present/intact" is verified independently by reading every record back from the investment ledger.

| Run | Offered TPS | Source committed | Present & intact on investment channel | Missing | End-to-end sync TPS | Sync lag avg / p95 / max (s) |
|---|---|---|---|---|---|---|
| **v2 (paper)** | 25 | 750 / 750 | **0** | **750** | 0 | — |
| v3 per-entry | 10 | 300 / 300 | 300 | 0 | 9.5 | 1.9 / 2.5 / 2.5 |
| v3 per-entry | 25 | 749 / 750 | 749 | 0 | 21.9 | 2.3 / 3.3 / 3.9 |
| v3 per-entry | 50 | 1,492 / 1,500 | 1,492 | 0 | 23.3 | 17.8 / 31.3 / 33.5 |
| v3 per-entry | 100 | 2,965 / 3,000 | 2,965 | 0 | 24.2 | 47.4 / 87.3 / 92.1 |
| v3 per-entry | 150 | 3,756 / 4,500 | 3,756 | 0 | 22.9 | 70.5 / 127.0 / 133.2 |
| **v3 batched (≤100/tx)** | 25 | 749 / 750 | 749 | 0 | 23.4 | **2.3 / 2.9 / 3.1** |
| **v3 batched** | 50 | 1,479 / 1,500 | 1,479 | 0 | 44.7 | **3.0 / 4.5 / 4.5** |
| **v3 batched** | 100 | 2,905 / 3,000 | 2,905 | 0 | 75.1 | 14.2 / 21.8 / 23.1 |
| **v3 batched** | 150 | 3,646 / 4,500 | 3,646 | 0 | 78.9 | 23.9 / 32.3 / 33.0 |
| v3 relay crash (killed at 10 s, restarted at 30 s) | 50 | 1,490 / 1,500 | 1,490 | 0 | 17.3 | 38.8 / 53.1 / 55.4 |

Figure: `fig_bridge_lag.png`. Source-side failures are not bridge failures: they are the `time.Now()`
endorsement mismatches of the governance channel's two-endorser policy (§2.4) and gateway overload at 150 TPS.

Findings
* **Correctness: 0 lost, 0 corrupted, 0 duplicated records** across 19,531 relayed records, including a relay
  crash (80 entries were re-relayed after restart and absorbed idempotently as `ALREADY_APPLIED`).
* **Latency**: ≈ 2–3 s (about one block on each channel) while the relay keeps up; the per-entry relay saturates
  at ≈ 23 records/s, batching raises that to ≈ 79 records/s (3.4×) and keeps lag at 3 s up to 50 TPS.
  The remaining limit is the investment channel's own write capacity on the shared 4-vCPU host.
* **Security of the bridge** (`bridge/tamper.js`, all MITIGATED): B-T1 relay injects a fabricated outbox key →
  rejected (`cannot verify outbox entry`); B-T2 direct write via `StoreData` → rejected (disabled);
  B-T3 replay of an applied entry → `ALREADY_APPLIED`, no state change; B-T4 apply endorsed by a peer not
  joined to the source channel → rejected.
* Limitations to state in the paper: consistency is eventual (bounded by the lag above); a malicious relay can
  delay but not forge; liveness requires at least one honest relay (anyone can run one); target endorsers must
  be members of both channels (here Validator and Platform).

---

## 4. Reviewer comment 4 — security: threat model and attack simulation

Formal threat model (system model, assets, 5 adversary classes, STRIDE mapping, comparison with Fabric
secure-coding practice): [`benchmarks/THREAT_MODEL.md`](benchmarks/THREAT_MODEL.md).

All attacks were executed **against the live network with real org identities** (`benchmarks/attacks/attacks.js`,
`run_attacks.sh`). MITIGATED = the network rejected the attack; VULNERABLE = it was committed or data was disclosed.

| # | Attack (adversary) | Single-channel | Dual-channel (paper) | Why |
|---|---|---|---|---|
| A1 | Non-Platform org mints 10⁹ tokens (ADV-1) | **VULNERABLE** | **VULNERABLE** | `MintTokens` has no caller check |
| A2 | Create account with self-chosen balance 5×10⁸ | **VULNERABLE** | **VULNERABLE** | `CreateTokenAccount` trusts `initialBalanceJSON` |
| A3 | StartupOrg spends the PLATFORM treasury | **VULNERABLE** | mitigated | MSP check exists only in dual `TransferTokens` |
| A4 | Investor spends another investor's balance | **VULNERABLE** | **VULNERABLE** | ownership checked at org level at most |
| A5 | Invest into non-existent campaign | **VULNERABLE** | **VULNERABLE** | no campaign/approval check in `MakeInvestment` |
| A6 | StartupOrg forges investment for an investor | mitigated | **VULNERABLE** | single: PDC `memberOnlyWrite`; dual: public state |
| A7 | StartupOrg opens validation of own campaign | mitigated | **VULNERABLE** | same |
| A8 | **StartupOrg approves its own campaign** | mitigated | **VULNERABLE** | same |
| A9 | Duplicate registration (sequential) | mitigated | mitigated | existence check |
| A10 | 20 concurrent duplicate registrations | mitigated (1 VALID, 19 MVCC_READ_CONFLICT) | mitigated | Fabric MVCC |
| A11 | 20 concurrent duplicate investment IDs | mitigated | mitigated | Fabric MVCC |
| A12 | Replay of a captured signed transaction | mitigated | mitigated | Fabric duplicate-txID check (balance unchanged) |
| A13 | Self-signed certificate claiming InvestorOrgMSP | mitigated | mitigated | MSP certificate validation |
| A14 | Overwrite another org's record via `DataBridgeContract:StoreData` | n/a | **VULNERABLE** | public unauthenticated write function |
| A15 | Crash the chaincode (DoS) with `MintTokens` to a new account | **VULNERABLE** | mitigated | nil-pointer panic (read-your-writes) |
| P1 | KYC (Aadhaar, income) readable in blocks by other orgs | **VULNERABLE** | **VULNERABLE** | private data passed as plaintext tx arguments, not via transient map |
| P2 | Non-member reads InvestorPrivateData | mitigated | — | PDC `memberOnlyRead` |
| P3 | StartupOrg reads investor Aadhaar/income from world state | — | **VULNERABLE** | "private" collections are public `PutState` keys |
| C1 | Cross-channel write persisted | — | **FAILS** | §3.1 |
| C2 | Cross-channel read from every org | — | **FAILS** | §3.1 |
| M1 | One compromised org (tampered chaincode) forges 10⁹ tokens, policy `OR` (paper) | **VULNERABLE** | (same policy) | single endorser suffices |
| M2 | Same attack with policy `OutOf(2,4)` | mitigated (ENDORSEMENT_POLICY_FAILURE) | — | honest co-endorser disagrees |
| B1–B4 | Relay forges entry / direct write / replay / non-member endorser (v3 bridge) | — | see §3.3 | |

Totals: single-channel 7 of 16 attacks succeed; dual-channel (as submitted) 12 of 19; malicious endorser
succeeds under the paper's `OR` policy and is stopped by `OutOf(2,4)`.

Key interpretation for the paper
* Every protection that *does* hold in the single-channel design comes from **Fabric PDC membership rules**
  (`memberOnlyRead/Write`), MVCC and MSP validation, **not from application-level access control**:
  0 of 109 state-changing single-channel functions check the caller's identity; 2 of 99 / 2 of 120 do in the dual-channel chaincodes.
* The dual-channel design moved all "private" data to public world state (`PutState`), so it loses even
  those protections — its privacy and authorisation claims do not hold as implemented.
* The PASS/FAIL functional tests in the manuscript tested the honest path only, which is why these issues
  were not visible.

### 4.1 Fixes implemented and the same attacks re-run

The fixes are implemented in new code folders; the code evaluated above is unchanged for reproducibility:

* `CF_SingleChannel/crowdfundingv2_hardened/` (single channel)
* `CF_DualChannel/crowdfunding_dualchannel_v3/` (dual channel, also contains the bridge of §3)

The shared hardening layer is `contracts/security.go`.

| Fix | Mechanism | Closes |
|---|---|---|
| Role-based access control | `roleGuard` runs as contractapi `BeforeTransaction` on every contract: state-changing functions of `<Org>Contract` require `<Org>MSP`. Reads (`Get*`, `Is*`, `Calculate*`) stay open and are still protected by PDC membership. | A6, A7, A8 |
| Token ledger isolation | Tokens are served **only** by a separate chaincode `cftoken` with endorsement policy `OutOf(2, 4 orgs)`; the OR-policy namespace refuses token calls. Mint, burn, freeze, exchange rates and purchases are PlatformOrg-only. | A1, M1 |
| Account ownership | Each account records a `controller` (the creating client's identity, or Platform custody). Only the controller may debit it. Non-zero opening balances are Platform-only. | A2, A3, A4 |
| Investor binding and campaign check | An investor ID is bound to the client that registered it. `MakeInvestment` requires that owner, and a campaign that is published and open. In dual, the public campaign record is bridged to the investment channel. | A5, A6b |
| KYC confidentiality | Aadhaar, income and PAN are accepted **only** via the transient map (`"kyc"`); plaintext arguments are rejected. | P1 |
| Investment confidentiality | Amounts, proposal terms, counter-offers and the investor/campaign link are accepted only via the transient map (`"private"`) in `MakeInvestment`, `CreateInvestmentProposal`, `RespondToCounterOffer`, `AcceptAgreement`, `AcknowledgeInvestment` and `RespondToInvestmentProposal`. In dual, the governance copies of the last two are disabled, because their writes would pass the public outbox. The funding summary stays in `StartupInvestorShared`. | P4 |
| Real private data (dual) | Collection-homed data uses `PutPrivateData`/`GetPrivateData` (was public `PutState`). `StoreData` is disabled. Bridge writes go into the target PDC. | P3, A14 |
| Determinism | `time.Now()` → `GetTxTimestamp()` in all 108 / 90 / 111 call sites. | ENDORSE_MISMATCH (§2.4) |
| Crash safety | Accounts created in the same transaction are built in memory (Fabric has no read-your-writes). | A15 |

Re-run (`benchmarks/run_attacks_hardened.sh`, `attacks/hardened.js`; raw results in `results/security_hardened/`).
Same attack IDs; User1 is the attacker and User2 a legitimate user of the same org. **Positive controls** verify
that the honest end-to-end workflow still works, so a block cannot be caused by a broken feature.

| # | Attack | Single: before → after | Dual: before → after | Blocked by (error returned by the network) |
|---|---|---|---|---|
| A1 | Non-Platform mint | VULNERABLE → **MITIGATED** | VULNERABLE → **MITIGATED** | `access denied: caller InvestorOrgMSP is not authorised (requires PlatformOrgMSP)` |
| A2 | Self-funded account | VULNERABLE → **MITIGATED** | VULNERABLE → **MITIGATED** | `non-zero opening balance … requires PlatformOrgMSP` |
| A3 | Spend PLATFORM treasury | VULNERABLE → **MITIGATED** | mitigated → **MITIGATED** | `account PLATFORM is platform-custodied` |
| A4 | Spend another user's balance (same org) | VULNERABLE → **MITIGATED** | VULNERABLE → **MITIGATED** | `caller does not control account …` |
| A5 | Invest in non-existent campaign | VULNERABLE → **MITIGATED** | VULNERABLE → **MITIGATED** | `campaign … is not published/open for investment` |
| A6 | Startup invests for an investor | mitigated → **MITIGATED** | VULNERABLE → **MITIGATED** | `requires InvestorOrgMSP` |
| A6b | Investor invests in another investor's name | (new) **MITIGATED** | (new) **MITIGATED** | `caller is not the registered owner of investor …` |
| A7 / A8 | Startup validates / approves own campaign | mitigated → **MITIGATED** | VULNERABLE → **MITIGATED** | `requires ValidatorOrgMSP` |
| A9–A11 | Duplicates (sequential, 20× concurrent) | mitigated → **MITIGATED** | mitigated → **MITIGATED** | existence check, MVCC (1 VALID, 19 MVCC_READ_CONFLICT) |
| A12 / A13 | Replay / forged certificate | mitigated → **MITIGATED** | mitigated → **MITIGATED** | duplicate txID / MSP validation |
| A14 | `StoreData` overwrite | — | VULNERABLE → **MITIGATED** | `StoreData is disabled in v3` |
| A15 | Chaincode crash (DoS) | VULNERABLE → **MITIGATED** | mitigated → **MITIGATED** | no crash; account created in memory |
| P1 | KYC in shared blocks | VULNERABLE → **MITIGATED** | VULNERABLE → **MITIGATED** | block fetched by StartupOrg, Aadhaar/income **not present** |
| P1b | KYC sent as plaintext arguments | (new) **MITIGATED** | (new) **MITIGATED** | `KYC data must not be passed as transaction arguments` |
| P4 | Investment amount / proposal terms in shared blocks | VULNERABLE → **MITIGATED** | VULNERABLE → **MITIGATED** | block fetched by ValidatorOrg: amount and terms **not present** |
| P4b | Investment data sent as plaintext arguments | (new) **MITIGATED** | (new) **MITIGATED** | `confidential investment data must not be passed as transaction arguments` |
| P4c | Validator / Platform read investment record | mitigated → **MITIGATED** | VULNERABLE → **MITIGATED** | `tx creator does not have read access permission … StartupInvestorShared` |
| P2 / P3 | Non-member reads investor KYC | mitigated → **MITIGATED** | VULNERABLE → **MITIGATED** | `tx creator does not have read access permission … InvestorPrivateData` |
| C1 | Cross-channel write persisted | — | FAILS → **WORKS** (present after 3.0 s) | v3 bridge |
| M1 | One compromised org forges 10⁹ tokens | VULNERABLE → **MITIGATED** | (same mechanism) | endorsed by StartupOrg only: `invalidated: code 10` (ENDORSEMENT_POLICY_FAILURE); with an honest co-endorser: `insufficient balance` |
| N1 | Token call on the OR-policy chaincode | (new) **MITIGATED** | (new) **MITIGATED** | `token functions are served only by the "cftoken" chaincode` |

**Totals after hardening: 0 of 24 attacks succeed on the single channel and 0 of 24 on the dual channel**
(C1 now works). Both malicious-endorser tests are mitigated (2 of 2).
Positive controls — **all PASS** (single 9/9, dual 11/11):

1. Create startup and campaign, then submit it.
2. Validator validates and approves.
3. Share and publish the campaign. Dual only: it reaches the investment channel through the relay in 3.1 s.
4. Register an investor with KYC in the transient map.
5. Invest in the published campaign, create a proposal and acknowledge the investment. All confidential
   values go through the transient map, and StartupOrg can read the shared investment record.
6. Token flow: own accounts, a 2-of-4-endorsed mint, and an owner transfer.
7. Dual only: InvestorOrg still reads its own private KYC record.

**Client rule for confidential data.** When a transaction carries transient data, the Fabric Gateway only
lets organisations in the target collections endorse it (otherwise: *"requires endorsement from
organisation(s) that are not in the distribution policy …"*). Clients therefore set
`endorsingOrganizations` to the calling organisation for these calls, e.g. InvestorOrg for
`MakeInvestment` and StartupOrg for `AcknowledgeInvestment`.

**Cost of hardening** (same 4-peer topology as E1; `results/RESULTS_TABLES.md`, "Cost of hardening"):

| Workload | Offered TPS | Original: TPS / success / latency | Hardened: TPS / success / latency |
|---|---|---|---|
| RegisterInvestor | 50 | 48.2 / 100 % / 1.73 s | 47.1 / 100 % / 1.69 s |
| RegisterInvestor | 100 | 89.3 / 97 % / 3.14 s | **92.8 / 100 % / 2.48 s** |
| RegisterInvestor | 200 | 69.7 / 38 % / 5.67 s | **91.7 / 52 % / 4.16 s** |
| Token write | 100 | 97.0 / 100 % / 1.51 s (1 endorser) | 96.6 / 100 % / 1.49 s (**2 endorsers**) |
| Token write | 200 | 160.7 / 83 % / 2.06 s (1 endorser) | 166.7 / 86 % / 1.97 s (**2 endorsers**) |
| Token write, 2-of-4 | 200 | 143.8 TPS, 125 mismatch rejections (original code, E5) | 166.7 TPS, **0** mismatch rejections |

Access control, ownership checks and the transient map add no measurable overhead. Moving tokens to a
2-of-4 policy costs nothing, because the deterministic timestamps remove the rejections that made
multi-endorser policies expensive in §2.4. Differences of a few percent are within run-to-run variation.

**Design finding — must be stated in the paper.**

* **The conflict:** the paper's governance-channel policy `AND(Validator, Platform)` cannot coexist with real
  Startup-private data. A Startup step that reads `StartupPrivateData` must be endorsed only by members of
  that collection (StartupOrg). If the same step also writes public state, it would need Validator **and**
  Platform endorsement.
* **Measured:** the gateway reports *"no combination of peers can be derived which satisfy the endorsement
  policy"* for `CreateCampaign` (`results/security_hardened/dual_ANDpolicy_conflict.json`).
* **v2 hid it:** v2 never noticed because it stored everything in public state.
* **Hardened deployment (`HARDENED=1`):**
  * member-based collection endorsement policies (as in the single-channel design);
  * any-member endorsement on the governance namespace;
  * `OutOf(2,4)` on `AllOrgsShared` (bridged campaign records);
  * the 2-of-4 `cftoken` namespace for value.
* **Residual risk:** a single compromised organisation can still forge *non-monetary* public governance
  records. Removing this needs the hash-plus-transient verification pattern (non-member endorsers verify
  `GetPrivateDataHash` instead of reading plaintext) — future work.

---

## 5. Reviewer comment 5 — comparison with existing systems

### 5.1 Quantitative (throughput / latency)

| System | Platform / setup | Peak throughput | Latency | Source |
|---|---|---|---|---|
| **BlockAssist+ single-channel (this work)** | Fabric 2.5.16, 4 peers, 1 Raft orderer, CouchDB, **one 4-vCPU host** | 89–128 TPS (PDC writes), 230 TPS (public writes), 1,935 TPS (queries) | 0.63 s avg with 1 s/100 batches; 1.7–2.7 s with defaults | §2 |
| **BlockAssist+ dual-channel (this work)** | same | 137–142 TPS writes; 21 % of governance writes rejected across the sweep, 45 % at 300 TPS (non-determinism) | 1.8–2.3 s | §2, E2 |
| Hyperledger Fabric (Androulaki et al., EuroSys 2018) | bitcoin-like UTXO chaincode, data-centre cluster | > 3,500 TPS | few hundred ms | [arXiv:1801.10228](https://arxiv.org/pdf/1801.10228) |
| Fabric v1.0 optimised (Thakkar et al., MASCOTS 2018) | 3 optimisations | 140 → 2,250 TPS | — | [arXiv:1805.11390](https://www.arxiv.org/pdf/1805.11390) |
| FastFabric (Gorenflo et al., ICBC 2019) | re-architected Fabric 1.2 | 20,000 TPS | — | [arXiv:1901.00910](https://ar5iv.arxiv.org/html/1901.00910) |
| Fabric 2.5 official Caliper benchmark | 4 bare-metal machines, 200 workers | ≈ 3,000 TPS (blind write) | — | [LF Decentralized Trust blog, 2023](https://www.lfdecentralizedtrust.org/blog/2023/02/16/benchmarking-hyperledger-fabric-2-5-performance) |
| Fabric (Kuzlu et al., IEEE Blockchain 2019) | AWS EC2 | sub-second latency up to ~200 TPS | < 1 s | [IEEE 8946222](https://ieeexplore.ieee.org/document/8946222/) |
| Ethereum-based crowdfunding / financial dApps | public PoS mainnet | ≈ 15 TPS | ≈ 12 s | [Performance comparison of Ethereum and Fabric for financial transactions (2025)](https://www.researchgate.net/publication/395003029_Performance_Comparison_of_Blockchain_Platforms_for_Modeling_Financial_Transactions_A_Case_Study_of_Ethereum_and_Hyperledger_Fabric) |

Positioning sentence for the paper: on a single 4-vCPU host BlockAssist+ sustains roughly an order of
magnitude more write throughput than public-chain crowdfunding dApps, with second-level finality instead of
minutes, but one to two orders of magnitude below Fabric's published upper bounds, which use multi-machine
clusters and simpler chaincode. The gap is explained by (i) single-host CPU contention, (ii) CouchDB + PDC
cost, (iii) default batch settings. Do **not** claim BlockAssist+ is "faster than Fabric".

### 5.2 Qualitative (security, privacy, governance, deployment)

| Criterion | Public-chain crowdfunding dApps (e.g. Ethereum smart-contract escrow) | Generic Fabric asset-transfer baseline | BlockAssist+ single-channel | BlockAssist+ dual-channel v2 (paper) | BlockAssist+ hardened (single / dual v3) |
|---|---|---|---|---|---|
| Participant identity / KYC | pseudonymous addresses | X.509 MSP | X.509 MSP, KYC on-chain | same | same |
| Confidentiality of investor data | none (all public) | channels / PDC | PDC, **but KYC leaks via tx args** (P1) | **public state** (P3) | PDC + transient map (P1–P3 mitigated, measured) |
| Role-based authorisation | contract-level `require(msg.sender…)` | chaincode ABAC | PDC membership only (A1–A5 fail) | none (A1–A8 fail) | MSP role guard + per-account/per-investor ownership (all mitigated, measured) |
| Regulatory governance (validator approval) | rarely modelled | — | Validator org + PDC | governance channel, but self-approval possible (A8) | Validator-only approval (A7/A8 mitigated) |
| Cross-domain isolation | — | channels | single channel | 2 channels, **sync broken** | 2 channels, verified relay (§3) |
| Byzantine endorser tolerance | PoS consensus | policy-dependent | `OR` → none (M1) | governance `AND`, investment `OR` | tokens `OutOf(2,4)` (M1 mitigated); non-monetary records single-org |
| Finality | probabilistic, minutes | deterministic, ~1–2 s | deterministic, 0.6–2.7 s | same | + sync lag (§3.3) |
| Transaction cost | gas fees | none | none | none | none |
| Deployment complexity | low (public network) | medium | medium (1 channel, 1 CC) | higher (2 channels, 2 CCs) | higher (+ relay service) |

Add the specific crowdfunding systems already cited in your related-work section as extra columns, filling
only properties stated in those papers.

---

## 6. What to change in the manuscript

1. **Replace the functional PASS/FAIL tables** with §2 (load sweep up to 4,000 TPS offered, peers, orderers,
   endorsers, batch, resources) and state the single-host limitation explicitly.
2. **Dual-channel contribution**: either (a) present v3 (outbox + relay) as the synchronisation mechanism
   with §3.3 results, and fix the `PutState` → `PutPrivateData` regression, or (b) reposition the dual
   channel as a design proposal and keep the single-channel system as the evaluated contribution.
   The current text ("event-driven bridge … future work") must not be combined with claims that the
   dual-channel system is secure or functional.
3. **Security section**:
   * Add the threat model, the "before" attack table and the hardening with its before/after table (§4.1).
   * Report the measured cost of the hardening, which is negligible.
   * State the AND-policy/PDC design finding and the residual risk for non-monetary governance records.
   * Claims in the paper should refer to the hardened code.
4. Add the comparison tables of §5.
5. Non-determinism is fixed in the hardened code (`GetTxTimestamp()`). Present it as a finding: the original
   code rejects up to 44 % of transactions under multi-endorser policies.

## 7. Reproducing on the Table 7 VPS

```bash
cd benchmarks && ./build_chaincode.sh && (cd loadgen && npm ci)
```

```bash
./run_matrix.sh            # E1–E6, ~2 h, resumable
```

```bash
./run_attacks.sh && ./run_bridge.sh && python3 analyze.py
```

```bash
./run_attacks_hardened.sh && ./run_hardened_perf.sh && python3 analyze.py
```

Requirements: Docker, Go ≥ 1.22, Node 22, Python 3 with `pyyaml`, `matplotlib`; images
`hyperledger/fabric-{peer,orderer,tools,baseos}:2.5`, `couchdb:3.3.3`, `node:22-slim`.
