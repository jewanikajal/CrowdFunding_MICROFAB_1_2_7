# Caliper workspace — Single / Dual / Multi crowdfunding

Benchmarks for all three architectures (see `../CALIPER_IMPLEMENTATION_PLAN.md`).

**T6 evaluation categories** (Privacy / Functional / Security / Concurrency / Failure-Recovery): see [`T6_TEST_CATEGORIES_HOW_TO.md`](T6_TEST_CATEGORIES_HOW_TO.md).

| Arch | Network config | Bench config | Port | Microfab / wallets |
|------|----------------|--------------|------|--------------------|
| Single | `network-single.yaml` | `benchconfig-single.yaml` | 9090 | `../crowdfundingv2/_wallets` |
| Dual | `network-dual.yaml` | `benchconfig-dual-full.yaml` | 7070 | `../crowdfunding_dualchannel_v2/_wallets` |
| Multi | `network-multi.yaml` | `benchconfig-multi-full.yaml` | 8080 | `../_wallets` |

Crypto PEMs used by Caliper live under `/caliper-workspace/crypto/{single,dual,multi}/<Org>/` (**gitignored** — private keys must not be committed). A bare `git clone` does **not** create that tree; it is created automatically when you run Caliper/sync after Microfab wallets exist:

1. If PEMs are missing → export from `_wallets` into `crypto/<arch>/…` (`mkdir -p`)
2. Check whether `crypto/<arch>` matches the wallet certs/keys
3. On mismatch → re-export PEMs, then recheck (fail if still mismatched)

```bash
# Standalone (also runs automatically inside run-*-caliper.sh):
bash scripts/sync-crypto-pems.sh single   # or dual / multi
```

If PEMs were tracked in git before, untrack once (keeps local files):  
`git rm -r --cached caliper-workspace/crypto`

## Setup (once)

```bash
cd /root/crowdfunding/caliper-workspace
npm install --omit=dev @hyperledger/caliper-cli@0.5.0 @hyperledger/fabric-gateway
# Caliper 0.5 supports fabric:2.2 / fabric:2.4 (not 2.5). Use 2.4 with --caliper-fabric-gateway-enabled.
npx caliper bind --caliper-bind-sut fabric:2.4 --caliper-bind-cwd ./
```

Bring up **one** Microfab + chaincodes for the architecture under test before launching.

## Run (Single) — one command, fully automatic

You do **not** run seed and Caliper separately. This single command chains everything:

1. Sync + verify crypto PEMs (`wallets` ↔ `crypto/single`; export + recheck on mismatch)
2. Full E2E seed (tokens → startup → campaign → validate → approve → share → publish → investor → fund → proposal → agreement) → writes `seed-state.json`
3. Caliper all rounds one after another (P06/P07/P12/P13–P15/P17/P19/P21/P25 use fresh per-tx state where needed)
4. Saves the HTML report

```bash
cd /root/crowdfunding/caliper-workspace

# Peer health (before seed / Caliper)
bash scripts/check-single-peers.sh

# Default: seed + all 25 ops × low / medium / stress → report-single-full.html
bash scripts/run-single-caliper.sh
```

That one command runs seed, then every T12 function at **low (50@10 TPS), medium (100@25 TPS), and stress (1000@100 TPS)** — 75 ops rounds plus a peer cool-down after stress-P20 (HTTP + read + Platform write probe; does not change op TPS) — then saves the report. Sit and wait until it prints `DONE`.

Multi-step workloads are kept. Each peer call has a **30s timeout** (`CALIPER_TX_TIMEOUT_MS`) so a dead Microfab fails that tx instead of freezing the round forever.

Failed steps **soft-fail** (count as Caliper Fail and continue) instead of throwing and aborting the whole round. P13 uses `initialSupply=0` to avoid PLATFORM-account MVCC; proof-hash bootstrap retries longer before skipping that tx.

