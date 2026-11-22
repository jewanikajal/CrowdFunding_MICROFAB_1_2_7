# Tasks 1–7: results

The "v3" code is `CF_SingleChannel/crowdfundingv2_hardened` (single channel) and
`CF_DualChannel/crowdfunding_dualchannel_v3` (dual channel).

Tests were run on live Fabric 2.5.16 networks:

* Tasks 1, 5 and 7: `benchmarks/run_tasks_tests.sh`. Results are in `benchmarks/results/tasks/{single,dual}.json`.
* Task 4: `benchmarks/run_task4.sh`. Results are in `benchmarks/results/raw/T4*_*.json`.

## Task 1 — SEBI accredited-investor eligibility: DONE (single + dual)

* **Where:** `sebi_eligibility.go`, called from `RegisterInvestor`.
* **Who qualifies:** an individual qualifies on any one of three routes.
  * Annual income ≥ ₹2 crore → basis `INCOME`.
  * Net worth ≥ ₹7.5 crore, of which ≥ ₹3.75 crore is in financial assets → basis `NET_WORTH`.
  * Annual income ≥ ₹1 crore **and** net worth ≥ ₹5 crore, with ≥ ₹2.5 crore in financial assets →
    basis `INCOME_AND_NET_WORTH`. This third route is in SEBI's 2021 framework. You can switch it off with
    `SEBIAllowHybridRoute = false`.
* **Input:** net worth and financial assets arrive in the transient KYC map, so they never reach the block.
* **Stored:** the qualifying route is stored in `InvestorPrivateData` (InvestorOrg only).
* **Checks:** financial assets cannot exceed net worth, and all values must be non-negative.
* **Tests:** 9 of 9 cases pass on both architectures. They cover each route, the exact boundaries
  (₹2 crore; ₹7.5 crore with ₹3.75 crore), and the rejections.

## Task 2 — `ApproveOrRejectCampaign` timestamp: DONE

* **Before:** v3 already used the transaction timestamp through the `txNow` helper.
* **Change:** it now calls `ctx.GetStub().GetTxTimestamp()` explicitly, and returns an error if the timestamp
  can't be read (`validatororg_contract.go`). This applies to the single-channel code and both dual-channel
  chaincodes.
* **Effect:** the `validationProofHash` is now identical on every endorser.
* **Original v2:** the paper's code still uses `time.Now()`. It was left unchanged so it stays reproducible.

## Task 3 — Caliper stress-round counts: NEEDS YOUR CALIPER FILES

The Caliper workspace (benchconfig, workload modules, report) is not in the repository, so the reason
can't be confirmed from data. Two Caliper mechanisms produce more than the nominal 1,000 transactions:

