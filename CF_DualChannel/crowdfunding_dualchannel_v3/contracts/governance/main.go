package main

import (
	"fmt"
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Combined GOVERNANCE chaincode for governance-validation-channel.
// Orgs: StartupOrg, ValidatorOrg, PlatformOrg (Investor excluded).
func main() {
	// Hardened: roleGuard runs before every transaction (security.go)
	dataBridgeContract := &DataBridgeContract{}
	dataBridgeContract.BeforeTransaction = roleGuard
	startupContract := &StartupContract{}
	startupContract.BeforeTransaction = roleGuard
	validatorContract := &ValidatorContract{}
	validatorContract.BeforeTransaction = roleGuard
	platformContract := &PlatformContract{}
	platformContract.BeforeTransaction = roleGuard
	cc, err := contractapi.NewChaincode(dataBridgeContract, startupContract, validatorContract, platformContract)
	if err != nil {
		log.Panicf("Error creating governance chaincode: %v", err)
	}

	cc.Info.Title = "Dual-Channel Governance Chaincode"
	cc.Info.Version = "1.0.0"

	if err := cc.Start(); err != nil {
		log.Panicf("Error starting governance chaincode: %v", err)
	}
	fmt.Println("Governance chaincode started successfully")
}
