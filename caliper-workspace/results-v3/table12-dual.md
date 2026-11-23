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
