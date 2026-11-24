# BlockAssist+ v3 — Cookbook (step by step)

This cookbook takes you from an empty Linux machine to every v3 result used in the paper:

* a running network;
* a manual walkthrough of the business flow;
* security and privacy tests;
* the cross-channel bridge tests;
* the Caliper Table 12.

All commands are run from the repository root unless a step says `cd`.

---

## 0. What "v3" is

| Part | Folder | What it contains |
|---|---|---|
| Single-channel chaincode (Architecture A) | `CF_SingleChannel/crowdfundingv2_hardened/` | One channel `crowdfunding-channel`, 4 orgs, chaincode `crowdfunding`; `collections_config.json` (private data collections) |
| Dual-channel chaincode (Architecture B) | `CF_DualChannel/crowdfunding_dualchannel_v3/` | `governance` chaincode on `governance-validation-channel` (Startup, Validator, Platform); `investment` chaincode on `investment-execution-channel` (all 4 orgs); `*_hardened.json` collection configs |
| Token ledger | built from the same sources | Separate chaincode `cftoken` with an **OutOf(2,4)** endorsement policy |
| Cross-channel bridge | `benchmarks/bridge/relay.js` | Outbox + relay: listens for `CrossChannelSync` events and calls `DataBridgeContract:ApplySync` on the other channel; endorsers re-read the source ledger, so the relay cannot forge data |
| Network + tests | `benchmarks/` | `network.sh` (Fabric 2.5 network in Docker), attack, privacy and bridge tests, load generator |
| Caliper | `caliper-workspace/` | Table 12 benchmark (25 operations × light/medium/stress), adapted to v3 |

What was hardened in v3 (code comments are marked `Hardening` / `v3`):

* **Role guard.** Every function checks the caller's organisation (`security.go`, `roleGuard`).
* **Private data collections.** Confidential data lives in real PDCs. It is sent in the **transient map**, never as arguments:
  * `kyc`: income, Aadhaar, PAN, net worth;
  * `private`: investment and proposal terms;
  * `documents`: campaign documents.
* **SEBI accredited-investor check.** Income route, net-worth route, or hybrid route (`sebi_eligibility.go`).
* **Deterministic time.** `GetTxTimestamp()` is used instead of `time.Now()`.
* **Fraud control.** ValidatorOrg can blacklist a campaign (SE19).
* **Account ownership.** Token accounts are owner-controlled. Mint and treasury operations are PlatformOrg-only.
* **Dual channel only:**
  * a verifiable outbox/relay replaces the unsafe cross-channel writes;
  * the `StoreData` backdoor is removed;
  * fund release runs on the governance channel.

---

## 1. Prerequisites

| Item | Version used | Check |
|---|---|---|
| Linux x86-64, 4 vCPU, ≥ 8 GB RAM, ≥ 20 GB disk | Debian 13 / Ubuntu 22+ | `nproc; free -g` |
| Docker Engine | 24+ (tested 29.x) | `docker --version` |
| Go | 1.22+ (tested 1.24) | `go version` |
| Node.js + npm | 22 | `node --version` |
| Python 3 | 3.10+ | `python3 --version` |
| openssl, git | any | |

Pull the images once. The test runs use them offline:

```bash
docker pull hyperledger/fabric-peer:2.5
docker pull hyperledger/fabric-orderer:2.5
docker pull hyperledger/fabric-tools:2.5
docker pull couchdb:3.3.3
docker pull node:22-slim
```

---

## 2. Get the code and install the Node dependencies

```bash
git clone https://github.com/jewanikajal/CrowdFunding_MICROFAB_1_2_7.git
cd CrowdFunding_MICROFAB_1_2_7
```

* **Load generator and test clients** (Fabric Gateway SDK). The test containers load these via `NODE_PATH`:

  ```bash
  (cd benchmarks/loadgen && npm ci)
  ```

* **Caliper 0.5.0** (locked in `package-lock.json`):

  ```bash
  (cd caliper-workspace && npm ci)
  ```

---

## 3. Build the chaincode

```bash
benchmarks/build_chaincode.sh
```

* It copies each chaincode into `benchmarks/work/build/<name>` (the source is never modified).
* It adds a small chaincode-as-a-service launcher and builds static binaries into `benchmarks/work/bin/`.
* You get `crowdfunding_hardened` (single), `governance_v3` and `investment_v3` (dual), plus the original v2 binaries for the "before" tests.

To check that the v3 sources compile on their own:

