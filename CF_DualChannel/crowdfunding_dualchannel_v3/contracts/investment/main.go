package main

import (
	"fmt"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Combined INVESTMENT chaincode for investment-execution-channel.
// Orgs: StartupOrg, ValidatorOrg, InvestorOrg, PlatformOrg.
func main() {
	// Hardened: roleGuard runs before every transaction (security.go)
	dataBridgeContract := &DataBridgeContract{}
	dataBridgeContract.BeforeTransaction = roleGuard
	startupContract := &StartupContract{}
	startupContract.BeforeTransaction = roleGuard
	investorContract := &InvestorContract{}
	investorContract.BeforeTransaction = roleGuard
	validatorContract := &ValidatorContract{}
	validatorContract.BeforeTransaction = roleGuard
	platformContract := &PlatformContract{}
	platformContract.BeforeTransaction = roleGuard
	tokenContract := &TokenContract{}
	tokenContract.BeforeTransaction = roleGuard
	cc, err := contractapi.NewChaincode(dataBridgeContract, startupContract, investorContract, validatorContract, platformContract, tokenContract)
	if err != nil {
		log.Panicf("Error creating investment chaincode: %v", err)
	}

	cc.Info.Title = "Dual-Channel Investment Chaincode"
	cc.Info.Version = "1.0.0"

	if err := cc.Start(); err != nil {
		log.Panicf("Error starting investment chaincode: %v", err)
	}
	fmt.Println("Investment chaincode started successfully")
}
