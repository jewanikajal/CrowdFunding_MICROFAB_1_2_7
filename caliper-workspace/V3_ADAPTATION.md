# Caliper workspace — adaptation to the v3 chaincode

The workspace was imported unchanged from `josephrichard1988/crowdfunding@9d1ae43` (see `PROVENANCE.md`).
That run produced the original Table 12 on the v2 chaincode under Microfab. This file lists every change
made so the **same 25 operations, rounds and rate controller** run against the v3 chaincode:

* single channel: `CF_SingleChannel/crowdfundingv2_hardened`;
* dual channel: `CF_DualChannel/crowdfunding_dualchannel_v3`.

## Unchanged

* **Bench configs.** `benchconfig-single-full.yaml` and `benchconfig-dual-full.yaml` are unchanged.
  * 25 operations; light (50 transactions at 10 TPS), medium (100 at 25 TPS) and stress (1,000 at 100 TPS).
  * Fixed-rate controller and 2 workers.
  * Cool-down rounds in the dual config.
* **Workloads.** The workload modules (`workloads/*.js`) are unchanged except `helpers.js`.
  * Unique IDs still have the form `PREFIX_W{worker}_T{tx}_{timestamp}_{random}`.
* **Caliper.** Caliper 0.5.0 with the peer-gateway connector (`package-lock.json`).

## Changed — `workloads/helpers.js` (all changes marked "v3")

1. **Routing.**
   * Token operations (`initializeToken`, `mintTokens`, `transferTokens`, `createTokenAccount`) call the
     separate `cftoken` chaincode, which v3 deploys with an OutOf(2,4) endorsement policy.
   * Dual channel: `publishCampaignToPortal` runs on the governance channel. The public campaign record then
     reaches the investment channel through the v3 outbox/relay bridge.
2. **Confidential arguments go in the transient map.** v3 rejects them as plaintext arguments, because
   arguments are recorded in the block. The record IDs stay as arguments.

   | Operation | Transient key | Fields |
   |---|---|---|
   | `registerInvestor` | `kyc` | income, Aadhaar, PAN |
   | `makeInvestment` | `private` | campaign, investor, amount, currency |
   | `createInvestmentProposal` | `private` | campaign, investor, startup, amount, terms |
   | `respondToInvestmentProposal` | `private` | action, counter-offer |
   | `createCampaign`, `submitForValidation`, `validateCampaign` | `private` | documents |

3. **Published campaigns.** Investment-side operations bootstrap a **published** campaign on both
   architectures, because v3 accepts investments and proposals only into published, open campaigns.
   Previously the single channel used an unpublished campaign.
4. **Bridge wait (dual only).** After publication the workload waits `BRIDGE_WAIT_MS` (default 4,000 ms) for
   the bridge. This wait is not a transaction and is not counted by Caliper.
5. **Per-function operation log** (`CALIPER_OPLOG_DIR`).
   * Each request appends a JSON line: time, contract function, read-only, committed.
   * It does not change Caliper's statistics. It is used to report each round's named operation separately
     from its prerequisite transactions.

## Added

* `scripts/v3/make-network.py` builds `network-v3-<arch>.yaml` and TLS connection profiles for the v3
  networks built by `benchmarks/network.sh`.
* `scripts/v3/seed-v3.js` creates the same seed records as `scripts/seed-single-full.sh` (STARTUP001,
  CAMP001, VAL001, INVESTOR001, PROPOSAL001, AGREEMENT001, milestone M1, tokens, fee tiers) using v3 rules.
* `scripts/v3/run-v3-caliper.sh <single|dual>` runs the whole pipeline:
  1. builds the v3 chaincode;
  2. starts the network with Microfab's orderer batching (BatchTimeout 100 ms, MaxMessageCount 10);
  3. starts the relay (dual only);
  4. seeds the network;
  5. runs Caliper and writes `report-v3-<arch>-full.html` and `caliper-v3-<arch>.log`.
* `scripts/v3/table12.py` builds Table 12 for v3 from the report, the log and the operation log.

## v3 chaincode changes made for this run

* **Disputes.** `PlatformContract:CreateDispute` may be invoked by the affected party (StartupOrg,
  InvestorOrg, ValidatorOrg) as well as PlatformOrg. The caller must match the dispute's `initiatorType`.
  The workloads file disputes as InvestorOrg.
* **Bridged collection policy.** `AllOrgsShared` (bridged public campaign records) uses the member-OR
  endorsement policy. With OutOf(2,4), a transaction that reads it and carries transient data could not
  be endorsed by the gateway.

## Differences from the original environment (state them in the paper)

| | Original Table 12 | v3 Table 12 |
|---|---|---|
| Chaincode | v2 (`crowdfundingv2`, `crowdfunding_dualchannel_v2`) | v3 (hardened + bridge) |
| Network | Microfab 0.0.21 | `benchmarks/network.sh`: Fabric 2.5.16, 4 orgs × 1 peer, 1 Raft orderer, CouchDB, **TLS on**, Microfab batch settings |
| Host | Netcup VPS, AMD EPYC, 4 vCPU, 8 GB | cloud container, Intel Xeon 2.3 GHz, 4 vCPU, 16 GB |