```bash
(cd CF_SingleChannel/crowdfundingv2_hardened/contracts && go build ./... && go vet ./...)
(cd CF_DualChannel/crowdfunding_dualchannel_v3/contracts/governance && go build ./... && go vet ./...)
(cd CF_DualChannel/crowdfunding_dualchannel_v3/contracts/investment && go build ./... && go vet ./...)
```

---

## 4. Start a network

Only one network can run at a time, because both use the Docker network `cfnet`.

### 4a. Single channel (Architecture A)

```bash
cd benchmarks
HARDENED=1 CC_SUFFIX=_hardened TOKEN_BIN=crowdfunding_hardened ./network.sh up 1 1 single
```

### 4b. Dual channel (Architecture B) plus the relay

```bash
cd benchmarks
HARDENED=1 CC_SUFFIX=_v3 TOKEN_BIN=investment_v3 ./network.sh up 1 1 dual
rm -rf work/relay/*; mkdir -p work/relay
docker run -d --name relay --network cfnet -v "$PWD":/b -v "$PWD/work/net/crypto":/crypto:ro \
  -e NODE_PATH=/b/loadgen/node_modules node:22-slim \
  node /b/bridge/relay.js '{"org":"PlatformOrg","stateDir":"/b/work/relay","statsFile":"/b/work/relay/stats.jsonl","batch":50}'
```

The arguments of `network.sh up` are `<peersPerOrg> <orderers> <single|dual> [batchTimeout] [batchSize]`.

* `./network.sh up 1 1 single 100ms 10` uses Microfab's orderer batching. The Caliper runs use this.
* `./network.sh up 2 3 single` gives 2 peers per org and 3 Raft orderers. The scalability matrix uses this.

What the script creates:

1. **Crypto material and channel artefacts** for 4 organisations (StartupOrg, InvestorOrg, ValidatorOrg, PlatformOrg).
2. **Nodes:** one peer per org, each with its own CouchDB; a Raft orderer; and the `cfcli` tools container. TLS is on everywhere.
3. **Channels.** Single: `crowdfunding-channel`. Dual: `governance-validation-channel` and `investment-execution-channel`.
4. **Chaincode definitions.** Each is approved by every org and committed with its collection config and endorsement policy:

   | Chaincode | Endorsement policy |
   |---|---|
   | `crowdfunding` (single) and `investment` (dual) | any one member peer (OR) |
   | `governance` (dual, hardened) | OR(Startup, Validator, Platform) |
   | `cftoken` | OutOf(2,4) |
5. **Chaincode servers:** one per peer (`peer0<org>-<cc>` containers).

Check that it is up. Wait about 45 s after start-up before the first private-data write, so that the peers have discovered each other (gossip):

```bash
docker ps --format '{{.Names}}' | sort
docker exec cfcli ls /w/crypto/peerOrganizations
```

Stop it (this removes all containers and ledger data):

```bash
./network.sh down
```

---

## 5. Walk through the business flow by hand (single channel)

**Fast path.** `caliper-workspace/scripts/v3/seed-v3.js` runs the whole honest flow:

* create startup and campaign, submit, validate, approve, share, publish;
* register an investor with KYC in the transient map;
* proposal, agreement, milestone;
* tokens and fee tiers.

It prints each step:

```bash
cd caliper-workspace
python3 scripts/v3/make-network.py single ../benchmarks/work/net/crypto      # writes network-v3-single.yaml + profiles
docker run --rm --network cfnet -v "$PWD":/ws -w /ws node:22-slim node scripts/v3/seed-v3.js single
```

**By hand with the peer CLI.** Define a helper. It runs a peer command as the admin of an organisation, inside `cfcli`:

```bash
cc() { # cc <Org> invoke|query <channel> <chaincode> '<json>' [extra peer flags]
  local org=$1 mode=$2 ch=$3 name=$4 json=$5; shift 5
  local d=$(echo "$org" | tr A-Z a-z).example.com
  local tls=/w/crypto/peerOrganizations/$d/peers/peer0.$d/tls/ca.crt
  local env=(-e CORE_PEER_TLS_ENABLED=true -e CORE_PEER_LOCALMSPID=${org}MSP
             -e CORE_PEER_MSPCONFIGPATH=/w/crypto/peerOrganizations/$d/users/Admin@$d/msp
             -e CORE_PEER_TLS_ROOTCERT_FILE=$tls -e CORE_PEER_ADDRESS=peer0.$d:7051)
  if [ "$mode" = query ]; then docker exec "${env[@]}" cfcli peer chaincode query -C "$ch" -n "$name" -c "$json" "$@"
  else docker exec "${env[@]}" cfcli peer chaincode invoke -o orderer0.example.com:7050 --tls \
    --cafile /w/crypto/ordererOrganizations/example.com/orderers/orderer0.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
    -C "$ch" -n "$name" --peerAddresses peer0.$d:7051 --tlsRootCertFiles $tls --waitForEvent -c "$json" "$@"; fi; }
CH=crowdfunding-channel; CC=crowdfunding
```

