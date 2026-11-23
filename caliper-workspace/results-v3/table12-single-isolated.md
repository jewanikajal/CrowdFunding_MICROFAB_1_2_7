# Table 12 — v3 single-isolated-channel Caliper results

| ID | Operation | Load | Caliper Succ | Fail | Total tx | Success % | Throughput (TPS) | Avg lat (s) | Named-op committed / invoked | Named-op success % | Failure causes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | createStartup | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P01 | createStartup | medium | 102 | 0 | 102 | 100.0 | 24.8 | 0.17 | 102 / 102 | 100.0 | — |
| P01 | createStartup | stress | 990 | 12 | 1002 | 98.8 | 70.4 | 3.48 | 990 / 1002 | 98.8 | CreateStartup: endorsement: exceeding concurrency limit ×12 |
| P02 | createCampaign | light | 52 | 0 | 52 | 100.0 | 10.3 | 0.25 | 52 / 52 | 100.0 | — |
| P02 | createCampaign | medium | 102 | 0 | 102 | 100.0 | 24.0 | 0.3 | 102 / 102 | 100.0 | — |
| P02 | createCampaign | stress | 666 | 336 | 1002 | 66.5 | 53.2 | 8.85 | 666 / 1002 | 66.5 | CreateCampaign: endorsement: exceeding concurrency limit ×336 |
| P03 | submitForValidation | light | 52 | 0 | 52 | 100.0 | 10.2 | 0.27 | 52 / 52 | 100.0 | — |
| P03 | submitForValidation | medium | 102 | 0 | 102 | 100.0 | 24.7 | 0.36 | 102 / 102 | 100.0 | — |
| P03 | submitForValidation | stress | 591 | 411 | 1002 | 59.0 | 53.6 | 9.76 | 591 / 1002 | 59.0 | SubmitForValidation: endorsement: exceeding concurrency limit ×411 |
| P04 | validateCampaign | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.19 | 52 / 52 | 100.0 | — |
| P04 | validateCampaign | medium | 102 | 0 | 102 | 100.0 | 25.1 | 0.2 | 102 / 102 | 100.0 | — |
| P04 | validateCampaign | stress | 684 | 318 | 1002 | 68.3 | 73.1 | 6.11 | 684 / 1002 | 68.3 | ValidateCampaign: endorsement: exceeding concurrency limit ×318 |
| P05 | approveOrRejectCampaign | light | 52 | 0 | 52 | 100.0 | 10.3 | 0.28 | 52 / 52 | 100.0 | — |
| P05 | approveOrRejectCampaign | medium | 102 | 0 | 102 | 100.0 | 23.8 | 0.34 | 102 / 102 | 100.0 | — |
| P05 | approveOrRejectCampaign | stress | 625 | 377 | 1002 | 62.4 | 52.7 | 9.44 | 625 / 1002 | 62.4 | SubmitForValidation: endorsement: EndorseError: 10 ABORTED: failed to endorse transaction, see attached details fo ×1; ApproveOrRejectCampaign: endorsement: exceeding concurrency limit ×377 |
| P06 | shareCampaignToPlatform | light | 52 | 0 | 52 | 100.0 | 10.4 | 0.21 | 52 / 52 | 100.0 | — |
| P06 | shareCampaignToPlatform | medium | 102 | 0 | 102 | 100.0 | 23.4 | 0.29 | 102 / 102 | 100.0 | — |
| P06 | shareCampaignToPlatform | stress | 756 | 246 | 1002 | 75.4 | 56.9 | 7.23 | 756 / 1002 | 75.4 | ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×246 |
| P07 | publishCampaignToPortal | light | 50 | 0 | 50 | 100.0 | 10.4 | 0.28 | 52 / 52 | 100.0 | — |
| P07 | publishCampaignToPortal | medium | 102 | 0 | 102 | 100.0 | 22.0 | 0.83 | 102 / 102 | 100.0 | — |
| P07 | publishCampaignToPortal | stress | 554 | 448 | 1002 | 55.3 | 43.2 | 13.49 | 554 / 1002 | 55.3 | PublishCampaignToPortal: endorsement: exceeding concurrency limit ×448 |
| P08 | registerInvestor | light | 52 | 0 | 52 | 100.0 | 10.4 | 0.25 | 52 / 52 | 100.0 | — |
| P08 | registerInvestor | medium | 102 | 0 | 102 | 100.0 | 24.8 | 0.3 | 102 / 102 | 100.0 | — |
| P08 | registerInvestor | stress | 734 | 268 | 1002 | 73.3 | 49.4 | 8.91 | 734 / 1002 | 73.3 | RegisterInvestor: endorsement: exceeding concurrency limit ×268 |
| P09 | viewCampaign | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P09 | viewCampaign | medium | 102 | 0 | 102 | 100.0 | 25.0 | 0.28 | 102 / 102 | 100.0 | — |
| P09 | viewCampaign | stress | 965 | 37 | 1002 | 96.3 | 71.0 | 3.99 | 965 / 1002 | 96.3 | ViewCampaign: endorsement: exceeding concurrency limit ×37 |
| P10 | makeInvestment | light | 52 | 0 | 52 | 100.0 | 10.4 | 0.25 | 52 / 52 | 100.0 | — |
| P10 | makeInvestment | medium | 102 | 0 | 102 | 100.0 | 24.3 | 0.28 | 102 / 102 | 100.0 | — |
| P10 | makeInvestment | stress | 642 | 360 | 1002 | 64.1 | 63.4 | 7.93 | 642 / 1002 | 64.1 | MakeInvestment: endorsement: exceeding concurrency limit ×360 |
| P11 | createInvestmentProposal | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.2 | 52 / 52 | 100.0 | — |
| P11 | createInvestmentProposal | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.22 | 102 / 102 | 100.0 | — |
| P11 | createInvestmentProposal | stress | 747 | 255 | 1002 | 74.6 | 68.0 | 6.19 | 747 / 1002 | 74.6 | CreateInvestmentProposal: endorsement: exceeding concurrency limit ×255 |
| P12 | respondToInvestmentProposal | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.18 | 52 / 52 | 100.0 | — |
| P12 | respondToInvestmentProposal | medium | 102 | 0 | 102 | 100.0 | 24.5 | 0.21 | 102 / 102 | 100.0 | — |
| P12 | respondToInvestmentProposal | stress | 848 | 154 | 1002 | 84.6 | 66.2 | 5.65 | 848 / 1002 | 84.6 | RespondToInvestmentProposal: endorsement: exceeding concurrency limit ×154 |
| P13 | initializeToken | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P13 | initializeToken | medium | 102 | 0 | 102 | 100.0 | 24.9 | 0.17 | 102 / 102 | 100.0 | — |
| P13 | initializeToken | stress | 1002 | 0 | 1002 | 100.0 | 82.2 | 1.81 | 1002 / 1002 | 100.0 | — |
| P14 | mintTokens | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.18 | 52 / 52 | 100.0 | — |
| P14 | mintTokens | medium | 102 | 0 | 102 | 100.0 | 25.4 | 0.17 | 102 / 102 | 100.0 | — |
| P14 | mintTokens | stress | 850 | 152 | 1002 | 84.8 | 68.4 | 5.21 | 850 / 1002 | 84.8 | MintTokens: endorsement: exceeding concurrency limit ×152 |
| P15 | transferTokens | light | 24 | 26 | 50 | 48.0 | 10.5 | 0.17 | 25 / 52 | 48.1 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×27 |
| P15 | transferTokens | medium | 25 | 77 | 102 | 24.5 | 24.8 | 0.18 | 25 / 102 | 24.5 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×71, endorsement: ProposalResponsePayloads do not match ×6 |
| P15 | transferTokens | stress | 27 | 975 | 1002 | 2.7 | 95.9 | 0.47 | 27 / 1002 | 2.7 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×548, endorsement: ProposalResponsePayloads do not match ×427 |
| P16 | submitMilestoneReport | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P16 | submitMilestoneReport | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.19 | 102 / 102 | 100.0 | — |
| P16 | submitMilestoneReport | stress | 909 | 93 | 1002 | 90.7 | 58.9 | 5.82 | 909 / 1002 | 90.7 | SubmitMilestoneReport: endorsement: exceeding concurrency limit ×93 |
| P17 | verifyMilestoneCompletion | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P17 | verifyMilestoneCompletion | medium | 102 | 0 | 102 | 100.0 | 24.7 | 0.19 | 102 / 102 | 100.0 | — |
| P17 | verifyMilestoneCompletion | stress | 887 | 115 | 1002 | 88.5 | 69.0 | 4.69 | 887 / 1002 | 88.5 | VerifyMilestoneCompletion: endorsement: exceeding concurrency limit ×115 |
| P18 | triggerFundRelease | light | 50 | 0 | 50 | 100.0 | 10.4 | 0.22 | 52 / 52 | 100.0 | CreateTokenAccount: endorsement: already exists ×2 |
| P18 | triggerFundRelease | medium | 102 | 0 | 102 | 100.0 | 24.0 | 0.28 | 102 / 102 | 100.0 | CreateTokenAccount: endorsement: already exists ×2 |
| P18 | triggerFundRelease | stress | 729 | 273 | 1002 | 72.8 | 55.2 | 8.0 | 729 / 1002 | 72.8 | CreateTokenAccount: endorsement: already exists ×2; TriggerFundRelease: endorsement: exceeding concurrency limit ×273 |
| P19 | createDispute | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.19 | 52 / 52 | 100.0 | TransferTokens: endorsement: ProposalResponsePayloads do not match ×84, validation code 11 (MVCC_READ_CONFLICT) ×351 |
| P19 | createDispute | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.17 | 102 / 102 | 100.0 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×716, endorsement: ProposalResponsePayloads do not match ×133 |
| P19 | createDispute | stress | 839 | 163 | 1002 | 83.7 | 72.6 | 4.92 | 839 / 1002 | 83.7 | TransferTokens: endorsement: ProposalResponsePayloads do not match ×1539, validation code 11 (MVCC_READ_CONFLICT) ×6983; CreateDispute: endorsement: exceeding concurrency limit ×163 |
| P20 | collectCampaignFee | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P20 | collectCampaignFee | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.17 | 102 / 102 | 100.0 | — |
| P20 | collectCampaignFee | stress | 1002 | 0 | 1002 | 100.0 | 78.0 | 2.48 | 1002 / 1002 | 100.0 | — |
| P21 | setFeeTiers | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.15 | 52 / 52 | 100.0 | — |
| P21 | setFeeTiers | medium | 102 | 0 | 102 | 100.0 | 24.8 | 0.14 | 102 / 102 | 100.0 | — |
| P21 | setFeeTiers | stress | 1002 | 0 | 1002 | 100.0 | 99.0 | 0.2 | 1002 / 1002 | 100.0 | — |
| P22 | deleteCampaign | light | 52 | 0 | 52 | 100.0 | 10.3 | 0.29 | 52 / 52 | 100.0 | — |
| P22 | deleteCampaign | medium | 102 | 0 | 102 | 100.0 | 23.0 | 0.72 | 102 / 102 | 100.0 | — |
| P22 | deleteCampaign | stress | 546 | 456 | 1002 | 54.5 | 44.1 | 14.57 | 546 / 1002 | 54.5 | DeleteCampaign: endorsement: exceeding concurrency limit ×456 |
| P23 | withdrawInvestment | light | 52 | 0 | 52 | 100.0 | 10.3 | 0.29 | 52 / 52 | 100.0 | — |
| P23 | withdrawInvestment | medium | 102 | 0 | 102 | 100.0 | 24.3 | 0.29 | 102 / 102 | 100.0 | — |
| P23 | withdrawInvestment | stress | 701 | 301 | 1002 | 70.0 | 56.6 | 8.01 | 701 / 1002 | 70.0 | WithdrawInvestment: endorsement: exceeding concurrency limit ×301 |
| P24 | requestRefund | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P24 | requestRefund | medium | 102 | 0 | 102 | 100.0 | 24.6 | 0.17 | 102 / 102 | 100.0 | — |
| P24 | requestRefund | stress | 971 | 31 | 1002 | 96.9 | 69.4 | 4.09 | 971 / 1002 | 96.9 | RequestRefund: endorsement: exceeding concurrency limit ×31 |
| P25 | closeCampaign | light | 52 | 0 | 52 | 100.0 | 10.4 | 0.2 | 52 / 52 | 100.0 | PublishCampaignToPortal: endorsement: not found ×2 |
| P25 | closeCampaign | medium | 102 | 0 | 102 | 100.0 | 24.6 | 0.22 | 102 / 102 | 100.0 | ValidateCampaign: endorsement: not found ×1; PublishCampaignToPortal: endorsement: not found ×2 |
| P25 | closeCampaign | stress | 777 | 225 | 1002 | 77.5 | 62.0 | 6.6 | 777 / 1002 | 77.5 | PublishCampaignToPortal: endorsement: not found ×1; CloseCampaign: endorsement: exceeding concurrency limit ×225 |
