package main

// v3 cross-channel layer: verifiable outbox + relay (replaces v2's cross-channel InvokeChaincode writes).
//
// Why: Fabric only permits READ-ONLY chaincode-to-chaincode calls across channels.
// Any PutState performed by a chaincode invoked on another channel is NOT committed
// on that channel, so v2's CrossChannelPut silently lost every cross-channel write.
//
// v3 protocol (asynchronous, eventually consistent, exactly-once):
//   1. Source tx: CrossChannelPut to a collection homed on the OTHER channel writes
//      OUTBOX_<txID>_<collection>_<key> = {collection,key,value,sha256} to the SOURCE
//      ledger and emits chaincode event "CrossChannelSync" (payload = txID).
//      The outbox entry exists in committed state only if the source tx is VALID.
//   2. Relay (any party; see benchmarks/bridge/relay.js) listens for the event and calls
//      DataBridgeContract:ApplySync(sourceChannel, outboxKey) on the TARGET channel,
//      selecting endorsing peers that are joined to both channels.
//   3. ApplySync endorsers read the outbox entry from their own copy of the SOURCE
//      ledger (read-only cross-channel query, which Fabric allows), check the hash,
//      write the value under its normal key on the target and record SYNCED_<outboxKey>.
//      The relay never supplies the data, so it cannot forge or alter it; a replay is a no-op.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

const (
	GovernanceChannel    = "governance-validation-channel"
	InvestmentChannel    = "investment-execution-channel"
	GovernanceChaincode  = "governance"
	InvestmentChaincode  = "investment"
	CurrentChaincodeName = "investment"
	SyncEventName        = "CrossChannelSync"
)

type OutboxEntry struct {
	SourceChannel string `json:"sourceChannel"`
	SourceTxID    string `json:"sourceTxId"`
	TargetChannel string `json:"targetChannel"`
	Collection    string `json:"collection"`
	Key           string `json:"key"`
	Value         string `json:"value"`
	SHA256        string `json:"sha256"`
}

func getChannelForCollection(collection string) string {
	switch collection {
	case StartupPrivateCollection, ValidatorPrivateCollection,
		StartupValidatorCollection, StartupPlatformCollection, ValidatorPlatformCollection:
		return GovernanceChannel
	default:
		return InvestmentChannel
	}
}

func chaincodeForChannel(ch string) string {
	if ch == GovernanceChannel {
		return GovernanceChaincode
	}
	return InvestmentChaincode
}

func outboxKey(txID, collection, key string) string {
	return "OUTBOX_" + txID + "_" + collection + "_" + key
}

func CrossChannelPut(ctx contractapi.TransactionContextInterface, collection string, key string, value []byte) error {
	stub := ctx.GetStub()
	target := getChannelForCollection(collection)
	if target == stub.GetChannelID() {
		// Hardening (P3): collection-homed data is stored in the real Private Data Collection
		return stub.PutPrivateData(collection, key, value)
	}
	// Privacy (PR11): the outbox is PUBLIC on the source channel. Governance-homed collections are
	// private to Startup/Validator/Platform; writing them from the investment channel would expose
	// them to InvestorOrg through the investment-channel outbox, so this direction is refused.
	if stub.GetChannelID() == InvestmentChannel && target == GovernanceChannel {
		return fmt.Errorf("refused: writing %s from the investment channel would expose it to InvestorOrg via the public outbox; invoke the governance chaincode instead", collection)
	}
	sum := sha256.Sum256(value)
	e := OutboxEntry{SourceChannel: stub.GetChannelID(), SourceTxID: stub.GetTxID(), TargetChannel: target,
		Collection: collection, Key: key, Value: string(value), SHA256: hex.EncodeToString(sum[:])}
	b, err := json.Marshal(e)
	if err != nil {
		return err
	}
	if err := stub.PutState(outboxKey(stub.GetTxID(), collection, key), b); err != nil {
		return fmt.Errorf("outbox write failed: %v", err)
	}
	// one event per tx is kept by Fabric; payload is the txID, the relay lists all entries of that tx
	return stub.SetEvent(SyncEventName, []byte(stub.GetTxID()))
}

// CrossChannelGet: local read for collections homed on this channel; otherwise a read-only
// cross-channel query (requires the endorsing peer to be joined to both channels).
func CrossChannelGet(ctx contractapi.TransactionContextInterface, collection string, key string) ([]byte, error) {
	stub := ctx.GetStub()
	target := getChannelForCollection(collection)
	if target == stub.GetChannelID() {
		return stub.GetPrivateData(collection, key) // Hardening (P3)
	}
	resp := stub.InvokeChaincode(chaincodeForChannel(target),
		[][]byte{[]byte("DataBridgeContract:ReadData"), []byte(collection), []byte(key)}, target)
	if resp.Status != 200 {
		return nil, fmt.Errorf("cross-channel read %s/%s failed (endorsing peer must be joined to both channels): %s",
			target, collection, resp.Message)
	}
	var unquoted string
	if err := json.Unmarshal(resp.Payload, &unquoted); err == nil {
		return []byte(unquoted), nil
	}
	return resp.Payload, nil
}