### Step 1 — StartupOrg creates a startup

This succeeds:

```bash
cc StartupOrg invoke $CH $CC '{"function":"StartupContract:CreateStartup","Args":["ST_DEMO","owner1","Demo Startup","IoT hardware","S-DEMO"]}'
```

### Step 2 — Role guard: InvestorOrg tries the same function

This must fail with `access denied: caller InvestorOrgMSP is not authorised`:

```bash
cc InvestorOrg invoke $CH $CC '{"function":"StartupContract:CreateStartup","Args":["ST_X","o","X","x","S-X"]}'
```

### Step 3 — InvestorOrg registers an investor (KYC in the transient map)

The KYC values are base64-encoded JSON under the key `kyc`. The arguments carry only the ID and name (income `0`, Aadhaar and PAN empty):

```bash
KYC=$(echo -n '{"annualIncome":25000000,"aadharNumber":"999988887777","panNumber":"ABCDE1234F"}' | base64 -w0)
cc InvestorOrg invoke $CH $CC '{"function":"InvestorContract:RegisterInvestor","Args":["INV_DEMO","Demo Investor","0","",""]}' \
   --transient "{\"kyc\":\"$KYC\"}"
```

### Step 4 — Privacy: confidential data as plaintext arguments is refused

This must fail with `KYC data must not be passed as transaction arguments`:

```bash
cc InvestorOrg invoke $CH $CC '{"function":"InvestorContract:RegisterInvestor","Args":["INV_BAD","Bad","25000000","999988887777","ABCDE1234F"]}'
```

### Step 5 — Privacy: the Aadhaar number never reaches public state

Search every peer's CouchDB. Only the private-data databases (`$$p`) of InvestorOrg may contain it. `$$h` databases contain hashes only:

```bash
for o in startuporg investororg validatororg platformorg; do
  for db in $(docker exec couchdb.peer0$o curl -s http://admin:adminpw@localhost:5984/_all_dbs | tr -d '[]"' | tr , ' '); do
    docker exec couchdb.peer0$o curl -s "http://admin:adminpw@localhost:5984/$db/_all_docs?include_docs=true" | grep -q 999988887777 && echo "$o: found in $db"
  done
done
```

Expected output: only `investororg: found in crowdfunding-channel_crowdfunding$$p$investor$private$data` (CouchDB escapes upper-case letters with `$`).

The rest of the flow follows the same pattern: `CreateCampaign` (documents in transient `documents`), `SubmitForValidation`, `ValidatorContract:ValidateCampaign` and `ApproveOrRejectCampaign` (ValidatorOrg), `ShareCampaignToPlatform`, `PlatformContract:PublishCampaignToPortal`, then `InvestorContract:MakeInvestment` (transient `private`). Copy the exact arguments from `caliper-workspace/scripts/v3/seed-v3.js`.

**On the dual-channel network:**

* Use `governance-validation-channel` / `governance` for the campaign lifecycle and fund release.
* Use `investment-execution-channel` / `investment` for investors, investments, proposals, disputes and refunds.
* Use `cftoken` for tokens. It needs 2 endorsing orgs, so add a second `--peerAddresses ... --tlsRootCertFiles ...` pair.
* After `PublishCampaignToPortal`, the relay copies the public campaign record to the investment channel within about 3 s. Check it:

  ```bash
  cc InvestorOrg query investment-execution-channel investment '{"Args":["DataBridgeContract:ReadData","AllOrgsShared","CAMPAIGN_PUBLIC_<campaignId>"]}'
  ```

---

## 6. Security and privacy tests

Each script starts its own network(s), runs the tests and stops the network. No manual setup is needed beyond steps 2–3. How the tests work is explained in `benchmarks/THREAT_MODEL.md` and in the "privacy and security tests explained" answer in `TASKS_1_7_RESPONSE.md`.

