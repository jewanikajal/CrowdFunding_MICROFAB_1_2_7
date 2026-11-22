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

## Task 3 — Caliper stress-round counts: CONFIRMED from your Caliper workspace

**Source:** `josephrichard1988/crowdfunding`, branch `master`, folder `caliper-workspace/`:

* `benchconfig-single-full.yaml`;
* `workloads/*.js`;
* `report-single-full.html` (single-channel stress rounds: 1,002 to 4,303 transactions, matching Table 12);
* `package-lock.json` (Caliper 0.5.0).

**Duration-bounded rounds are ruled out:**

* All 76 rounds use `txNumber`; none uses `txDuration`.
* There are 2 workers, so 1,000 splits evenly into 500 per worker.

**The real cause is how Caliper 0.5.0 ends a round.** The worker loop (`caliper-worker.js`, `runFixedNumber`) is:

```js
while (stats.getTotalSubmittedTx() < number && !error) {
    await rateController.applyRateControl();
    await this.setImmediatePromise(() => { workloadModule.submitTransaction()... }); // not awaited
}
await CaliperWorker._waitForTxsToFinish(stats);
```

1. **Every Fabric transaction counts toward the limit**, not just each workload iteration. Many workload
   modules send setup transactions inside `submitTransaction()` before the measured operation. For example:
   * `createCampaign.js` creates a startup and then a campaign (2 transactions);
   * `respondToInvestmentProposal.js` creates a startup, a campaign and a proposal, then responds
     (4 transactions);
   * `triggerFundRelease.js` runs the full publish path, the agreement, the milestone report, the
     verification and the share before the release (about 10 transactions).
2. **Iterations aren't awaited.** When a worker's counter reaches 500, iterations already started keep
   sending their remaining steps. Caliper waits for them and counts them, so the total overshoots 1,000.
3. **Single-transaction operations still get +1 per worker.** The connector records a submission only
   after some asynchronous work, so each worker starts one extra iteration before its counter updates.
   2 workers × 501 = **1,002**. This is the value for every single-transaction operation in the report:
   createStartup, registerInvestor, initializeToken, submitMilestoneReport, collectCampaignFee,
   setFeeTiers and requestRefund.

**Suggested sentence:**

> Caliper counted between 1,002 and 4,303 transactions in stress rounds because Caliper's fixed-number
> round ends when a worker's count of submitted Fabric transactions reaches its share of `txNumber`
> (500 per worker), not when 1,000 workload iterations have run.
>
> Workloads whose iterations embed their prerequisite transactions therefore submit more than 1,000
> transactions in total. For example, CreateCampaign first creates a startup, and TriggerFundRelease first
> creates, validates and publishes a campaign and records an agreement and milestone. Iterations still in
> flight when the limit is reached also complete and are counted.
>
> Single-transaction operations show 1,002 because each of the 2 workers starts one iteration before its
> submission counter is updated.

**Important for the paper (and reviewer comment 2):**

* For multi-step operations, Table 12's throughput, latency and success rate are computed over **all**
  transactions of the iteration, including setup transactions. They are not over the named operation alone.
* Say this explicitly, or re-run with setup moved into `initializeWorkloadModule` (or a separate seeding
  round) so each measured round submits only the named operation.

## Task 4 — validation codes: CONFIRMED; the draft text must change for two operations

Reproduction details:

* The workload chains are taken from your `caliper-workspace/workloads`.
* They ran on the original v2 single-channel chaincode, with Microfab's orderer batching (100 ms / 10 transactions).
* Every step was classified as a validation code, or as an endorsement-phase error.
* Results are in `benchmarks/results/task4/chain_*.json` (script `attacks/task4_chains.js`).

**TransferTokens: code 11 MVCC_READ_CONFLICT. Confirmed.**

* Every iteration of `transferTokens.js` debits the same `PLATFORM` account.
* With a 10-transaction pool of hot keys, all failures were code 11
  (`results/raw/T4mf_transfer_v2_*.json`: 25 %, 24 % and 10 % success).

**RespondToInvestmentProposal: NOT code 11, and not a shared record.**

* `respondToInvestmentProposal.js` creates a **new, unique proposal** in every iteration and responds to it
  immediately, so there is no shared key.
* Reproduced failures are all endorsement-phase errors, `proposal not found`, with **no validation code**.
  The response failed in 0 of 25, 7 of 50 and 400 of 400 iterations at light, medium and stress load.
* **Cause:** the proposal is endorsed and committed on InvestorOrg's peer. The response is endorsed
  immediately afterwards by StartupOrg's peer, which has not yet received the private proposal data.
  `StartupInvestorShared` has `requiredPeerCount: 0`, so the data is copied best-effort and lags under load.
* **Fixes:**
  * set `requiredPeerCount: 1` on the collection;
  * or have the response endorsed by the InvestorOrg peer;
  * or retry the response on "not found".

**CreateDispute: NOT code 11 on CreateDispute.**

* `CreateDispute` itself is a write-only operation and committed 100 % of the times it was reached.
* `createDispute.js` funds the investor with a **TransferTokens from PLATFORM** before the dispute. That transfer
  failed with code 11 in 13 of 25, 43 of 50 and 388 of 400 iterations, and the iteration then stops.
* Caliper reports these transfer conflicts in the CreateDispute row.

**Suggested replacement text:**

> Three operations failed under concurrency, all because of how the workloads interact with shared state
> rather than because of the channel topology.
>
> TransferTokens committed 73.1 %, 69.2 % and 50.4 % of transactions at light, medium and stress load. Its
> failures carried Fabric validation code 11 (MVCC_READ_CONFLICT): concurrent transfers debit the same
> platform account, so when two transfers fall in one block, the second is invalidated.
>
> The CreateDispute workload first funds the disputing investor with a transfer from the same platform
> account. Its failures (85.7–93.5 % success) are these MVCC_READ_CONFLICT invalidations of the funding
> transfer; CreateDispute itself only writes a new record and cannot conflict.
>
> RespondToInvestmentProposal (82.9 % and 84.8 % at medium and stress load) responds to a proposal created
> moments earlier by another organisation. Its failures are endorsement-time "proposal not found" errors:
> under load, the private proposal record has not yet reached StartupOrg's peer, because the collection
> requires no synchronous dissemination (requiredPeerCount 0).
>
> These failures can be reduced with per-transfer keys or delta accounting for the platform account, a
> requiredPeerCount of at least 1 for shared collections, or client-side retries.

**Remaining check:** your exact percentages come from your Caliper run. The Caliper report does not show
validation codes, so the mechanisms above come from reproducing your workloads. If you still have the
Caliper console log (`caliper.log`), it will show `MVCC_READ_CONFLICT` for the transfers and "proposal not
found" for the responses.

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