Optional shorter modes:
```bash
bash scripts/run-single-caliper.sh t12    # 25 ops, low only (smoke)
bash scripts/run-single-caliper.sh all6   # 6 core ops × L/M/S
```

## Run (Dual) — one command

Prereq: Microfab on **7070** + `governance` / `investment` chaincodes deployed (`crowdfunding_dualchannel_v2`).

```bash
cd /root/crowdfunding/caliper-workspace

# Optional: peer health (empty ledger / missing seed data is OK; 502/Unavailable is not)
bash scripts/check-dual-peers.sh

# Default: seed + all 25 ops × L/M/S → report-dual-full.html
bash scripts/run-dual-caliper.sh

# Smoke only (CreateStartup L/M/S — validates governance AND endorsement via peer gateway)
bash scripts/run-dual-caliper.sh smoke
```

Pipeline: peer health → PEM sync (`crypto/dual`) → `seed-dual-full.sh` → Caliper → `report-dual-*.html`.

Same measured rates as single: **low 50@10 / medium 100@25 / stress 1000@100**. Op TPS is not reduced for dual.

### Dual peer cool-downs (op TPS unchanged)

Governance uses endorsement policy **AND(Validator, Platform)** — two endorsements per invoke. On Microfab that can knock peers over at medium/stress; later rounds then fail with `EndorseError: 14 UNAVAILABLE`.

Cool-downs are **extra rounds** (`workloads/peerCooldown.js`) inserted **between** measured L/M/S rounds. They do **not** change op TPS (still 10 / 25 / 100).

#### Timing (each cool-down round)

Configured in the bench YAML `arguments` for `peerCooldown.js`:

| Cool-down label pattern | Bench | Fixed settle `pauseMs` | Poll | Ready | Max wait | Cool-down `txNumber` @ 1 TPS |
|-------------------------|-------|------------------------|------|-------|----------|------------------------------|
| `cooldown-after-low-*` | smoke only | **30s** | every **2s** | 2 OK each probe | **120s** | 2 |
| `cooldown-after-medium-*` | smoke | **60s** | every **2s** | 2 | **180s** | 4 |
| `cooldown-after-medium-Pxx-*` | full | **30s** | every **2s** | 2 | **180s** | 2 |
| `cooldown-after-stress-Pxx-*` | full | **60s** | every **2s** | 2 | **180s** | 4 |

Flow inside one cool-down: **sleep `pauseMs`** → then loop until ready (or `maxWaitMs`): HTTP + chaincode probes → then the round’s `txNumber` fee-tier txs at 1 TPS.

Dual probes each poll iteration (`readyQueries: 2` consecutive successes required for each):

1. HTTP `http://127.0.0.1:7070/ak/api/v1/health` → 200  
2. `GetCampaign` (seed campaign)  
3. `SetCampaignFeeTier` (Platform / investment)  

**Option A:** `probeGovernance: false` — dual cool-down does **not** submit CreateStartup probes (those killed Microfab peers after medium). Measured op TPS unchanged vs multi.

Those cool-down txs are **not** counted toward measured CreateStartup / Pxx rates.

#### Where applied

**Smoke** — `benchconfig-dual.yaml` (**2** cool-downs):

```
low-createStartup-governance            measured  50 @ 10 TPS
  → cooldown-after-low-createStartup    pause 60s + poll (max 180s)
medium-createStartup-governance         measured 100 @ 25 TPS
  → cooldown-after-medium-createStartup pause 90s + poll (max 180s)
stress-createStartup-governance         measured 1000 @ 100 TPS
```

**Full** — `benchconfig-dual-full.yaml` (**49** cool-downs + **75** measured op rounds):

For each op **P01…P25**:

```
low-Pxx-…                      measured @ 10 TPS
medium-Pxx-…                   measured @ 25 TPS
  → cooldown-after-medium-Pxx  pause 60s + poll   (before that op’s stress)
stress-Pxx-…                   measured @ 100 TPS
  → cooldown-after-stress-Pxx  pause 90s + poll   (before next op’s low)
```