| Step | Command (run in `benchmarks/`) | What it does | Output |
|---|---|---|---|
| 6.1 Before hardening | `./run_attacks.sh` | Attacks A1–A15, P1–P3 and C1–C2 on the original v2 chaincode, plus the malicious-endorser tests under the OR policy and the 2-of-4 policy | `results/security/{single,dual,malicious_or,malicious_k2}.json` |
| 6.2 After hardening | `./run_attacks_hardened.sh` | The same attack IDs on v3, plus honest-path positive controls (POS1–POS7) and a tampered `cftoken` installed by a compromised StartupOrg | `results/security_hardened/{single,dual,malicious}.json` |
| 6.3 Tasks 1, 5 and 7 | `./run_tasks_tests.sh` | SEBI eligibility (T1-1…T1-8); SE19 blacklisting; privacy PR04, PR05, PR07, PR09, PR11 (CouchDB scan on all 4 peers + block scan + cross-org reads) | `results/tasks/{single,dual}.json`, `results/tasks_tests.log` |
| 6.4 Bridge security and throughput | `./run_bridge.sh` then `./run_bridge_batch.sh` | Malicious relay (B-T1…B-T4: fabricate, bypass, replay, wrong endorser); sync latency and throughput at 10–150 TPS; relay crash and recovery | `results/bridge/v3_tamper.json`, `results/bridge/v3*_sync_*.json` |
| 6.5 Validation codes (Task 4) | `./run_task4.sh` | Replays the Caliper workload chains step by step and records the Fabric validation code of each step | `results/task4/` |

Read a result file:

```bash
python3 -c "import json;[print(x['id'],x.get('outcome',x.get('result')),'|',x.get('evidence','')[:80]) for x in json.load(open('results/security_hardened/dual.json'))]"
```

Expected outcome:

| Suite | Expected result |
|---|---|
| Hardened attacks | 0 `VULNERABLE` and all `POS*` = `PASS` (single 24 mitigated + 9 PASS; dual 25 mitigated + 11 PASS) |
| Task tests | 22/22 (single) and 23/23 (dual) `PASS` |
| Bridge tampering | 4/4 `MITIGATED` |

---

## 7. Performance and scalability matrix (reviewer comment 2)

Run in `benchmarks/`:

```bash
./run_matrix.sh                # all experiments: TPS sweep, peers 1-3/org, orderers 1/3/5, endorsement policies, batch sizes
./run_matrix.sh E1 E3          # only some experiments; finished rounds are skipped (resumable)
./run_hardened_perf.sh         # cost of the v3 hardening vs the original
python3 analyze.py             # -> results/RESULTS_TABLES.md, results/summary.csv, results/figures/
```

* `bench.py` drives `loadgen/loadgen.js` (Fabric Gateway SDK, open-loop fixed rate).
* `monitor.py` records CPU and memory of every container.
* `DUR=20` (seconds per round) is the default.

---

## 8. Caliper Table 12 on v3 (reviewer comments 2 and 5; Tasks 3 and 4)

Two designs are available. **Use the corrected design (isolated) for the paper.**

| Design | Bench config | What a round measures |
|---|---|---|
| Faithful (original workloads) | `benchconfig-<arch>-full.yaml` | Named operation **plus** its setup transactions. Stress rounds count up to 9,307 transactions. |
| **Corrected (isolated)** | `benchconfig-<arch>-isolated.yaml` | **Only the named operation.** Prerequisites are created in `initializeWorkloadModule()` before Caliper starts counting (`workloads-isolated/isolated.js`). |

Steps, run in `caliper-workspace/`:

1. **Generate the isolated configs from the full ones.** They are already committed, so this is only needed if you change the full configs:

   ```bash
   python3 scripts/v3/make-isolated-bench.py single
   python3 scripts/v3/make-isolated-bench.py dual
   ```

2. **Smoke test** (25 operations × 6 transactions, about 5 min):

   ```bash
   TAG=single-isolated-smoke scripts/v3/run-v3-caliper.sh single benchconfig-single-isolated-smoke.yaml report-v3-single-isolated-smoke.html
   ```

3. **Full runs**, about 2 h (single) and 4–5 h (dual). Run them detached, so that a closed terminal does not stop them:

   ```bash
   TAG=single-isolated setsid nohup scripts/v3/run-v3-caliper.sh single benchconfig-single-isolated.yaml report-v3-single-isolated.html > run-iso-single.out 2>&1 &
   ```

   After the single run has finished:

   ```bash
   TAG=dual-isolated setsid nohup scripts/v3/run-v3-caliper.sh dual benchconfig-dual-isolated.yaml report-v3-dual-isolated.html > run-iso-dual.out 2>&1 &
   ```

   `run-v3-caliper.sh` does the whole pipeline:
   * builds the chaincode;
   * starts the network with Microfab batching (100 ms / 10 transactions);
   * starts the relay (dual only);
   * waits for gossip and seeds the data;
   * runs Caliper (2 workers; light 50 @ 10 TPS, medium 100 @ 25 TPS, stress 1,000 @ 100 TPS);
   * stops the network.

   Useful environment variables:
   * `SKIP_UP=1` reuses a running network.
   * `SKIP_SEED=1` skips seeding.
   * `PREP_CONCURRENCY` (default 20) sets the parallelism of prerequisite creation.
   * `BRIDGE_WAIT_MS` (default 4,000) sets the wait for the bridge.

   Progress:

   ```bash
   grep "Started round" caliper-v3-single-isolated.log | tail -1
   ```

