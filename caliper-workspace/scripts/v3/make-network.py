#!/usr/bin/env python3
"""Generate Caliper network config + connection profiles for the v3 networks built by
benchmarks/network.sh (TLS, one peer per org, peers reachable on the docker network `cfnet`).

  make-network.py <single|dual> <cryptoRoot>   (cryptoRoot = benchmarks/work/net/crypto)
Writes network-v3-<arch>.yaml, networks/v3/*.json and copies User1 credentials to crypto/v3/<Org>/.
"""
import json, os, shutil, sys, glob, yaml
arch, croot = sys.argv[1], sys.argv[2]
WS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ORGS = ['StartupOrg', 'InvestorOrg', 'ValidatorOrg', 'PlatformOrg']
CHANNELS = {
    'single': [('crowdfunding-channel', ['crowdfunding', 'cftoken'])],
    'dual': [('governance-validation-channel', ['governance']), ('investment-execution-channel', ['investment', 'cftoken'])],
}[arch]
os.makedirs(f'{WS}/networks/v3', exist_ok=True)
orgs = []
for o in ORGS:
    d = f'{o.lower()}.example.com'; host = f'peer0.{d}'
    cdir = f'{WS}/crypto/v3/{arch}/{o}'; os.makedirs(cdir, exist_ok=True)
    msp = f'{croot}/peerOrganizations/{d}/users/User1@{d}/msp'
    shutil.copy(glob.glob(f'{msp}/signcerts/*')[0], f'{cdir}/cert.pem')
    shutil.copy(glob.glob(f'{msp}/keystore/*')[0], f'{cdir}/key.pem')
    shutil.copy(f'{croot}/peerOrganizations/{d}/peers/{host}/tls/ca.crt', f'{cdir}/tlsca.pem')
    prof = {
        'name': f'v3-{arch}-{o}', 'version': '1.0.0',
        'client': {'organization': o, 'connection': {'timeout': {'peer': {'endorser': '300'}, 'orderer': '300'}}},
        'organizations': {o: {'mspid': f'{o}MSP', 'peers': [host]}},
        'peers': {host: {'url': f'grpcs://{host}:7051', 'tlsCACerts': {'path': f'crypto/v3/{arch}/{o}/tlsca.pem'},
                         'grpcOptions': {'ssl-target-name-override': host, 'hostnameOverride': host}}},
    }
    json.dump(prof, open(f'{WS}/networks/v3/connection-{arch}-{o.lower()}.json', 'w'), indent=2)
    orgs.append({'mspid': f'{o}MSP', 'identities': {'certificates': [{'name': f'{o.lower()}admin',
                 'clientPrivateKey': {'path': f'crypto/v3/{arch}/{o}/key.pem'}, 'clientSignedCert': {'path': f'crypto/v3/{arch}/{o}/cert.pem'}}]},
                 'connectionProfile': {'path': f'networks/v3/connection-{arch}-{o.lower()}.json', 'discover': False}})
net = {'name': f'crowdfunding-v3-{arch}', 'version': '2.0.0',
       'caliper': {'blockchain': 'fabric', 'sutOptions': {'diagnoseErrors': True}},
       'channels': [{'channelName': ch, 'contracts': [{'id': c, 'contractID': c} for c in ccs]} for ch, ccs in CHANNELS],
       'organizations': orgs}
yaml.safe_dump(net, open(f'{WS}/network-v3-{arch}.yaml', 'w'), sort_keys=False)
print(f'wrote network-v3-{arch}.yaml')
