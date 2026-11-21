package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// DataBridgeContract: state reads for cross-channel queries plus the v3 outbox/relay endpoints.
type DataBridgeContract struct {
	contractapi.Contract
}

// StoreData existed in v2 as a public transaction that let ANY channel member overwrite ANY
// record (an unauthenticated write backdoor). v3 removes it: writes only happen through the
// owning contract functions or the verified ApplySync path.
func (d *DataBridgeContract) StoreData(ctx contractapi.TransactionContextInterface, collection string, key string, value string) error {
	return fmt.Errorf("StoreData is disabled in v3; cross-channel writes use the verified outbox/ApplySync path")
}

func (d *DataBridgeContract) ReadData(ctx contractapi.TransactionContextInterface, collection string, key string) (string, error) {
	val, err := ctx.GetStub().GetState(collection + "_" + key)
	if err != nil {
		return "", fmt.Errorf("DataBridge ReadData failed: %v", err)
	}
	if val == nil {
		return "", fmt.Errorf("key not found: %s_%s", collection, key)
	}
	return string(val), nil
}

// ListOutbox returns the outbox keys written by one source transaction (used by the relay).
func (d *DataBridgeContract) ListOutbox(ctx contractapi.TransactionContextInterface, txID string) ([]string, error) {
	it, err := ctx.GetStub().GetStateByRange("OUTBOX_"+txID+"_", "OUTBOX_"+txID+"_~")
	if err != nil {
		return nil, err
	}
	defer it.Close()
	keys := []string{}
	for it.HasNext() {
		kv, err := it.Next()
		if err != nil {
			return nil, err
		}
		keys = append(keys, kv.Key)
	}
	return keys, nil
}

// ReadOutbox returns one committed outbox entry (queried cross-channel by ApplySync endorsers).
func (d *DataBridgeContract) ReadOutbox(ctx contractapi.TransactionContextInterface, key string) (string, error) {
	v, err := ctx.GetStub().GetState(key)
	if err != nil || v == nil {
		return "", fmt.Errorf("outbox entry %s not found", key)
	}
	return string(v), nil
}

// ApplySync applies one outbox entry from sourceChannel to this channel. Endorsers fetch the
// entry themselves from the source ledger, so the caller (relay) cannot inject data.
func (d *DataBridgeContract) ApplySync(ctx contractapi.TransactionContextInterface, sourceChannel string, key string) (string, error) {
	stub := ctx.GetStub()
	if sourceChannel == stub.GetChannelID() {
		return "", fmt.Errorf("source channel must differ from target channel")
	}
	marker := "SYNCED_" + key
	if done, _ := stub.GetState(marker); done != nil {
		return "ALREADY_APPLIED", nil // idempotent: duplicate relays / replays are harmless
	}
	resp := stub.InvokeChaincode(chaincodeForChannel(sourceChannel),
		[][]byte{[]byte("DataBridgeContract:ReadOutbox"), []byte(key)}, sourceChannel)
	if resp.Status != 200 {
		return "", fmt.Errorf("cannot verify outbox entry on %s: %s", sourceChannel, resp.Message)
	}
	var raw string
	if err := json.Unmarshal(resp.Payload, &raw); err != nil {
		raw = string(resp.Payload)
	}
	var e OutboxEntry
	if err := json.Unmarshal([]byte(raw), &e); err != nil {
		return "", fmt.Errorf("bad outbox entry: %v", err)
	}
	sum := sha256.Sum256([]byte(e.Value))
	if hex.EncodeToString(sum[:]) != e.SHA256 || e.TargetChannel != stub.GetChannelID() || e.SourceChannel != sourceChannel {
		return "", fmt.Errorf("outbox entry failed integrity/target check")
	}
	if err := stub.PutState(e.Collection+"_"+e.Key, []byte(e.Value)); err != nil {
		return "", err
	}
	if err := stub.PutState(marker, []byte(e.SourceTxID)); err != nil {
		return "", err
	}
	return "APPLIED", nil
}
