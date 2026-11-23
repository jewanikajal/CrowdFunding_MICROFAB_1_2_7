# Table 12 (corrected design) — v3, named operation only

Prerequisites created in initializeWorkloadModule (not counted). P09/P18 dual from the rerun on the fixed v3 chaincode.

| ID | Operation | Load | Single: committed/total | Single % | Single TPS | Single lat (s) | Dual: committed/total | Dual % | Dual TPS | Dual lat (s) | Main failure cause |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | createStartup | light | 50/50 | 100.0 | 10.5 | 0.17 | 50/50 | 100.0 | 10.5 | 0.16 | S: —; D: — |
| P01 | createStartup | medium | 102/102 | 100.0 | 24.8 | 0.17 | 102/102 | 100.0 | 25.1 | 0.15 | S: —; D: — |
| P01 | createStartup | stress | 990/1002 | 98.8 | 70.4 | 3.48 | 1002/1002 | 100.0 | 83.5 | 2.01 | S: endorsement: exceeding concurrency limit ×12; D: — |
| P02 | createCampaign | light | 52/52 | 100.0 | 10.3 | 0.25 | 50/50 | 100.0 | 10.4 | 0.2 | S: —; D: — |
| P02 | createCampaign | medium | 102/102 | 100.0 | 24.0 | 0.3 | 102/102 | 100.0 | 23.9 | 0.28 | S: —; D: — |
| P02 | createCampaign | stress | 666/1002 | 66.5 | 53.2 | 8.85 | 718/1002 | 71.7 | 63.7 | 6.83 | S: endorsement: exceeding concurrency limit ×336; D: endorsement: exceeding concurrency limit ×284 |
| P03 | submitForValidation | light | 52/52 | 100.0 | 10.2 | 0.27 | 50/50 | 100.0 | 10.5 | 0.2 | S: —; D: — |
| P03 | submitForValidation | medium | 102/102 | 100.0 | 24.7 | 0.36 | 102/102 | 100.0 | 24.9 | 0.21 | S: —; D: — |
| P03 | submitForValidation | stress | 591/1002 | 59.0 | 53.6 | 9.76 | 642/1002 | 64.1 | 62.7 | 7.85 | S: endorsement: exceeding concurrency limit ×411; D: endorsement: exceeding concurrency limit ×360 |
| P04 | validateCampaign | light | 50/50 | 100.0 | 10.5 | 0.19 | 50/50 | 100.0 | 10.5 | 0.18 | S: —; D: — |
| P04 | validateCampaign | medium | 102/102 | 100.0 | 25.1 | 0.2 | 102/102 | 100.0 | 24.6 | 0.18 | S: —; D: — |
| P04 | validateCampaign | stress | 684/1002 | 68.3 | 73.1 | 6.11 | 793/1002 | 79.1 | 76.2 | 5.11 | S: endorsement: exceeding concurrency limit ×318; D: endorsement: exceeding concurrency limit ×209 |
| P05 | approveOrRejectCampaign | light | 52/52 | 100.0 | 10.3 | 0.28 | 50/50 | 100.0 | 10.4 | 0.26 | S: —; D: — |
| P05 | approveOrRejectCampaign | medium | 102/102 | 100.0 | 23.8 | 0.34 | 102/102 | 100.0 | 23.9 | 0.23 | S: —; D: — |
| P05 | approveOrRejectCampaign | stress | 625/1002 | 62.4 | 52.7 | 9.44 | 755/1002 | 75.3 | 66.1 | 6.03 | S: endorsement: exceeding concurrency limit ×377; D: endorsement: exceeding concurrency limit ×247 |
| P06 | shareCampaignToPlatform | light | 52/52 | 100.0 | 10.4 | 0.21 | 52/52 | 100.0 | 10.2 | 0.24 | S: —; D: — |
| P06 | shareCampaignToPlatform | medium | 102/102 | 100.0 | 23.4 | 0.29 | 102/102 | 100.0 | 24.8 | 0.19 | S: —; D: — |
| P06 | shareCampaignToPlatform | stress | 756/1002 | 75.4 | 56.9 | 7.23 | 884/1002 | 88.2 | 65.3 | 4.91 | S: endorsement: exceeding concurrency limit ×246; D: endorsement: exceeding concurrency limit ×118 |
| P07 | publishCampaignToPortal | light | 50/50 | 100.0 | 10.4 | 0.28 | 52/52 | 100.0 | 10.1 | 0.38 | S: —; D: — |
| P07 | publishCampaignToPortal | medium | 102/102 | 100.0 | 22.0 | 0.83 | 102/102 | 100.0 | 24.1 | 0.37 | S: —; D: — |
| P07 | publishCampaignToPortal | stress | 554/1002 | 55.3 | 43.2 | 13.49 | 586/1002 | 58.5 | 47.1 | 9.86 | S: endorsement: exceeding concurrency limit ×448; D: endorsement: exceeding concurrency limit ×416 |
| P08 | registerInvestor | light | 52/52 | 100.0 | 10.4 | 0.25 | 52/52 | 100.0 | 10.3 | 0.26 | S: —; D: — |
| P08 | registerInvestor | medium | 102/102 | 100.0 | 24.8 | 0.3 | 102/102 | 100.0 | 23.8 | 0.39 | S: —; D: — |
| P08 | registerInvestor | stress | 734/1002 | 73.3 | 49.4 | 8.91 | 745/1002 | 74.4 | 47.0 | 8.98 | S: endorsement: exceeding concurrency limit ×268; D: endorsement: exceeding concurrency limit ×257 |
| P09 | viewCampaign | light | 50/50 | 100.0 | 10.5 | 0.17 | 50/50 | 100.0 | 10.5 | 0.16 | S: —; D: — |
| P09 | viewCampaign | medium | 102/102 | 100.0 | 25.0 | 0.28 | 102/102 | 100.0 | 25.4 | 0.16 | S: —; D: — |
| P09 | viewCampaign | stress | 965/1002 | 96.3 | 71.0 | 3.99 | 1002/1002 | 100.0 | 75.2 | 2.71 | S: endorsement: exceeding concurrency limit ×37; D: — |
| P10 | makeInvestment | light | 52/52 | 100.0 | 10.4 | 0.25 | 52/52 | 100.0 | 10.2 | 0.26 | S: —; D: — |
| P10 | makeInvestment | medium | 102/102 | 100.0 | 24.3 | 0.28 | 102/102 | 100.0 | 24.2 | 0.26 | S: —; D: — |
| P10 | makeInvestment | stress | 642/1002 | 64.1 | 63.4 | 7.93 | 650/1002 | 64.9 | 62.6 | 7.74 | S: endorsement: exceeding concurrency limit ×360; D: endorsement: exceeding concurrency limit ×352 |
| P11 | createInvestmentProposal | light | 50/50 | 100.0 | 10.5 | 0.2 | 52/52 | 100.0 | 10.5 | 0.19 | S: —; D: — |
| P11 | createInvestmentProposal | medium | 102/102 | 100.0 | 25.2 | 0.22 | 102/102 | 100.0 | 24.7 | 0.19 | S: —; D: — |
| P11 | createInvestmentProposal | stress | 747/1002 | 74.6 | 68.0 | 6.19 | 852/1002 | 85.0 | 65.3 | 5.34 | S: endorsement: exceeding concurrency limit ×255; D: endorsement: exceeding concurrency limit ×150 |
| P12 | respondToInvestmentProposal | light | 50/50 | 100.0 | 10.5 | 0.18 | 50/50 | 100.0 | 10.5 | 0.17 | S: —; D: — |
| P12 | respondToInvestmentProposal | medium | 102/102 | 100.0 | 24.5 | 0.21 | 102/102 | 100.0 | 24.9 | 0.18 | S: —; D: — |
| P12 | respondToInvestmentProposal | stress | 848/1002 | 84.6 | 66.2 | 5.65 | 806/1002 | 80.4 | 78.0 | 4.93 | S: endorsement: exceeding concurrency limit ×154; D: endorsement: exceeding concurrency limit ×196 |
| P13 | initializeToken | light | 50/50 | 100.0 | 10.5 | 0.16 | 50/50 | 100.0 | 10.5 | 0.16 | S: —; D: — |
| P13 | initializeToken | medium | 102/102 | 100.0 | 24.9 | 0.17 | 102/102 | 100.0 | 25.2 | 0.17 | S: —; D: — |
| P13 | initializeToken | stress | 1002/1002 | 100.0 | 82.2 | 1.81 | 1002/1002 | 100.0 | 86.5 | 1.47 | S: —; D: — |
| P14 | mintTokens | light | 50/50 | 100.0 | 10.5 | 0.18 | 50/50 | 100.0 | 10.5 | 0.17 | S: —; D: — |
| P14 | mintTokens | medium | 102/102 | 100.0 | 25.4 | 0.17 | 102/102 | 100.0 | 25.2 | 0.17 | S: —; D: — |
| P14 | mintTokens | stress | 850/1002 | 84.8 | 68.4 | 5.21 | 785/1002 | 78.3 | 76.2 | 4.99 | S: endorsement: exceeding concurrency limit ×152; D: endorsement: exceeding concurrency limit ×217 |
| P15 | transferTokens | light | 24/50 | 48.0 | 10.5 | 0.17 | 24/50 | 48.0 | 10.5 | 0.18 | S: validation code 11 (MVCC_READ_CONFLICT) ×27; D: validation code 11 (MVCC_READ_CONFLICT) ×27 |
| P15 | transferTokens | medium | 25/102 | 24.5 | 24.8 | 0.18 | 24/102 | 23.5 | 25.0 | 0.18 | S: validation code 11 (MVCC_READ_CONFLICT) ×71, endorsement: ProposalResponsePayloads do not match ×6; D: validation code 11 (MVCC_READ_CONFLICT) ×74, endorsement: ProposalResponsePayloads do not match ×4 |
| P15 | transferTokens | stress | 27/1002 | 2.7 | 95.9 | 0.47 | 27/1002 | 2.7 | 96.5 | 0.46 | S: validation code 11 (MVCC_READ_CONFLICT) ×548, endorsement: ProposalResponsePayloads do not match ×427; D: validation code 11 (MVCC_READ_CONFLICT) ×583, endorsement: ProposalResponsePayloads do not match ×392 |
| P16 | submitMilestoneReport | light | 50/50 | 100.0 | 10.5 | 0.17 | 50/50 | 100.0 | 10.5 | 0.16 | S: —; D: — |
| P16 | submitMilestoneReport | medium | 102/102 | 100.0 | 25.2 | 0.19 | 102/102 | 100.0 | 25.4 | 0.16 | S: —; D: — |
| P16 | submitMilestoneReport | stress | 909/1002 | 90.7 | 58.9 | 5.82 | 1002/1002 | 100.0 | 84.0 | 1.81 | S: endorsement: exceeding concurrency limit ×93; D: — |
| P17 | verifyMilestoneCompletion | light | 50/50 | 100.0 | 10.5 | 0.17 | 50/50 | 100.0 | 10.5 | 0.17 | S: —; D: — |
| P17 | verifyMilestoneCompletion | medium | 102/102 | 100.0 | 24.7 | 0.19 | 102/102 | 100.0 | 25.0 | 0.34 | S: —; D: — |
| P17 | verifyMilestoneCompletion | stress | 887/1002 | 88.5 | 69.0 | 4.69 | 797/1002 | 79.5 | 62.4 | 6.02 | S: endorsement: exceeding concurrency limit ×115; D: endorsement: exceeding concurrency limit ×205 |
| P18 | triggerFundRelease | light | 50/50 | 100.0 | 10.4 | 0.22 | 50/50 | 100.0 | 10.5 | 0.17 | S: —; D: — |
| P18 | triggerFundRelease | medium | 102/102 | 100.0 | 24.0 | 0.28 | 102/102 | 100.0 | 25.1 | 0.18 | S: —; D: — |
| P18 | triggerFundRelease | stress | 729/1002 | 72.8 | 55.2 | 8.0 | 768/1002 | 76.6 | 76.5 | 5.33 | S: endorsement: exceeding concurrency limit ×273; D: endorsement: exceeding concurrency limit ×234 |
| P19 | createDispute | light | 50/50 | 100.0 | 10.5 | 0.19 | 50/50 | 100.0 | 10.5 | 0.18 | S: —; D: — |
| P19 | createDispute | medium | 102/102 | 100.0 | 25.2 | 0.17 | 102/102 | 100.0 | 24.8 | 0.21 | S: —; D: — |
| P19 | createDispute | stress | 839/1002 | 83.7 | 72.6 | 4.92 | 792/1002 | 79.0 | 71.3 | 5.11 | S: endorsement: exceeding concurrency limit ×163; D: endorsement: exceeding concurrency limit ×210 |
| P20 | collectCampaignFee | light | 50/50 | 100.0 | 10.5 | 0.16 | 50/50 | 100.0 | 10.5 | 0.21 | S: —; D: — |
| P20 | collectCampaignFee | medium | 102/102 | 100.0 | 25.2 | 0.17 | 102/102 | 100.0 | 25.4 | 0.17 | S: —; D: — |
| P20 | collectCampaignFee | stress | 1002/1002 | 100.0 | 78.0 | 2.48 | 1002/1002 | 100.0 | 67.6 | 3.94 | S: —; D: — |
| P21 | setFeeTiers | light | 50/50 | 100.0 | 10.5 | 0.15 | 50/50 | 100.0 | 10.5 | 0.15 | S: —; D: — |
| P21 | setFeeTiers | medium | 102/102 | 100.0 | 24.8 | 0.14 | 102/102 | 100.0 | 25.5 | 0.14 | S: —; D: — |
| P21 | setFeeTiers | stress | 1002/1002 | 100.0 | 99.0 | 0.2 | 1002/1002 | 100.0 | 96.2 | 0.41 | S: —; D: — |
| P22 | deleteCampaign | light | 52/52 | 100.0 | 10.3 | 0.29 | 52/52 | 100.0 | 10.3 | 0.28 | S: —; D: — |
| P22 | deleteCampaign | medium | 102/102 | 100.0 | 23.0 | 0.72 | 102/102 | 100.0 | 23.9 | 0.33 | S: —; D: — |
| P22 | deleteCampaign | stress | 546/1002 | 54.5 | 44.1 | 14.57 | 574/1002 | 57.3 | 57.2 | 9.88 | S: endorsement: exceeding concurrency limit ×456; D: endorsement: exceeding concurrency limit ×428 |
| P23 | withdrawInvestment | light | 52/52 | 100.0 | 10.3 | 0.29 | 50/50 | 100.0 | 10.5 | 0.21 | S: —; D: — |
| P23 | withdrawInvestment | medium | 102/102 | 100.0 | 24.3 | 0.29 | 102/102 | 100.0 | 24.0 | 0.29 | S: —; D: — |
| P23 | withdrawInvestment | stress | 701/1002 | 70.0 | 56.6 | 8.01 | 711/1002 | 71.0 | 59.0 | 7.34 | S: endorsement: exceeding concurrency limit ×301; D: endorsement: exceeding concurrency limit ×291 |
| P24 | requestRefund | light | 50/50 | 100.0 | 10.5 | 0.17 | 50/50 | 100.0 | 10.5 | 0.17 | S: —; D: — |
| P24 | requestRefund | medium | 102/102 | 100.0 | 24.6 | 0.17 | 102/102 | 100.0 | 24.8 | 0.17 | S: —; D: — |
| P24 | requestRefund | stress | 971/1002 | 96.9 | 69.4 | 4.09 | 1002/1002 | 100.0 | 70.6 | 3.2 | S: endorsement: exceeding concurrency limit ×31; D: — |
| P25 | closeCampaign | light | 52/52 | 100.0 | 10.4 | 0.2 | 50/50 | 100.0 | 10.5 | 0.19 | S: —; D: — |
| P25 | closeCampaign | medium | 102/102 | 100.0 | 24.6 | 0.22 | 102/102 | 100.0 | 24.9 | 0.21 | S: —; D: — |
| P25 | closeCampaign | stress | 777/1002 | 77.5 | 62.0 | 6.6 | 710/1002 | 70.9 | 57.3 | 7.68 | S: endorsement: exceeding concurrency limit ×225; D: endorsement: exceeding concurrency limit ×292 |
