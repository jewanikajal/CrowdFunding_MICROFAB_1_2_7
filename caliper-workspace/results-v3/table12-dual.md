# Table 12 — v3 dual-channel Caliper results

| ID | Operation | Load | Caliper Succ | Fail | Total tx | Success % | Throughput (TPS) | Avg lat (s) | Named-op committed / invoked | Named-op success % | Failure causes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | createStartup | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.16 | 52 / 52 | 100.0 | — |
| P01 | createStartup | medium | 102 | 0 | 102 | 100.0 | 25.5 | 0.13 | 102 / 102 | 100.0 | — |
| P01 | createStartup | stress | 1002 | 0 | 1002 | 100.0 | 83.2 | 1.9 | 1002 / 1002 | 100.0 | — |
| P02 | createCampaign | light | 52 | 0 | 52 | 100.0 | 10.9 | 0.18 | 28 / 28 | 100.0 | — |
| P02 | createCampaign | medium | 104 | 0 | 104 | 100.0 | 24.6 | 0.2 | 52 / 52 | 100.0 | — |
| P02 | createCampaign | stress | 1172 | 220 | 1392 | 84.2 | 58.7 | 6.95 | 561 / 696 | 80.6 | CreateStartup: endorsement: exceeding concurrency limit ×85; CreateCampaign: endorsement: exceeding concurrency limit ×113, endorsement: startup <id> not found ×22 |
| P03 | submitForValidation | light | 54 | 0 | 54 | 100.0 | 11.4 | 0.23 | 20 / 20 | 100.0 | — |
| P03 | submitForValidation | medium | 108 | 0 | 108 | 100.0 | 24.3 | 0.22 | 36 / 36 | 100.0 | — |
| P03 | submitForValidation | stress | 1594 | 182 | 1776 | 89.8 | 53.8 | 8.03 | 515 / 525 | 98.1 | CreateCampaign: endorsement: exceeding concurrency limit ×29; SubmitForValidation: endorsement: exceeding concurrency limit ×10; CreateStartup: endorsement: exceeding concurrency limit ×143 |
| P04 | validateCampaign | light | 56 | 0 | 56 | 100.0 | 11.9 | 0.24 | 16 / 16 | 100.0 | — |
| P04 | validateCampaign | medium | 112 | 0 | 112 | 100.0 | 25.4 | 0.19 | 28 / 28 | 100.0 | — |
| P04 | validateCampaign | stress | 2181 | 93 | 2274 | 95.9 | 57.0 | 6.56 | 541 / 541 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×79; CreateCampaign: endorsement: exceeding concurrency limit ×11; SubmitForValidation: endorsement: exceeding concurrency limit ×3 |
| P05 | approveOrRejectCampaign | light | 50 | 0 | 50 | 100.0 | 21.5 | 0.28 | 12 / 12 | 100.0 | — |
| P05 | approveOrRejectCampaign | medium | 120 | 0 | 120 | 100.0 | 24.5 | 0.22 | 24 / 24 | 100.0 | — |
| P05 | approveOrRejectCampaign | stress | 2673 | 161 | 2834 | 94.3 | 53.4 | 7.19 | 527 / 527 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×129; SubmitForValidation: endorsement: exceeding concurrency limit ×6; CreateCampaign: endorsement: exceeding concurrency limit ×26 |
| P06 | shareCampaignToPlatform | light | 86 | 0 | 86 | 100.0 | 20.9 | 0.26 | 12 / 12 | 100.0 | — |
| P06 | shareCampaignToPlatform | medium | 112 | 0 | 112 | 100.0 | 34.5 | 0.22 | 18 / 18 | 100.0 | — |
| P06 | shareCampaignToPlatform | stress | 7880 | 185 | 8065 | 97.7 | 103.0 | 3.54 | 9 / 11 | 81.8 | GetCampaign: endorsement: exceeding concurrency limit ×32, endorsement: Channel has been shut down ×368; CreateCampaign: endorsement: exceeding concurrency limit ×28; CreateStartup: endorsement: exceeding concurrency limit ×118; SubmitForValidation: endorsement: exceeding concurrency limit ×5; ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×2 |
| P07 | publishCampaignToPortal | light | 70 | 10 | 80 | 87.5 | 22.9 | 0.25 | 0 / 11 | 0.0 | PublishCampaignToPortal: endorsement: not found ×10, endorsement: Channel has been shut down ×1 |
| P07 | publishCampaignToPortal | medium | 119 | 17 | 136 | 87.5 | 30.8 | 0.26 | 0 / 17 | 0.0 | PublishCampaignToPortal: endorsement: not found ×17; ShareCampaignToPlatform: endorsement: Channel has been shut down ×1 |
| P07 | publishCampaignToPortal | stress | 8768 | 224 | 8992 | 97.5 | 113.7 | 3.15 | 0 / 11 | 0.0 | CreateStartup: endorsement: exceeding concurrency limit ×126; SubmitForValidation: endorsement: exceeding concurrency limit ×10; GetCampaign: endorsement: exceeding concurrency limit ×32, endorsement: Channel has been shut down ×46; CreateCampaign: endorsement: exceeding concurrency limit ×44; ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×1; PublishCampaignToPortal: endorsement: not found ×11 |
| P08 | registerInvestor | light | 52 | 0 | 52 | 100.0 | 10.1 | 0.3 | 52 / 52 | 100.0 | — |
| P08 | registerInvestor | medium | 102 | 0 | 102 | 100.0 | 23.1 | 0.58 | 102 / 102 | 100.0 | — |
| P08 | registerInvestor | stress | 689 | 313 | 1002 | 68.8 | 55.5 | 8.02 | 689 / 1002 | 68.8 | RegisterInvestor: endorsement: exceeding concurrency limit ×313 |
| P09 | viewCampaign | light | 108 | 0 | 108 | 100.0 | 22.6 | 0.27 | 0 / 12 | 0.0 | ViewCampaign: endorsement: Channel has been shut down ×12 |
| P09 | viewCampaign | medium | 144 | 0 | 144 | 100.0 | 34.1 | 0.24 | 0 / 16 | 0.0 | ViewCampaign: endorsement: Channel has been shut down ×16 |
| P09 | viewCampaign | stress | 9139 | 168 | 9307 | 98.2 | 114.3 | 3.11 | 0 / 14 | 0.0 | CreateStartup: endorsement: exceeding concurrency limit ×93; SubmitForValidation: endorsement: exceeding concurrency limit ×10; CreateCampaign: endorsement: exceeding concurrency limit ×24; GetCampaign: endorsement: exceeding concurrency limit ×26, endorsement: Channel has been shut down ×281; ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×1; ViewCampaign: endorsement: not found ×14 |
| P10 | makeInvestment | light | 108 | 0 | 108 | 100.0 | 23.2 | 0.25 | 0 / 12 | 0.0 | MakeInvestment: endorsement: Channel has been shut down ×12 |
| P10 | makeInvestment | medium | 144 | 0 | 144 | 100.0 | 32.9 | 0.25 | 0 / 16 | 0.0 | MakeInvestment: endorsement: Channel has been shut down ×16 |
| P10 | makeInvestment | stress | 8235 | 209 | 8444 | 97.5 | 106.9 | 3.38 | 9 / 9 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×125; CreateCampaign: endorsement: exceeding concurrency limit ×25; SubmitForValidation: endorsement: exceeding concurrency limit ×15; ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×1; GetCampaign: endorsement: exceeding concurrency limit ×43, endorsement: Channel has been shut down ×257 |
| P11 | createInvestmentProposal | light | 90 | 0 | 90 | 100.0 | 28.5 | 0.23 | 0 / 10 | 0.0 | ShareCampaignToPlatform: endorsement: Channel has been shut down ×2; CreateInvestmentProposal: endorsement: Channel has been shut down ×10 |
| P11 | createInvestmentProposal | medium | 144 | 0 | 144 | 100.0 | 34.4 | 0.24 | 0 / 16 | 0.0 | CreateInvestmentProposal: endorsement: Channel has been shut down ×16 |
| P11 | createInvestmentProposal | stress | 8507 | 147 | 8654 | 98.3 | 100.4 | 3.51 | 10 / 10 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×94; CreateCampaign: endorsement: exceeding concurrency limit ×21; SubmitForValidation: endorsement: exceeding concurrency limit ×6; GetCampaign: endorsement: exceeding concurrency limit ×26, endorsement: Channel has been shut down ×190 |
| P12 | respondToInvestmentProposal | light | 90 | 0 | 90 | 100.0 | 22.9 | 0.22 | 0 / 0 | None | CreateInvestmentProposal: endorsement: Channel has been shut down ×10 |
| P12 | respondToInvestmentProposal | medium | 150 | 2 | 152 | 98.7 | 27.4 | 0.31 | 0 / 0 | None | ValidateCampaign: endorsement: not found ×2; CreateInvestmentProposal: endorsement: Channel has been shut down ×13 |
| P12 | respondToInvestmentProposal | stress | 7545 | 125 | 7670 | 98.4 | 90.2 | 3.85 | 11 / 12 | 91.7 | SubmitForValidation: endorsement: exceeding concurrency limit ×11; CreateCampaign: endorsement: exceeding concurrency limit ×14; CreateStartup: endorsement: exceeding concurrency limit ×75; GetCampaign: endorsement: exceeding concurrency limit ×24, endorsement: Channel has been shut down ×360; RespondToInvestmentProposal: endorsement: proposal not found ×1 |
| P13 | initializeToken | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P13 | initializeToken | medium | 102 | 0 | 102 | 100.0 | 25.2 | 0.17 | 102 / 102 | 100.0 | — |
| P13 | initializeToken | stress | 1002 | 0 | 1002 | 100.0 | 77.7 | 1.7 | 1002 / 1002 | 100.0 | — |
| P14 | mintTokens | light | 54 | 0 | 54 | 100.0 | 11.6 | 0.18 | 20 / 20 | 100.0 | — |
| P14 | mintTokens | medium | 108 | 0 | 108 | 100.0 | 25.3 | 0.16 | 36 / 36 | 100.0 | — |
| P14 | mintTokens | stress | 1773 | 0 | 1773 | 100.0 | 73.9 | 4.35 | 591 / 591 | 100.0 | — |
| P15 | transferTokens | light | 38 | 14 | 52 | 73.1 | 11.0 | 0.2 | 13 / 28 | 46.4 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×15 |
| P15 | transferTokens | medium | 76 | 32 | 108 | 70.4 | 25.6 | 0.15 | 22 / 54 | 40.7 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×32 |
| P15 | transferTokens | stress | 536 | 488 | 1024 | 52.3 | 98.2 | 0.55 | 24 / 512 | 4.7 | TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×228, endorsement: ProposalResponsePayloads do not match ×260 |
| P16 | submitMilestoneReport | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P16 | submitMilestoneReport | medium | 102 | 0 | 102 | 100.0 | 25.5 | 0.16 | 102 / 102 | 100.0 | — |
| P16 | submitMilestoneReport | stress | 1002 | 0 | 1002 | 100.0 | 80.1 | 1.71 | 1002 / 1002 | 100.0 | — |
| P17 | verifyMilestoneCompletion | light | 56 | 0 | 56 | 100.0 | 12.0 | 0.19 | 16 / 16 | 100.0 | — |
| P17 | verifyMilestoneCompletion | medium | 120 | 0 | 120 | 100.0 | 25.8 | 0.21 | 30 / 30 | 100.0 | — |
| P17 | verifyMilestoneCompletion | stress | 2161 | 182 | 2343 | 92.2 | 60.5 | 6.83 | 529 / 529 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×149; CreateCampaign: endorsement: exceeding concurrency limit ×21; SubmitMilestoneReport: endorsement: exceeding concurrency limit ×12 |
| P18 | triggerFundRelease | light | 108 | 0 | 108 | 100.0 | 25.4 | 0.22 | 0 / 0 | None | CreateTokenAccount: endorsement: Channel has been shut down ×24; WitnessAgreement: endorsement: Channel has been shut down ×12 |
| P18 | triggerFundRelease | medium | 142 | 2 | 144 | 98.6 | 37.2 | 0.25 | 0 / 0 | None | PublishCampaignToPortal: endorsement: not found ×2; CreateTokenAccount: endorsement: Channel has been shut down ×28; WitnessAgreement: endorsement: Channel has been shut down ×14 |
| P18 | triggerFundRelease | stress | 7974 | 235 | 8209 | 97.1 | 96.0 | 3.76 | 0 / 1 | 0.0 | CreateStartup: endorsement: exceeding concurrency limit ×154; CreateCampaign: endorsement: exceeding concurrency limit ×49; GetCampaign: endorsement: exceeding concurrency limit ×30, endorsement: Channel has been shut down ×141; CreateTokenAccount: endorsement: already exists ×1; TriggerFundRelease: endorsement: EndorseError: 10 ABORTED: failed to endorse transaction, see attached details fo ×1 |
| P19 | createDispute | light | 108 | 0 | 108 | 100.0 | 22.8 | 0.25 | 0 / 0 | None | RegisterInvestor: endorsement: Channel has been shut down ×12 |
| P19 | createDispute | medium | 210 | 4 | 214 | 98.1 | 18.7 | 0.33 | 6 / 6 | 100.0 | PublishCampaignToPortal: endorsement: not found ×1; CreateTokenAccount: endorsement: Channel has been shut down ×2; TransferTokens: endorsement: Channel has been shut down ×1, validation code 11 (MVCC_READ_CONFLICT) ×3; RegisterInvestor: endorsement: Channel has been shut down ×4 |
| P19 | createDispute | stress | 8771 | 151 | 8922 | 98.3 | 100.4 | 3.4 | 5 / 5 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×86; CreateCampaign: endorsement: exceeding concurrency limit ×25; SubmitForValidation: endorsement: exceeding concurrency limit ×7; GetCampaign: endorsement: exceeding concurrency limit ×27, endorsement: Channel has been shut down ×149; ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×2; TransferTokens: validation code 11 (MVCC_READ_CONFLICT) ×4 |
| P20 | collectCampaignFee | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.17 | 52 / 52 | 100.0 | — |
| P20 | collectCampaignFee | medium | 102 | 0 | 102 | 100.0 | 24.7 | 0.17 | 102 / 102 | 100.0 | — |
| P20 | collectCampaignFee | stress | 1002 | 0 | 1002 | 100.0 | 77.3 | 2.91 | 1002 / 1002 | 100.0 | — |
| P21 | setFeeTiers | light | 52 | 0 | 52 | 100.0 | 10.6 | 0.16 | 54 / 54 | 100.0 | — |
| P21 | setFeeTiers | medium | 102 | 0 | 102 | 100.0 | 25.4 | 0.12 | 104 / 104 | 100.0 | — |
| P21 | setFeeTiers | stress | 1002 | 0 | 1002 | 100.0 | 96.0 | 0.39 | 1004 / 1004 | 100.0 | — |
| P22 | deleteCampaign | light | 60 | 0 | 60 | 100.0 | 11.1 | 0.22 | 20 / 20 | 100.0 | — |
| P22 | deleteCampaign | medium | 114 | 0 | 114 | 100.0 | 23.8 | 0.28 | 38 / 38 | 100.0 | — |
| P22 | deleteCampaign | stress | 1581 | 252 | 1833 | 86.3 | 42.4 | 10.85 | 514 / 522 | 98.5 | CreateStartup: endorsement: exceeding concurrency limit ×221; DeleteCampaign: endorsement: exceeding concurrency limit ×8; CreateCampaign: endorsement: exceeding concurrency limit ×23 |
| P23 | withdrawInvestment | light | 108 | 0 | 108 | 100.0 | 22.6 | 0.26 | 0 / 0 | None | MakeInvestment: endorsement: Channel has been shut down ×12 |
| P23 | withdrawInvestment | medium | 157 | 5 | 162 | 96.9 | 26.8 | 0.3 | 2 / 3 | 66.7 | PublishCampaignToPortal: endorsement: not found ×5; MakeInvestment: endorsement: Channel has been shut down ×6; WithdrawInvestment: endorsement: Channel has been shut down ×1 |
| P23 | withdrawInvestment | stress | 8113 | 220 | 8333 | 97.4 | 97.1 | 3.74 | 7 / 7 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×148; CreateCampaign: endorsement: exceeding concurrency limit ×37; SubmitForValidation: endorsement: exceeding concurrency limit ×12; GetCampaign: endorsement: exceeding concurrency limit ×22, endorsement: Channel has been shut down ×232; ShareCampaignToPlatform: endorsement: exceeding concurrency limit ×1 |
| P24 | requestRefund | light | 50 | 0 | 50 | 100.0 | 10.5 | 0.18 | 52 / 52 | 100.0 | — |
| P24 | requestRefund | medium | 102 | 0 | 102 | 100.0 | 24.5 | 0.17 | 102 / 102 | 100.0 | — |
| P24 | requestRefund | stress | 966 | 36 | 1002 | 96.4 | 70.7 | 3.8 | 966 / 1002 | 96.4 | RequestRefund: endorsement: exceeding concurrency limit ×36 |
| P25 | closeCampaign | light | 108 | 0 | 108 | 100.0 | 23.5 | 0.25 | 0 / 12 | 0.0 | CloseCampaign: endorsement: Channel has been shut down ×12 |
| P25 | closeCampaign | medium | 156 | 2 | 158 | 98.7 | 25.7 | 0.38 | 3 / 16 | 18.8 | ValidateCampaign: endorsement: not found ×1; PublishCampaignToPortal: endorsement: not found ×1; CloseCampaign: endorsement: Channel has been shut down ×13 |
| P25 | closeCampaign | stress | 8107 | 266 | 8373 | 96.8 | 92.9 | 3.85 | 4 / 4 | 100.0 | CreateStartup: endorsement: exceeding concurrency limit ×225; GetCampaign: endorsement: exceeding concurrency limit ×15, endorsement: Channel has been shut down ×8; CreateCampaign: endorsement: exceeding concurrency limit ×11; SubmitForValidation: endorsement: exceeding concurrency limit ×15 |