- After **every** `medium-P01`…`medium-P25` → cool-down (**25×**, 60s pause).  
- After **every** `stress-P01`…`stress-P24` → cool-down (**24×**, 90s pause).  
- **No** cool-down after `stress-P25-closeCampaign` (end of suite).  
- **No** cool-down between low→medium on full (smoke only has after-low).

Example (P01 → P02):

`low-P01` → `medium-P01` → `cooldown-after-medium-P01` (60s) → `stress-P01` → `cooldown-after-stress-P01` (90s) → `low-P02` → …

If stress still leaves peers 502, restart Microfab dual + redeploy, then `bash scripts/check-dual-peers.sh` before another run. For hard stress@100, prefer traditional Fabric.

## Run (Multi) — one command

Prereq: Microfab on **8080** + `startup` / `validator` / `investor` / `platform` chaincodes deployed on the 7 channels (see `../MICROFAB.txt`, `../MULTI_CHANNEL_E2E_TESTING.md`, `../deploy_chaincode.sh`). Export wallets to `../_wallets` with weft before the first run.

```bash
cd /root/crowdfunding/caliper-workspace

# Optional: peer health (empty ledger OK; 502/Unavailable is not)
bash scripts/check-multi-peers.sh

# Default: seed + all 25 ops × L/M/S → report-multi-full.html
bash scripts/run-multi-caliper.sh

# Smoke only (CreateStartup L/M/S + cool-downs)
bash scripts/run-multi-caliper.sh smoke

# Re-run only P10/P11/P18/P23 (bootstrap-fixed workloads) → report-multi-fix-failed.html
SKIP_SEED=1 bash scripts/run-multi-caliper.sh fix
```

**Bootstrap** (in workloads): before the measured tx, create a fresh startup → campaign → validate → share → **publish** so multi chaincode rules (e.g. proposal needs `PUBLISHED`) are satisfied. Not counted as the measured Pxx rate.

Pipeline: peer health → PEM sync (`crypto/multi`) → `seed-multi-full.sh` → Caliper → `report-multi-*.html`.

Same measured rates as single/dual: **low 50@10 / medium 100@25 / stress 1000@100**. Cool-downs use `http://127.0.0.1:8080` and CreateStartup probes; op TPS is not reduced.

Single and dual scripts/configs are unchanged — pass `arch: multi` only in multi benches.

## Workloads (`workloads/`)

| Module | Default operation |
|--------|-------------------|
| `createStartup.js` | CreateStartup (unique IDs) |
| `createCampaign.js` | CreateCampaign under `startupId` (default `STARTUP001`) |
| `registerInvestor.js` | RegisterInvestor (unique IDs) |
| `makeInvestment.js` | MakeInvestment (needs seeded campaign/investor) |
| `transferTokens.js` | PLATFORM → recipient CFT (PlatformOrg) |
| `createDispute.js` | CreateDispute (needs funded initiator) |

Pass `arch: single|dual|multi` in round `arguments` (already set in each benchconfig).

## Notes

- Default rounds stress **CreateStartup** only so unique IDs avoid duplicate locks.
- Seed network with Flow 0.0 tokens before `transferTokens` / `createDispute` rounds.
- Dual governance txs need validator + platform peers reachable (included in dual connection profiles for Startup/Validator/Platform).
- Dual cool-downs: see **Dual peer cool-downs** above — settle only; measured L/M/S TPS stay 10/25/100.
- Multi routing: `helpers.js` `OP_MAP.multi` follows the E2E guide (e.g. ShareValidation on `validator-platform-channel`, Publish on `common-channel`, TriggerFundRelease on `startup-platform-channel`).
- Only one architecture’s Microfab should own the host ports at a time (9090 / 7070 / 8080).