4. **Build Table 12** from the HTML report, the Caliper log and the per-function operation log:

   ```bash
   python3 scripts/v3/table12.py single-isolated report-v3-single-isolated.html caliper-v3-single-isolated.log oplog-v3-single-isolated
   python3 scripts/v3/table12.py dual-isolated   report-v3-dual-isolated.html   caliper-v3-dual-isolated.log   oplog-v3-dual-isolated
   ```

   This produces `results-v3/table12-<tag>.md` and `.json`. For every round you get:
   * Caliper success, failure, throughput and latency;
   * named-operation commits;
   * failure causes: the Fabric validation code (e.g. 11 = MVCC_READ_CONFLICT) or the endorsement error.

5. **Resume a run that stopped part-way.** Cut the bench config at the round that was in progress and run Caliper again on the still-running network. Then pass both logs, comma-separated:

   ```bash
   python3 scripts/v3/table12.py dual report-v3-dual-full-part2.html caliper-v3-dual.log,caliper-v3-dual-part2.log
   ```

   An example config for this is `benchconfig-dual-full-part2.yaml`.

The final tables used in the paper:

* `results-v3/table12-single-isolated.md`
* `results-v3/table12-dual-isolated-final.json` (P09 and P18 dual from `table12-dual-isolated-p09p18`, the rerun on the fixed chaincode)
* `results-v3/table12-isolated-combined.md` (both side by side)

The full list of changes made to the original Caliper workspace for v3 is in `caliper-workspace/V3_ADAPTATION.md`.

---

## 9. Where each paper result comes from

| Paper item | Source |
|---|---|
| Reviewer comments 2–5 response | `REVIEWER_RESPONSE.md` |
| Tasks 1–7 answers | `TASKS_1_7_RESPONSE.md` (use the sections marked FINAL for Tasks 3 and 4) |
| Threat model (STRIDE, adversaries ADV-1…ADV-5) | `benchmarks/THREAT_MODEL.md` |
| Security results table (before and after) | `benchmarks/results/security/`, `security_hardened/`, `bridge/v3_tamper.json`, `tasks/` |
| Scalability, TPS and resource tables and figures | `benchmarks/results/RESULTS_TABLES.md`, `results/figures/` |
| Cross-channel synchronisation (latency, throughput, crash recovery) | `benchmarks/results/bridge/` |
| Caliper Table 12 | `caliper-workspace/results-v3/` |

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot connect to the Docker daemon` partway through a run | The Docker daemon stopped | Restart Docker (`sudo systemctl restart docker`), then rerun; matrix rounds that already finished are skipped |
| `failed to distribute private collection … required peer count` during seeding | Seeding started before the peers found each other (`requiredPeerCount: 1`) | Wait about 45 s after `network.sh up` (`run-v3-caliper.sh` does this). Seeding cannot be re-run on a half-seeded network: run `./network.sh down` and start again. |
| `exceeding concurrency limit` under stress | Peer gateway limit `peer.limits.concurrency.gatewayService: 500` | Expected at 100 TPS on 4 vCPU. It is a host capacity limit, not a chaincode error. |
| TransferTokens fails with `status code: 11` | Every transfer debits the same `PLATFORM` account (MVCC_READ_CONFLICT) | Expected; this is the Task 4 finding |
| `KYC data must not be passed as transaction arguments` | Confidential data sent as arguments | Send it in the transient map (`kyc`, `private`, `documents`) |
| `requires endorsement from organisation(s) not in distribution policy` | A transient-map transaction was endorsed by a peer outside the collection | Endorse with the caller's own organisation (gateway `endorsingOrganizations`) |
| A Caliper round never finishes | A workload submitted nothing in `submitTransaction()` | The isolated workload always submits; if you write a new workload, keep that rule |
| `network cfnet already exists` / port in use | A previous network is still running | `cd benchmarks && ./network.sh down` |
