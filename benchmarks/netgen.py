#!/usr/bin/env python3
"""Generate a parametrised Hyperledger Fabric 2.5 network for BlockAssist+ benchmarking.

Unlike Microfab (1 peer/org, 1 orderer, fixed), this lets every topology
parameter the reviewers asked about be varied:

  --peers N        peers per organisation (4 orgs -> 4N peers in total)
  --orderers M     Raft (etcdraft) ordering nodes
  --topology T     single | dual   (channel layout of the paper)
  --batch-timeout  orderer BatchTimeout
  --batch-size     orderer MaxMessageCount

Output: <workdir>/crypto-config.yaml, configtx.yaml, docker-compose.yaml, net.json
"""
import argparse, json, os, yaml

ORGS = ["StartupOrg", "InvestorOrg", "ValidatorOrg", "PlatformOrg"]
CHANNELS = {
    "single": {"crowdfunding-channel": ORGS},
    "dual": {
        "governance-validation-channel": ["StartupOrg", "ValidatorOrg", "PlatformOrg"],
        "investment-execution-channel": ORGS,
    },
}
FABRIC_TAG = os.environ.get("FABRIC_TAG", "2.5")


def dom(org):
    return org.lower() + ".example.com"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--peers", type=int, default=1)
    ap.add_argument("--orderers", type=int, default=1)
    ap.add_argument("--topology", choices=["single", "dual"], default="single")
    ap.add_argument("--batch-timeout", default="2s")
    ap.add_argument("--batch-size", type=int, default=500)
    ap.add_argument("--workdir", required=True)
    a = ap.parse_args()
    os.makedirs(a.workdir, exist_ok=True)

    # ---------------- crypto-config ----------------
    crypto = {
        "OrdererOrgs": [{
            "Name": "Orderer", "Domain": "example.com", "EnableNodeOUs": True,
            "Specs": [{"Hostname": f"orderer{i}"} for i in range(a.orderers)],
        }],
        "PeerOrgs": [{
            "Name": o, "Domain": dom(o), "EnableNodeOUs": True,
            "Template": {"Count": a.peers}, "Users": {"Count": 1},
        } for o in ORGS],
    }

    # ---------------- configtx ----------------
    def sig(rule):
        return {"Type": "Signature", "Rule": rule}

    ord_org = {
        "Name": "OrdererMSP", "ID": "OrdererMSP",
        "MSPDir": "crypto/ordererOrganizations/example.com/msp",
        "Policies": {
            "Readers": sig("OR('OrdererMSP.member')"),
            "Writers": sig("OR('OrdererMSP.member')"),
            "Admins": sig("OR('OrdererMSP.admin')"),
        },
        "OrdererEndpoints": [f"orderer{i}.example.com:7050" for i in range(a.orderers)],
    }
    peer_orgs = {}
    for o in ORGS:
        m = o + "MSP"
        peer_orgs[o] = {
            "Name": m, "ID": m,
            "MSPDir": f"crypto/peerOrganizations/{dom(o)}/msp",
            "Policies": {
                "Readers": sig(f"OR('{m}.admin','{m}.peer','{m}.client')"),
                "Writers": sig(f"OR('{m}.admin','{m}.client')"),
                "Admins": sig(f"OR('{m}.admin')"),
                "Endorsement": sig(f"OR('{m}.peer')"),
            },
            # anchor peer(s) so the Gateway's discovery sees every org
            "AnchorPeers": [{"Host": f"peer0.{dom(o)}", "Port": 7051}],
        }

    def imp(rule):
        return {"Type": "ImplicitMeta", "Rule": rule}

    orderer_sec = {
        "OrdererType": "etcdraft",
        "Addresses": [f"orderer{i}.example.com:7050" for i in range(a.orderers)],
        "EtcdRaft": {"Consenters": [{
            "Host": f"orderer{i}.example.com", "Port": 7050,
            "ClientTLSCert": f"crypto/ordererOrganizations/example.com/orderers/orderer{i}.example.com/tls/server.crt",
            "ServerTLSCert": f"crypto/ordererOrganizations/example.com/orderers/orderer{i}.example.com/tls/server.crt",
        } for i in range(a.orderers)]},
        "BatchTimeout": a.batch_timeout,
        "BatchSize": {"MaxMessageCount": a.batch_size, "AbsoluteMaxBytes": "99 MB",
                      "PreferredMaxBytes": "2 MB"},
        "Organizations": [ord_org],
        "Policies": {
            "Readers": imp("ANY Readers"), "Writers": imp("ANY Writers"),
            "Admins": imp("MAJORITY Admins"), "BlockValidation": imp("ANY Writers"),
        },
        "Capabilities": {"V2_0": True},
    }
    profiles = {}
    for ch, orgs in CHANNELS[a.topology].items():
        profiles[ch] = {
            "Policies": {"Readers": imp("ANY Readers"), "Writers": imp("ANY Writers"),
                         "Admins": imp("MAJORITY Admins")},
            "Capabilities": {"V2_0": True},
            "Orderer": orderer_sec,
            "Application": {
                "Organizations": [peer_orgs[o] for o in orgs],
                "Policies": {
                    "Readers": imp("ANY Readers"), "Writers": imp("ANY Writers"),
                    "Admins": imp("MAJORITY Admins"),
                    "LifecycleEndorsement": imp("MAJORITY Endorsement"),
                    "Endorsement": imp("MAJORITY Endorsement"),
                },
                "Capabilities": {"V2_5": True},
            },
        }
    configtx = {"Profiles": profiles}

    # ---------------- docker-compose ----------------
    vol = "./crypto"
    services = {}
    for i in range(a.orderers):
        h = f"orderer{i}.example.com"
        base = f"/crypto/ordererOrganizations/example.com/orderers/{h}"
        services[h] = {
            "image": f"hyperledger/fabric-orderer:{FABRIC_TAG}", "container_name": h, "hostname": h,
            "environment": [
                "FABRIC_LOGGING_SPEC=WARN",
                "ORDERER_GENERAL_LISTENADDRESS=0.0.0.0", "ORDERER_GENERAL_LISTENPORT=7050",
                "ORDERER_GENERAL_LOCALMSPID=OrdererMSP",
                f"ORDERER_GENERAL_LOCALMSPDIR={base}/msp",
                "ORDERER_GENERAL_TLS_ENABLED=true",
                f"ORDERER_GENERAL_TLS_PRIVATEKEY={base}/tls/server.key",
                f"ORDERER_GENERAL_TLS_CERTIFICATE={base}/tls/server.crt",
                f"ORDERER_GENERAL_TLS_ROOTCAS=[{base}/tls/ca.crt]",
                f"ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE={base}/tls/server.crt",
                f"ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY={base}/tls/server.key",
                f"ORDERER_GENERAL_CLUSTER_ROOTCAS=[{base}/tls/ca.crt]",
                "ORDERER_GENERAL_BOOTSTRAPMETHOD=none",
                "ORDERER_CHANNELPARTICIPATION_ENABLED=true",
                "ORDERER_ADMIN_TLS_ENABLED=true",
                f"ORDERER_ADMIN_TLS_CERTIFICATE={base}/tls/server.crt",
                f"ORDERER_ADMIN_TLS_PRIVATEKEY={base}/tls/server.key",
                f"ORDERER_ADMIN_TLS_ROOTCAS=[{base}/tls/ca.crt]",
                f"ORDERER_ADMIN_TLS_CLIENTROOTCAS=[{base}/tls/ca.crt]",
                "ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:7053",
                "ORDERER_OPERATIONS_LISTENADDRESS=0.0.0.0:9443",
                "ORDERER_METRICS_PROVIDER=prometheus",
            ],
            "volumes": [f"{vol}:/crypto:ro"],
            "networks": ["cfnet"],
        }
    peers = []
    for o in ORGS:
        for p in range(a.peers):
            h = f"peer{p}.{dom(o)}"
            short = f"peer{p}{o.lower()}"
            peers.append({"host": h, "org": o, "short": short})
            couch = f"couchdb.{short}"
            services[couch] = {
                "image": "couchdb:3.3.3", "container_name": couch, "hostname": couch,
                "environment": ["COUCHDB_USER=admin", "COUCHDB_PASSWORD=adminpw"],
                "networks": ["cfnet"],
            }
            base = f"/crypto/peerOrganizations/{dom(o)}/peers/{h}"
            services[h] = {
                "image": f"hyperledger/fabric-peer:{FABRIC_TAG}", "container_name": h, "hostname": h,
                "environment": [
                    "FABRIC_LOGGING_SPEC=WARN",
                    f"CORE_PEER_ID={h}",
                    f"CORE_PEER_ADDRESS={h}:7051", "CORE_PEER_LISTENADDRESS=0.0.0.0:7051",
                    f"CORE_PEER_CHAINCODEADDRESS={h}:7052",
                    "CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052",
                    f"CORE_PEER_GOSSIP_BOOTSTRAP=peer0.{dom(o)}:7051",
                    f"CORE_PEER_GOSSIP_EXTERNALENDPOINT={h}:7051",
                    f"CORE_PEER_LOCALMSPID={o}MSP",
                    f"CORE_PEER_MSPCONFIGPATH={base}/msp",
                    "CORE_PEER_TLS_ENABLED=true",
                    f"CORE_PEER_TLS_CERT_FILE={base}/tls/server.crt",
                    f"CORE_PEER_TLS_KEY_FILE={base}/tls/server.key",
                    f"CORE_PEER_TLS_ROOTCERT_FILE={base}/tls/ca.crt",
                    "CORE_LEDGER_STATE_STATEDATABASE=CouchDB",
                    f"CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS={couch}:5984",
                    "CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin",
                    "CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw",
                    "CORE_CHAINCODE_EXECUTETIMEOUT=120s",
                    "CORE_PEER_GATEWAY_ENDORSEMENTTIMEOUT=60s",
                    "CORE_PEER_GATEWAY_BROADCASTTIMEOUT=60s",
                    "CORE_OPERATIONS_LISTENADDRESS=0.0.0.0:9443",
                    "CORE_METRICS_PROVIDER=prometheus",
                    'CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG={"peername":"' + short + '"}',
                ],
                "volumes": [f"{vol}:/crypto:ro"],
                "depends_on": [couch],
                "networks": ["cfnet"],
            }
    compose = {"name": "cfbench", "services": services,
               "networks": {"cfnet": {"name": "cfnet"}}}

    net = {"peersPerOrg": a.peers, "orderers": a.orderers, "topology": a.topology,
           "batchTimeout": a.batch_timeout, "batchSize": a.batch_size,
           "orgs": ORGS, "channels": CHANNELS[a.topology], "peers": peers}

    for name, obj in [("crypto-config.yaml", crypto), ("configtx.yaml", configtx),
                      ("docker-compose.yaml", compose)]:
        with open(os.path.join(a.workdir, name), "w") as f:
            yaml.safe_dump(obj, f, sort_keys=False)
    with open(os.path.join(a.workdir, "net.json"), "w") as f:
        json.dump(net, f, indent=2)


if __name__ == "__main__":
    main()
