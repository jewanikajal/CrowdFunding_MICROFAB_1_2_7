package main

import "fmt"

// SEBI accredited-investor eligibility for individuals (SEBI (AIF) Regulations, 2012, as amended in
// 2021: Regulation 2(1)(ab)). An individual qualifies on ANY one of:
//
//	(i)   annual income >= INR 2 crore;
//	(ii)  net worth >= INR 7.5 crore, of which >= INR 3.75 crore is in financial assets;
//	(iii) annual income >= INR 1 crore AND net worth >= INR 5 crore, of which >= INR 2.5 crore is in
//	      financial assets.
//
// Route (iii) can be switched off with SEBIAllowHybridRoute = false.
const (
	SEBIIncomeOnly              = 20000000.0 // (i)   2 crore
	SEBINetWorth                = 75000000.0 // (ii)  7.5 crore
	SEBINetWorthFinancialAssets = 37500000.0 // (ii)  3.75 crore
	SEBIHybridIncome            = 10000000.0 // (iii) 1 crore
	SEBIHybridNetWorth          = 50000000.0 // (iii) 5 crore
	SEBIHybridFinancialAssets   = 25000000.0 // (iii) 2.5 crore
	SEBIAllowHybridRoute        = true
)

// sebiEligibility returns the route under which the investor qualifies, or an error.
func sebiEligibility(annualIncome, netWorth, financialAssets float64) (string, error) {
	if annualIncome < 0 || netWorth < 0 || financialAssets < 0 {
		return "", fmt.Errorf("income, net worth and financial assets must be non-negative")
	}
	if financialAssets > netWorth && netWorth > 0 {
		return "", fmt.Errorf("financial assets (%.2f) cannot exceed net worth (%.2f)", financialAssets, netWorth)
	}
	if annualIncome >= SEBIIncomeOnly {
		return "INCOME", nil
	}
	if netWorth >= SEBINetWorth && financialAssets >= SEBINetWorthFinancialAssets {
		return "NET_WORTH", nil
	}
	if SEBIAllowHybridRoute && annualIncome >= SEBIHybridIncome && netWorth >= SEBIHybridNetWorth && financialAssets >= SEBIHybridFinancialAssets {
		return "INCOME_AND_NET_WORTH", nil
	}
	return "", fmt.Errorf("investor does not meet SEBI accredited-investor criteria: needs annual income >= 2 crore, " +
		"or net worth >= 7.5 crore with >= 3.75 crore in financial assets, " +
		"or annual income >= 1 crore with net worth >= 5 crore and >= 2.5 crore in financial assets")
}
