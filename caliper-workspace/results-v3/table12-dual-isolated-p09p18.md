# Table 12 — v3 dual-isolated-p09p18-channel Caliper results

| ID | Operation | Load | Caliper Succ | Fail | Total tx | Success % | Throughput (TPS) | Avg lat (s) | Named-op committed / invoked | Named-op success % | Failure causes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P09 | viewCampaign | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P09 | viewCampaign | medium | 102 | 0 | 102 | 100.0 | 25.4 | 0.16 | 102 / 102 | 100.0 | — |
| P09 | viewCampaign | stress | 1002 | 0 | 1002 | 100.0 | 75.2 | 2.71 | 1002 / 1002 | 100.0 | — |
| P18 | triggerFundRelease | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | CreateTokenAccount: endorsement: already exists ×2 |
| P18 | triggerFundRelease | medium | 102 | 0 | 102 | 100.0 | 25.1 | 0.18 | 102 / 102 | 100.0 | CreateTokenAccount: endorsement: already exists ×2; VerifyMilestoneCompletion: validation code 11 (MVCC_READ_CONFLICT) ×9 |
| P18 | triggerFundRelease | stress | 768 | 234 | 1002 | 76.6 | 76.5 | 5.33 | 768 / 1002 | 76.6 | CreateTokenAccount: endorsement: already exists ×2; VerifyMilestoneCompletion: validation code 11 (MVCC_READ_CONFLICT) ×412; TriggerFundRelease: endorsement: exceeding concurrency limit ×234 |
