# Table 12 — v3 single-isolated-smoke-channel Caliper results

| ID | Operation | Load | Caliper Succ | Fail | Total tx | Success % | Throughput (TPS) | Avg lat (s) | Named-op committed / invoked | Named-op success % | Failure causes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | createStartup | light | 8 | 0 | 8 | 100.0 | 14.2 | 0.2 | 8 / 8 | 100.0 | — |
| P02 | createCampaign | light | 8 | 0 | 8 | 100.0 | 13.0 | 0.22 | 8 / 8 | 100.0 | — |
| P03 | submitForValidation | light | 8 | 0 | 8 | 100.0 | 12.1 | 0.25 | 8 / 8 | 100.0 | — |
| P04 | validateCampaign | light | 6 | 0 | 6 | 100.0 | 16.3 | 0.18 | 8 / 8 | 100.0 | — |
| P05 | approveOrRejectCampaign | light | 8 | 0 | 8 | 100.0 | 11.8 | 0.26 | 8 / 8 | 100.0 | — |
| P06 | shareCampaignToPlatform | light | 8 | 0 | 8 | 100.0 | 13.2 | 0.22 | 8 / 8 | 100.0 | — |
| P07 | publishCampaignToPortal | light | 8 | 0 | 8 | 100.0 | 12.2 | 0.28 | 8 / 8 | 100.0 | — |
| P08 | registerInvestor | light | 8 | 0 | 8 | 100.0 | 12.6 | 0.23 | 8 / 8 | 100.0 | — |
| P09 | viewCampaign | light | 6 | 0 | 6 | 100.0 | 16.8 | 0.18 | 8 / 8 | 100.0 | — |
| P10 | makeInvestment | light | 8 | 0 | 8 | 100.0 | 12.7 | 0.23 | 8 / 8 | 100.0 | — |
| P11 | createInvestmentProposal | light | 6 | 0 | 6 | 100.0 | 16.6 | 0.18 | 8 / 8 | 100.0 | — |
| P12 | respondToInvestmentProposal | light | 6 | 0 | 6 | 100.0 | 16.3 | 0.18 | 8 / 8 | 100.0 | — |
| P13 | initializeToken | light | 6 | 0 | 6 | 100.0 | 16.6 | 0.17 | 8 / 8 | 100.0 | — |
| P14 | mintTokens | light | 6 | 0 | 6 | 100.0 | 16.8 | 0.17 | 8 / 8 | 100.0 | — |
| P15 | transferTokens | light | 2 | 4 | 6 | 33.3 | 16.3 | 0.17 | 3 / 8 | 37.5 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×5 |
| P16 | submitMilestoneReport | light | 6 | 0 | 6 | 100.0 | 16.6 | 0.17 | 8 / 8 | 100.0 | — |
| P17 | verifyMilestoneCompletion | light | 6 | 0 | 6 | 100.0 | 16.6 | 0.17 | 8 / 8 | 100.0 | — |
| P18 | triggerFundRelease | light | 8 | 0 | 8 | 100.0 | 12.9 | 0.23 | 8 / 8 | 100.0 | CreateTokenAccount: endorsement: already exists ×2 |
| P19 | createDispute | light | 8 | 0 | 8 | 100.0 | 13.8 | 0.26 | 8 / 8 | 100.0 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×16 |
| P20 | collectCampaignFee | light | 6 | 0 | 6 | 100.0 | 16.8 | 0.16 | 8 / 8 | 100.0 | — |
| P21 | setFeeTiers | light | 6 | 0 | 6 | 100.0 | 17.7 | 0.15 | 8 / 8 | 100.0 | — |
| P22 | deleteCampaign | light | 8 | 0 | 8 | 100.0 | 12.5 | 0.3 | 8 / 8 | 100.0 | — |
| P23 | withdrawInvestment | light | 8 | 0 | 8 | 100.0 | 13.1 | 0.23 | 8 / 8 | 100.0 | — |
| P24 | requestRefund | light | 8 | 0 | 8 | 100.0 | 13.9 | 0.22 | 8 / 8 | 100.0 | — |
| P25 | closeCampaign | light | 6 | 0 | 6 | 100.0 | 15.5 | 0.2 | 8 / 8 | 100.0 | — |
