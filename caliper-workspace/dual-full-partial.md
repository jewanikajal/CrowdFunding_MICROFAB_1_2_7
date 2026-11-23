# Dual full Caliper — partial run 2026-10-17 (~08:03–08:08 CEST)

Terminal: 2 (`bash scripts/run-dual-caliper.sh`, mode full)
Aborted: Ctrl+C during `cooldown-after-medium-P01-createStartup`
HTML report: **none** (`report-dual-full.html` / `report.html` not created)

## Pipeline
- Peer health: OK (4/4)
- PEM sync: mismatch → re-export → MATCH
- Seed dual full: OK through PROPOSAL001

## Completed rounds (from live terminal before buffer scrolled)
| Round | Succ | Fail | Send TPS | Avg Lat (s) | Throughput TPS |
|-------|------|------|----------|-------------|----------------|
| low-P01-createStartup | 50 | 0 | ~10 | (not captured) | (observer: 50/50) |
| medium-P01-createStartup | 102 | 0 | 26.0 | 0.16 | 25.4 |

## Failure point
- Round: `cooldown-after-medium-P01-createStartup`
- Errors: `EndorseError: 14 UNAVAILABLE` / `GatewayError: 14 UNAVAILABLE` on CreateStartup probes + GetCampaign
- Peers dead under cool-down thrash after medium@25 (same Microfab dual pattern)

## Excel note
Dual Microfab: CreateStartup holds low@10 and medium@25 once; cool-down after medium already kills peers. Full suite not completed. Retest dual stress on traditional Fabric.

## Option A cool-down harden (applied after this partial)
Measured TPS unchanged (low@10 / medium@25 / stress@1000@100). Dual `peerCooldown` only:
- `probeGovernance: false` — no CreateStartup thrash during cool-down prepare
- medium cool-down `pauseMs` 30s → 60s; stress cool-down 60s → 90s
- Still probes HTTP health, GetCampaign, SetCampaignFeeTier

**Bug (fixed 2026-10-18):** `peerCooldown.js` ignored `probeGovernance: false` on dual/multi
(`|| arch === 'dual'` always forced CreateStartup probes). Explicit `false` now wins.
After fix: Ctrl+C the stuck run → restart dual Microfab (validator peer :2022 was dead) →
redeploy/seed → `bash scripts/run-dual-caliper.sh`.

Retest: stop multi Microfab if running, start dual (:7070), deploy, `bash scripts/run-dual-caliper.sh`. If stress@100 still kills peers, use traditional Fabric.
