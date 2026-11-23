# Table 12 — v3 dual-isolated-channel Caliper results

| ID | Operation | Load | Caliper Succ | Fail | Total tx | Success % | Throughput (TPS) | Avg lat (s) | Named-op committed / invoked | Named-op success % | Failure causes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | createStartup | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P01 | createStartup | medium | 102 | 0 | 102 | 100.0 | 25.1 | 0.15 | 102 / 102 | 100.0 | — |
| P01 | createStartup | stress | 1002 | 0 | 1002 | 100.0 | 83.5 | 2.01 | 1002 / 1002 | 100.0 | — |
| P02 | createCampaign | light | 50 | 0 | 50 | 100.0 | 10.4 | 0.2 | 52 / 52 | 100.0 | — |
| P02 | createCampaign | medium | 102 | 0 | 102 | 100.0 | 23.9 | 0.28 | 102 / 102 | 100.0 | — |
| P02 | createCampaign | stress | 718 | 284 | 1002 | 71.7 | 63.7 | 6.83 | 718 / 1002 | 71.7 | CreateCampaign: endorsement: exceeding concurrency limit ×284 |
| P03 | submitForValidation | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.2 | 52 / 52 | 100.0 | — |
| P03 | submitForValidation | medium | 102 | 0 | 102 | 100.0 | 24.9 | 0.21 | 102 / 102 | 100.0 | — |
| P03 | submitForValidation | stress | 642 | 360 | 1002 | 64.1 | 62.7 | 7.85 | 642 / 1002 | 64.1 | SubmitForValidation: endorsement: exceeding concurrency limit ×360 |
| P04 | validateCampaign | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.18 | 52 / 52 | 100.0 | — |
| P04 | validateCampaign | medium | 102 | 0 | 102 | 100.0 | 24.6 | 0.18 | 102 / 102 | 100.0 | — |
| P04 | validateCampaign | stress | 793 | 209 | 1002 | 79.1 | 76.2 | 5.11 | 793 / 1002 | 79.1 | SubmitForValidation: endorsement: EndorseError: 10 ABORTED: failed to endorse transaction, see attached details fo ×2; ValidateCampaign: endorsement: exceeding concurrency limit ×209 |
| P05 | approveOrRejectCampaign | light | 50 | 0 | 50 | 100.0 | 10.4 | 0.26 | 52 / 52 | 100.0 | — |
| P05 | approveOrRejectCampaign | medium | 102 | 0 | 102 | 100.0 | 23.9 | 0.23 | 102 / 102 | 100.0 | — |
| P05 | approveOrRejectCampaign | stress | 755 | 247 | 1002 | 75.3 | 66.1 | 6.03 | 755 / 1002 | 75.3 | ApproveOrRejectCampaign: endorsement: exceeding concurrency limit ×247 |
| P06 | shareCampaignToPlatform | light | 52 | 0 | 52 | 100.0 | 10.2 | 0.24 | 52 / 52 | 100.0 | — |
| P06 | shareCampaignToPlatform | medium | 102 | 0 | 102 | 100.0 | 24.8 | 0.19 | 102 / 102 | 100.0 | — |
| P06 | shareCampaignToPlatform | stress | 884 | 118 | 1002 | 88.2 | 65.3 | 4.91 | 884 / 1002 | 88.2 | ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×118 |
| P07 | publishCampaignToPortal | light | 52 | 0 | 52 | 100.0 | 10.1 | 0.38 | 52 / 52 | 100.0 | — |
| P07 | publishCampaignToPortal | medium | 102 | 0 | 102 | 100.0 | 24.1 | 0.37 | 102 / 102 | 100.0 | — |
| P07 | publishCampaignToPortal | stress | 586 | 416 | 1002 | 58.5 | 47.1 | 9.86 | 586 / 1002 | 58.5 | PublishCampaignToPortal: endorsement: exceeding concurrency limit ×416 |
| P08 | registerInvestor | light | 52 | 0 | 52 | 100.0 | 10.3 | 0.26 | 52 / 52 | 100.0 | — |
| P08 | registerInvestor | medium | 102 | 0 | 102 | 100.0 | 23.8 | 0.39 | 102 / 102 | 100.0 | — |
| P08 | registerInvestor | stress | 745 | 257 | 1002 | 74.4 | 47.0 | 8.98 | 745 / 1002 | 74.4 | RegisterInvestor: endorsement: exceeding concurrency limit ×257 |
| P09 | viewCampaign | light | 0 | 50 | 50 | 0.0 | 10.8 | 0.0 | 0 / 52 | 0.0 | ViewCampaign: endorsement: not found ×52 |
| P09 | viewCampaign | medium | 0 | 100 | 100 | 0.0 | 26.0 | 0.0 | 0 / 102 | 0.0 | ViewCampaign: endorsement: not found ×102 |
| P09 | viewCampaign | stress | 0 | 1000 | 1000 | 0.0 | 100.3 | 0.0 | 0 / 1002 | 0.0 | ViewCampaign: endorsement: not found ×1002 |
| P10 | makeInvestment | light | 52 | 0 | 52 | 100.0 | 10.2 | 0.26 | 52 / 52 | 100.0 | — |
| P10 | makeInvestment | medium | 102 | 0 | 102 | 100.0 | 24.2 | 0.26 | 102 / 102 | 100.0 | — |
| P10 | makeInvestment | stress | 650 | 352 | 1002 | 64.9 | 62.6 | 7.74 | 650 / 1002 | 64.9 | MakeInvestment: endorsement: exceeding concurrency limit ×352 |
| P11 | createInvestmentProposal | light | 52 | 0 | 52 | 100.0 | 10.5 | 0.19 | 52 / 52 | 100.0 | — |
| P11 | createInvestmentProposal | medium | 102 | 0 | 102 | 100.0 | 24.7 | 0.19 | 102 / 102 | 100.0 | — |
| P11 | createInvestmentProposal | stress | 852 | 150 | 1002 | 85.0 | 65.3 | 5.34 | 852 / 1002 | 85.0 | CreateInvestmentProposal: endorsement: exceeding concurrency limit ×150 |
| P12 | respondToInvestmentProposal | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P12 | respondToInvestmentProposal | medium | 102 | 0 | 102 | 100.0 | 24.9 | 0.18 | 102 / 102 | 100.0 | — |
| P12 | respondToInvestmentProposal | stress | 806 | 196 | 1002 | 80.4 | 78.0 | 4.93 | 806 / 1002 | 80.4 | RespondToInvestmentProposal: endorsement: exceeding concurrency limit ×196 |
| P13 | initializeToken | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P13 | initializeToken | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.17 | 102 / 102 | 100.0 | — |
| P13 | initializeToken | stress | 1002 | 0 | 1002 | 100.0 | 86.5 | 1.47 | 1002 / 1002 | 100.0 | — |
| P14 | mintTokens | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P14 | mintTokens | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.17 | 102 / 102 | 100.0 | — |
| P14 | mintTokens | stress | 785 | 217 | 1002 | 78.3 | 76.2 | 4.99 | 785 / 1002 | 78.3 | MintTokens: endorsement: exceeding concurrency limit ×217 |
| P15 | transferTokens | light | 24 | 26 | 50 | 48.0 | 10.5 | 0.18 | 25 / 52 | 48.1 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×27 |
| P15 | transferTokens | medium | 24 | 78 | 102 | 23.5 | 25.0 | 0.18 | 24 / 102 | 23.5 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×74, endorsement: ProposalResponsePayloads do not match ×4 |
| P15 | transferTokens | stress | 27 | 975 | 1002 | 2.7 | 96.5 | 0.46 | 27 / 1002 | 2.7 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×583, endorsement: ProposalResponsePayloads do not match ×392 |
| P16 | submitMilestoneReport | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P16 | submitMilestoneReport | medium | 102 | 0 | 102 | 100.0 | 25.4 | 0.16 | 102 / 102 | 100.0 | — |
| P16 | submitMilestoneReport | stress | 1002 | 0 | 1002 | 100.0 | 84.0 | 1.81 | 1002 / 1002 | 100.0 | — |
| P17 | verifyMilestoneCompletion | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P17 | verifyMilestoneCompletion | medium | 102 | 0 | 102 | 100.0 | 25.0 | 0.34 | 102 / 102 | 100.0 | — |
| P17 | verifyMilestoneCompletion | stress | 797 | 205 | 1002 | 79.5 | 62.4 | 6.02 | 797 / 1002 | 79.5 | VerifyMilestoneCompletion: endorsement: exceeding concurrency limit ×205 |
| P18 | triggerFundRelease | light | 0 | 50 | 50 | 0.0 | 10.8 | 0.0 | 0 / 52 | 0.0 | CreateTokenAccount: endorsement: already exists ×2; TriggerFundRelease: endorsement: EndorseError: 10 ABORTED: failed to endorse transaction, see attached details fo ×52 |
| P18 | triggerFundRelease | medium | 0 | 100 | 100 | 0.0 | 25.9 | 0.0 | 0 / 102 | 0.0 | CreateTokenAccount: endorsement: already exists ×2; TriggerFundRelease: endorsement: EndorseError: 10 ABORTED: failed to endorse transaction, see attached details fo ×102 |
| P18 | triggerFundRelease | stress | 0 | 1000 | 1000 | 0.0 | 100.3 | 0.0 | 0 / 1002 | 0.0 | CreateTokenAccount: endorsement: already exists ×2; VerifyMilestoneCompletion: validation code 11 (MVCC_READ_CONFLICT) ×490; TriggerFundRelease: endorsement: EndorseError: 10 ABORTED: failed to endorse transaction, see attached details fo ×1002 |
| P19 | createDispute | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.18 | 52 / 52 | 100.0 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×352, endorsement: ProposalResponsePayloads do not match ×37 |
| P19 | createDispute | medium | 102 | 0 | 102 | 100.0 | 24.8 | 0.21 | 102 / 102 | 100.0 | TransferTokens: endorsement: ProposalResponsePayloads do not match ×168, validation code 11 (MVCC_READ_CONFLICT) ×694 |
| P19 | createDispute | stress | 792 | 210 | 1002 | 79.0 | 71.3 | 5.11 | 792 / 1002 | 79.0 | TransferTokens: endorsement: ProposalResponsePayloads do not match ×1706, validation code 11 (MVCC_READ_CONFLICT) ×7067; CreateDispute: endorsement: exceeding concurrency limit ×210 |
| P20 | collectCampaignFee | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.21 | 52 / 52 | 100.0 | — |
| P20 | collectCampaignFee | medium | 102 | 0 | 102 | 100.0 | 25.4 | 0.17 | 102 / 102 | 100.0 | — |
| P20 | collectCampaignFee | stress | 1002 | 0 | 1002 | 100.0 | 67.6 | 3.94 | 1002 / 1002 | 100.0 | — |
| P21 | setFeeTiers | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.15 | 52 / 52 | 100.0 | — |
| P21 | setFeeTiers | medium | 102 | 0 | 102 | 100.0 | 25.5 | 0.14 | 102 / 102 | 100.0 | — |
| P21 | setFeeTiers | stress | 1002 | 0 | 1002 | 100.0 | 96.2 | 0.41 | 1002 / 1002 | 100.0 | — |
| P22 | deleteCampaign | light | 52 | 0 | 52 | 100.0 | 10.3 | 0.28 | 52 / 52 | 100.0 | — |
| P22 | deleteCampaign | medium | 102 | 0 | 102 | 100.0 | 23.9 | 0.33 | 102 / 102 | 100.0 | — |
| P22 | deleteCampaign | stress | 574 | 428 | 1002 | 57.3 | 57.2 | 9.88 | 574 / 1002 | 57.3 | DeleteCampaign: endorsement: exceeding concurrency limit ×428 |
| P23 | withdrawInvestment | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.21 | 52 / 52 | 100.0 | — |
| P23 | withdrawInvestment | medium | 102 | 0 | 102 | 100.0 | 24.0 | 0.29 | 102 / 102 | 100.0 | — |
| P23 | withdrawInvestment | stress | 711 | 291 | 1002 | 71.0 | 59.0 | 7.34 | 711 / 1002 | 71.0 | WithdrawInvestment: endorsement: exceeding concurrency limit ×291 |
| P24 | requestRefund | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P24 | requestRefund | medium | 102 | 0 | 102 | 100.0 | 24.8 | 0.17 | 102 / 102 | 100.0 | — |
| P24 | requestRefund | stress | 1002 | 0 | 1002 | 100.0 | 70.6 | 3.2 | 1002 / 1002 | 100.0 | — |
| P25 | closeCampaign | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.19 | 52 / 52 | 100.0 | — |
| P25 | closeCampaign | medium | 102 | 0 | 102 | 100.0 | 24.9 | 0.21 | 102 / 102 | 100.0 | PublishCampaignToPortal: endorsement: not found ×10 |
| P25 | closeCampaign | stress | 710 | 292 | 1002 | 70.9 | 57.3 | 7.68 | 710 / 1002 | 70.9 | PublishCampaignToPortal: endorsement: not found ×10; ValidateCampaign: endorsement: not found ×17; CloseCampaign: endorsement: exceeding concurrency limit ×292 |