1. **A fixed-duration round.** If a round sets `txDuration`, it runs for that long, and `txDuration` takes
   precedence over `txNumber` when both are set.
   * At 100 TPS, 4,303 transactions ≈ 43 s of sending.
   * See the [Caliper bench-config documentation](https://hyperledger.github.io/caliper/vNext/bench-config/).
2. **Several Fabric transactions per workload iteration.** If a workload's `submitTransaction` also sends
   its setup transactions, each one is counted. Typical cases are creating the campaign or proposal in the
   same iteration, or lazy setup on the first call.
   * Small surpluses such as 1,002 also fit per-worker rounding: 3 workers × 334 = 1,002, or 6 × 167.

**To confirm, please send:**

* `benchconfig.yaml` — the `txNumber`/`txDuration` of each round and the number of workers;
* the workload `.js` files;
* `report.html` or the Caliper log.

## Task 4 — validation codes: PARTLY CONFIRMED; CreateDispute claim must change

Reproduction on the original v2 single-channel chaincode:

* Rounds identical to the paper's (50 transactions at 10 TPS, 100 at 25 TPS, 1,000 at 100 TPS).
* Orderer batching identical to Microfab: `BatchTimeout` 100 ms and `MaxMessageCount` 10, taken from the
  Microfab source (`internal/pkg/orderer/runtime.go`).

| Operation | Workload | Light | Medium | Stress | Failure code |
|---|---|---|---|---|---|
| TransferTokens | all transfers debit PLATFORM | 25.0 % | 24.0 % | 10.0 % | **11 MVCC_READ_CONFLICT** (all failures) |
| RespondToInvestmentProposal | responses spread over 10 proposals | 100 % | 97.0 % | 46.6 % | **11 MVCC_READ_CONFLICT** (all failures) |
| RespondToInvestmentProposal | one proposal per transaction | 100 % | 100 % | 100 % | — |
| CreateDispute | unique dispute IDs | 100 % | 100 % | 100 % | — |

* **TransferTokens:** confirmed. All failures are code 11, because concurrent debits of the same account
  conflict within a block. The exact rates depend on block size and how many sender accounts the workload
  used.
* **RespondToInvestmentProposal:** the function reads and writes only `PROPOSAL_<id>`. It fails with code 11
  only when concurrent transactions respond to the **same** proposal. Your 82.9 % and 84.8 % therefore imply
  that the Caliper workload reused proposals. Confirm this in the Caliper log, where MVCC failures show as
  `MVCC_READ_CONFLICT`.
* **CreateDispute:** **cannot** fail with code 11.
  * It writes `DISPUTE_<id>` without reading anything, and Fabric only raises MVCC conflicts on keys a
    transaction has read.
  * It reached 100 % in every round here.
  * So the 85.7–93.5 % in Table 12 has another cause. Likely candidates are an endorsement-phase error (no
    validation code), a timeout, or a setup step that failed in the same iteration.
  * **Change the sentence** so it no longer says CreateDispute "updates shared records", and take the reason
    from the Caliper log.

## Task 5 — SE19 investment after blacklisting: IMPLEMENTED (single + dual)

* **New function:** `ValidatorContract:BlacklistCampaign(campaignID, reason)`, callable only by ValidatorOrg,
  at any stage including after publication.
  * The reason stays in `ValidatorPrivateData`.
  * A public marker `CAMPAIGN_BLACKLIST_<id>` (without the reason) is written, and the public campaign status
    becomes `BLACKLISTED`.
  * In dual, both are bridged to the investment channel, where they arrived in 3.0 s.
* **Enforcement:** `MakeInvestment` and `CreateInvestmentProposal` reject blacklisted campaigns.
* **Tests (single and dual):**
  * An investment before blacklisting is accepted.
  * StartupOrg cannot blacklist.
  * An investment after blacklisting is rejected with "blacklisted (fraud control)", and so is a proposal.
  * `IsCampaignBlacklisted` returns true.
  * The reason is absent from public state.
* **Residual limitation (dual):** between blacklisting and bridge delivery (about 3 s), an investment could
  still be accepted.

## Task 6 — "MAJORITY of channel member organisations, as configured by Microfab": **NO**

* **Microfab's actual default:** Microfab sets both `Endorsement` and `LifecycleEndorsement` to `ANY Endorsement`
  (`internal/pkg/channel/channel.go` lines 147–148 and `internal/pkg/orderer/runtime.go` lines 236–237, commit
  `da71b13`).
* **Your deployments override it anyway** with explicit `--signature-policy` values:
  * single channel: `OR(Startup, Investor, Validator, Platform)`;
  * dual governance: `AND(Validator, Platform)`;
  * dual investment: `OR(all four)`.
* **Suggested text:** "Chaincodes were deployed with explicit signature policies (see Table X); Microfab's
  channel default is ANY Endorsement."

## Task 7 — privacy tests on v3: ALL PASS (single + dual)

"Public state" was checked directly in each peer's CouchDB: the `<channel>_<chaincode>` database for public
state and the `$$p…` databases for private data. Blocks were fetched with `qscc` by the organisation under test.

| Test | Single | Dual | Evidence |
|---|---|---|---|
| PR04 Aadhaar not in public state | PASS | PASS | absent from public state on all 4 peers and from blocks; private copy only on InvestorOrg peer |
| PR05 PAN not visible to unauthorised orgs | PASS | PASS | Investor and Validator can read; Startup and Platform denied; absent from public state and blocks; stored only on Investor/Validator peers |
| PR07 Annual income not in public state | PASS | PASS | as PR04 |
| PR09 StartupOrg cannot read annual income | PASS | PASS | read denied (`tx creator does not have read access`); not on StartupOrg peer or in its blocks; InvestorOrg can read |
| PR11 Campaign private documents not readable by InvestorOrg | PASS | PASS | read denied; not on InvestorOrg peer; not in blocks; not in the published campaign record |
| PR11b Documents as plaintext arguments | PASS (rejected) | PASS (rejected) | — |

**PR11 needed a fix; it failed before.** On the single channel, campaign document names leaked in two ways:

* through the `CreateCampaign` block, which InvestorOrg receives;
* through the public campaign record, because `PublishCampaignToPortal` copied the documents list into
  public state.

What changed:

* Documents now arrive only through the transient map, in `CreateCampaign`, `SubmitForValidation`,
  `UpdateCampaignDocs` and `ValidateCampaign`.
* Document fields are removed from every public or bridged campaign record (19 write sites).
* In dual, the investment chaincode refuses writes to governance-private collections, because these would
  pass through the investment channel's public outbox.
