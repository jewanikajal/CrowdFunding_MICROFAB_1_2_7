# Table 12 — v3 single-channel Caliper results

| ID | Operation | Load | Caliper Succ | Fail | Total tx | Success % | Throughput (TPS) | Avg lat (s) | Named-op committed / invoked | Named-op success % | Failure causes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | createStartup | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P01 | createStartup | medium | 102 | 0 | 102 | 100.0 | 25.3 | 0.16 | 102 / 102 | 100.0 | — |
| P01 | createStartup | stress | 1002 | 0 | 1002 | 100.0 | 76.7 | 3.03 | 1002 / 1002 | 100.0 | — |
| P02 | createCampaign | light | 52 | 0 | 52 | 100.0 | 11.0 | 0.18 | 28 / 28 | 100.0 | — |
| P02 | createCampaign | medium | 108 | 0 | 108 | 100.0 | 24.7 | 0.21 | 54 / 54 | 100.0 | — |
| P02 | createCampaign | stress | 1171 | 217 | 1388 | 84.4 | 56.1 | 7.49 | 572 / 694 | 82.4 | CreateStartup: endorsement: exceeding concurrency limit ×95; CreateCampaign: endorsement: exceeding concurrency limit ×91, endorsement: startup <id> not found ×31 |
| P03 | submitForValidation | light | 54 | 0 | 54 | 100.0 | 11.4 | 0.2 | 20 / 20 | 100.0 | — |
| P03 | submitForValidation | medium | 108 | 0 | 108 | 100.0 | 24.2 | 0.22 | 36 / 36 | 100.0 | — |
| P03 | submitForValidation | stress | 1608 | 247 | 1855 | 86.7 | 49.0 | 9.39 | 517 / 529 | 97.7 | CreateStartup: endorsement: exceeding concurrency limit ×202; CreateCampaign: endorsement: exceeding concurrency limit ×33; SubmitForValidation: endorsement: exceeding concurrency limit ×12 |
| P04 | validateCampaign | light | 64 | 0 | 64 | 100.0 | 11.4 | 0.22 | 16 / 16 | 100.0 | — |
| P04 | validateCampaign | medium | 120 | 0 | 120 | 100.0 | 26.0 | 0.23 | 30 / 30 | 100.0 | — |
| P04 | validateCampaign | stress | 2110 | 270 | 2380 | 88.7 | 48.8 | 8.97 | 514 / 514 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×226; SubmitForValidation: endorsement: exceeding concurrency limit ×10; CreateCampaign: endorsement: exceeding concurrency limit ×34 |
| P05 | approveOrRejectCampaign | light | 50 | 0 | 50 | 100.0 | 15.8 | 0.21 | 12 / 12 | 100.0 | — |
| P05 | approveOrRejectCampaign | medium | 130 | 0 | 130 | 100.0 | 25.5 | 0.26 | 26 / 26 | 100.0 | — |
| P05 | approveOrRejectCampaign | stress | 2629 | 236 | 2865 | 91.8 | 41.3 | 9.93 | 516 / 516 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×196; CreateCampaign: endorsement: exceeding concurrency limit ×31; SubmitForValidation: endorsement: exceeding concurrency limit ×9 |
| P06 | shareCampaignToPlatform | light | 70 | 0 | 70 | 100.0 | 19.6 | 0.24 | 10 / 10 | 100.0 | — |
| P06 | shareCampaignToPlatform | medium | 141 | 0 | 141 | 100.0 | 28.2 | 0.34 | 20 / 20 | 100.0 | — |
| P06 | shareCampaignToPlatform | stress | 7673 | 239 | 7912 | 97.0 | 96.1 | 3.86 | 1 / 1 | 100.0 | GetCampaign: endorsement: exceeding concurrency limit ×10, endorsement: Channel has been shut down ×378; CreateStartup: endorsement: exceeding concurrency limit ×193; CreateCampaign: endorsement: exceeding concurrency limit ×30; SubmitForValidation: endorsement: exceeding concurrency limit ×6 |
| P07 | publishCampaignToPortal | light | 80 | 0 | 80 | 100.0 | 21.9 | 0.28 | 10 / 10 | 100.0 | ShareCampaignToPlatform: endorsement: Channel has been shut down ×2 |
| P07 | publishCampaignToPortal | medium | 144 | 0 | 144 | 100.0 | 28.0 | 0.26 | 18 / 18 | 100.0 | — |
| P07 | publishCampaignToPortal | stress | 7422 | 294 | 7716 | 96.2 | 99.3 | 3.86 | 0 / 0 | None | CreateStartup: endorsement: exceeding concurrency limit ×256; CreateCampaign: endorsement: exceeding concurrency limit ×28; SubmitForValidation: endorsement: exceeding concurrency limit ×6; GetCampaign: endorsement: exceeding concurrency limit ×4, endorsement: Channel has been shut down ×402 |
| P08 | registerInvestor | light | 52 | 0 | 52 | 100.0 | 10.3 | 0.21 | 52 / 52 | 100.0 | — |
| P08 | registerInvestor | medium | 102 | 0 | 102 | 100.0 | 24.5 | 0.29 | 102 / 102 | 100.0 | — |
| P08 | registerInvestor | stress | 706 | 296 | 1002 | 70.5 | 58.3 | 7.6 | 706 / 1002 | 70.5 | RegisterInvestor: endorsement: exceeding concurrency limit ×296 |
| P09 | viewCampaign | light | 79 | 10 | 89 | 88.8 | 16.9 | 0.46 | 4 / 5 | 80.0 | ValidateCampaign: endorsement: not found ×7; PublishCampaignToPortal: endorsement: not found ×2; ViewCampaign: validation code 11 (MVCC_READ_CONFLICT) ×1 |
| P09 | viewCampaign | medium | 124 | 4 | 128 | 96.9 | 32.8 | 0.24 | 12 / 12 | 100.0 | ValidateCampaign: endorsement: not found ×3; PublishCampaignToPortal: endorsement: not found ×1 |
| P09 | viewCampaign | stress | 7688 | 226 | 7914 | 97.1 | 96.9 | 3.85 | 3 / 4 | 75.0 | CreateStartup: endorsement: exceeding concurrency limit ×149; CreateCampaign: endorsement: exceeding concurrency limit ×41; SubmitForValidation: endorsement: exceeding concurrency limit ×15; GetCampaign: endorsement: exceeding concurrency limit ×20, endorsement: Channel has been shut down ×367; ViewCampaign: validation code 11 (MVCC_READ_CONFLICT) ×1 |
| P10 | makeInvestment | light | 81 | 3 | 84 | 96.4 | 15.9 | 0.26 | 8 / 8 | 100.0 | ValidateCampaign: endorsement: not found ×3; GetCampaign: endorsement: Channel has been shut down ×15 |
| P10 | makeInvestment | medium | 142 | 6 | 148 | 95.9 | 27.8 | 0.34 | 12 / 12 | 100.0 | PublishCampaignToPortal: endorsement: not found ×4; ValidateCampaign: endorsement: not found ×2 |
| P10 | makeInvestment | stress | 7319 | 253 | 7572 | 96.7 | 92.7 | 4.24 | 0 / 0 | None | CreateStartup: endorsement: exceeding concurrency limit ×170; CreateCampaign: endorsement: exceeding concurrency limit ×52; SubmitForValidation: endorsement: exceeding concurrency limit ×20; GetCampaign: endorsement: exceeding concurrency limit ×11, endorsement: Channel has been shut down ×459 |
| P11 | createInvestmentProposal | light | 90 | 0 | 90 | 100.0 | 22.5 | 0.23 | 10 / 10 | 100.0 | — |
| P11 | createInvestmentProposal | medium | 138 | 4 | 142 | 97.2 | 26.7 | 0.24 | 14 / 14 | 100.0 | ValidateCampaign: endorsement: not found ×4 |
| P11 | createInvestmentProposal | stress | 7444 | 271 | 7715 | 96.5 | 86.8 | 4.45 | 0 / 0 | None | CreateStartup: endorsement: exceeding concurrency limit ×201; CreateCampaign: endorsement: exceeding concurrency limit ×37; GetCampaign: endorsement: exceeding concurrency limit ×25, endorsement: Channel has been shut down ×244; SubmitForValidation: endorsement: exceeding concurrency limit ×8 |
| P12 | respondToInvestmentProposal | light | 98 | 2 | 100 | 98.0 | 20.6 | 0.3 | 8 / 10 | 80.0 | RespondToInvestmentProposal: endorsement: proposal not found ×2 |
| P12 | respondToInvestmentProposal | medium | 182 | 6 | 188 | 96.8 | 30.4 | 0.36 | 13 / 17 | 76.5 | PublishCampaignToPortal: endorsement: not found ×2; RespondToInvestmentProposal: endorsement: proposal not found ×4 |
| P12 | respondToInvestmentProposal | stress | 7294 | 265 | 7559 | 96.5 | 90.2 | 4.17 | 0 / 4 | 0.0 | GetCampaign: endorsement: exceeding concurrency limit ×25, endorsement: Channel has been shut down ×267; CreateStartup: endorsement: exceeding concurrency limit ×192; CreateCampaign: endorsement: exceeding concurrency limit ×31; SubmitForValidation: endorsement: exceeding concurrency limit ×13; RespondToInvestmentProposal: endorsement: proposal not found ×4 |
| P13 | initializeToken | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.15 | 52 / 52 | 100.0 | — |
| P13 | initializeToken | medium | 102 | 0 | 102 | 100.0 | 25.5 | 0.14 | 102 / 102 | 100.0 | — |
| P13 | initializeToken | stress | 1002 | 0 | 1002 | 100.0 | 97.9 | 0.27 | 1002 / 1002 | 100.0 | — |
| P14 | mintTokens | light | 54 | 0 | 54 | 100.0 | 11.5 | 0.16 | 20 / 20 | 100.0 | — |
| P14 | mintTokens | medium | 108 | 0 | 108 | 100.0 | 25.7 | 0.15 | 36 / 36 | 100.0 | — |
| P14 | mintTokens | stress | 1194 | 0 | 1194 | 100.0 | 91.1 | 0.97 | 398 / 398 | 100.0 | — |
| P15 | transferTokens | light | 38 | 14 | 52 | 73.1 | 11.0 | 0.16 | 13 / 28 | 46.4 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×15 |
| P15 | transferTokens | medium | 73 | 31 | 104 | 70.2 | 24.9 | 0.14 | 21 / 52 | 40.4 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×31 |
| P15 | transferTokens | stress | 549 | 499 | 1048 | 52.4 | 96.3 | 0.58 | 25 / 524 | 4.8 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×219, endorsement: ProposalResponsePayloads do not match ×280 |
| P16 | submitMilestoneReport | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P16 | submitMilestoneReport | medium | 102 | 0 | 102 | 100.0 | 24.8 | 0.17 | 102 / 102 | 100.0 | — |
| P16 | submitMilestoneReport | stress | 994 | 8 | 1002 | 99.2 | 76.0 | 3.49 | 994 / 1002 | 99.2 | SubmitMilestoneReport: endorsement: exceeding concurrency limit ×8 |
| P17 | verifyMilestoneCompletion | light | 64 | 0 | 64 | 100.0 | 13.5 | 0.5 | 16 / 16 | 100.0 | — |
| P17 | verifyMilestoneCompletion | medium | 120 | 0 | 120 | 100.0 | 25.6 | 0.22 | 30 / 30 | 100.0 | — |
| P17 | verifyMilestoneCompletion | stress | 2071 | 285 | 2356 | 87.9 | 58.8 | 7.57 | 513 / 513 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×269; CreateCampaign: endorsement: exceeding concurrency limit ×13; SubmitMilestoneReport: endorsement: exceeding concurrency limit ×3 |
| P18 | triggerFundRelease | light | 157 | 12 | 169 | 92.9 | 22.5 | 0.34 | 12 / 12 | 100.0 | CreateTokenAccount: endorsement: already exists ×12 |
| P18 | triggerFundRelease | medium | 224 | 18 | 242 | 92.6 | 37.4 | 0.3 | 17 / 17 | 100.0 | ValidateCampaign: endorsement: not found ×1; CreateTokenAccount: endorsement: already exists ×17 |
| P18 | triggerFundRelease | stress | 7568 | 236 | 7804 | 97.0 | 93.5 | 3.93 | 7 / 7 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×159; CreateCampaign: endorsement: exceeding concurrency limit ×25; GetCampaign: endorsement: exceeding concurrency limit ×33, endorsement: Channel has been shut down ×330; SubmitForValidation: endorsement: exceeding concurrency limit ×9; ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×1; CreateTokenAccount: endorsement: already exists ×9 |
| P19 | createDispute | light | 125 | 5 | 130 | 96.2 | 24.5 | 0.26 | 5 / 5 | 100.0 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×5 |
| P19 | createDispute | medium | 175 | 15 | 190 | 92.1 | 30.1 | 0.31 | 3 / 3 | 100.0 | ValidateCampaign: endorsement: not found ×2; PublishCampaignToPortal: endorsement: not found ×4; TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×9 |
| P19 | createDispute | stress | 7778 | 230 | 8008 | 97.1 | 100.0 | 3.7 | 3 / 3 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×150; CreateCampaign: endorsement: exceeding concurrency limit ×43; GetCampaign: endorsement: exceeding concurrency limit ×32, endorsement: Channel has been shut down ×219; SubmitForValidation: endorsement: exceeding concurrency limit ×4; TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×1 |
| P20 | collectCampaignFee | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P20 | collectCampaignFee | medium | 102 | 0 | 102 | 100.0 | 25.3 | 0.16 | 102 / 102 | 100.0 | — |
| P20 | collectCampaignFee | stress | 1002 | 0 | 1002 | 100.0 | 88.2 | 1.47 | 1002 / 1002 | 100.0 | — |
| P21 | setFeeTiers | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.15 | 54 / 54 | 100.0 | — |
| P21 | setFeeTiers | medium | 102 | 0 | 102 | 100.0 | 25.3 | 0.12 | 104 / 104 | 100.0 | — |
| P21 | setFeeTiers | stress | 1002 | 0 | 1002 | 100.0 | 99.1 | 0.13 | 1004 / 1004 | 100.0 | — |
| P22 | deleteCampaign | light | 60 | 0 | 60 | 100.0 | 11.0 | 0.41 | 20 / 20 | 100.0 | — |
| P22 | deleteCampaign | medium | 114 | 0 | 114 | 100.0 | 24.6 | 0.29 | 38 / 38 | 100.0 | — |
| P22 | deleteCampaign | stress | 1601 | 294 | 1895 | 84.5 | 39.5 | 12.41 | 516 / 530 | 97.4 | CreateStartup: endorsement: exceeding concurrency limit ×255; CreateCampaign: endorsement: exceeding concurrency limit ×25; DeleteCampaign: endorsement: exceeding concurrency limit ×14 |
| P23 | withdrawInvestment | light | 124 | 0 | 124 | 100.0 | 17.7 | 0.45 | 12 / 12 | 100.0 | — |
| P23 | withdrawInvestment | medium | 158 | 5 | 163 | 96.9 | 29.0 | 0.35 | 13 / 13 | 100.0 | PublishCampaignToPortal: endorsement: not found ×3; ValidateCampaign: endorsement: not found ×2 |
| P23 | withdrawInvestment | stress | 7791 | 241 | 8032 | 97.0 | 103.8 | 3.6 | 6 / 6 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×153; GetCampaign: endorsement: exceeding concurrency limit ×43, endorsement: Channel has been shut down ×266; CreateCampaign: endorsement: exceeding concurrency limit ×36; SubmitForValidation: endorsement: exceeding concurrency limit ×7; MakeInvestment: endorsement: not published/open for investment ×2 |
| P24 | requestRefund | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P24 | requestRefund | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.15 | 102 / 102 | 100.0 | — |
| P24 | requestRefund | stress | 1002 | 0 | 1002 | 100.0 | 80.2 | 2.34 | 1002 / 1002 | 100.0 | — |
| P25 | closeCampaign | light | 90 | 0 | 90 | 100.0 | 22.7 | 0.23 | 10 / 10 | 100.0 | — |
| P25 | closeCampaign | medium | 162 | 0 | 162 | 100.0 | 30.3 | 0.28 | 18 / 18 | 100.0 | — |
| P25 | closeCampaign | stress | 7558 | 347 | 7905 | 95.6 | 97.9 | 4.01 | 0 / 0 | None | CreateCampaign: endorsement: exceeding concurrency limit ×38; CreateStartup: endorsement: exceeding concurrency limit ×302; SubmitForValidation: endorsement: exceeding concurrency limit ×7; GetCampaign: endorsement: Channel has been shut down ×520 |
