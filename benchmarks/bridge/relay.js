'use strict';
/*
 * BlockAssist+ v3 cross-channel relay (event-driven bridge).
 *
 * Listens for "CrossChannelSync" chaincode events on BOTH channels and, for every outbox entry
 * of the emitting transaction, submits DataBridgeContract:ApplySync on the other channel.
 * Endorsing peers must be joined to both channels (Validator + Platform here), because they
 * verify the entry by reading the source ledger themselves -- the relay supplies only the key.
 *
 * Properties
 *  - trustless: a malicious relay can delay but not forge or alter data (endorsers re-read it)
 *  - exactly-once: ApplySync is idempotent (SYNCED_<key> marker), so restarts/replays are safe
 *  - crash-tolerant: per-direction file checkpoint; on restart it resumes from the last
 *    contiguous fully-processed event
 *
 *   node relay.js '<json>'   {org, stateDir, statsFile, concurrency}
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');
const { connect, signers, hash, checkpointers } = require('@hyperledger/fabric-gateway');

const cfg = JSON.parse(process.argv[2] || '{}');
const ORG = cfg.org || 'PlatformOrg';
const BATCH = cfg.batch || 1; // >1: group outbox keys into ApplySyncBatch transactions
const CONC = cfg.concurrency || (BATCH > 1 ? 5000 : 64);
const dom = (o) => `${o.toLowerCase()}.example.com`;
const DIRS = [
  { name: 'gov->inv', src: ['governance-validation-channel', 'governance'], dst: ['investment-execution-channel', 'investment'],
    endorsers: ['ValidatorOrgMSP', 'PlatformOrgMSP'] },
  { name: 'inv->gov', src: ['investment-execution-channel', 'investment'], dst: ['governance-validation-channel', 'governance'],
    endorsers: ['ValidatorOrgMSP', 'PlatformOrgMSP'] },
];

const stats = fs.createWriteStream(cfg.statsFile || '/tmp/relay_stats.jsonl', { flags: 'a' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function gateway() {
  const d = dom(ORG), host = `peer0.${d}`, base = `/crypto/peerOrganizations/${d}`;
  const msp = `${base}/users/User1@${d}/msp`;
  const client = new grpc.Client(`${host}:7051`, grpc.credentials.createSsl(fs.readFileSync(`${base}/peers/${host}/tls/ca.crt`)));
  return connect({
    client, identity: { mspId: `${ORG}MSP`, credentials: fs.readFileSync(path.join(msp, 'signcerts', fs.readdirSync(`${msp}/signcerts`)[0])) },
    signer: signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(msp, 'keystore', fs.readdirSync(`${msp}/keystore`)[0])))),
    hash: hash.sha256,
  });
}

// ---- batched mode: one ApplySyncBatch tx per <= BATCH keys, flushed every 100 ms
const queues = new Map();
function enqueue(dst, dir, srcChannel, key, ev) {
  if (!queues.has(dir.name)) {
    const q = { items: [], dst, dir, srcChannel };
    queues.set(dir.name, q);
    setInterval(() => flush(q), 100);
  }
  return new Promise((resolve) => queues.get(dir.name).items.push({ key, ev, resolve }));
}
async function flush(q) {
  while (q.items.length) {
    const batch = q.items.splice(0, BATCH);
    (async () => {
      for (let attempt = 1; attempt <= 30; attempt++) {
        try {
          const res = JSON.parse(Buffer.from(await q.dst.submit('DataBridgeContract:ApplySyncBatch', {
            arguments: [q.srcChannel, JSON.stringify(batch.map((b) => b.key))], endorsingOrganizations: q.dir.endorsers,
          })).toString());
          const now = Date.now();
          for (const b of batch) {
            stats.write(JSON.stringify({ dir: q.dir.name, key: b.key, srcTx: b.ev.transactionId, srcBlock: Number(b.ev.blockNumber), appliedMs: now, result: res[b.key], attempts: attempt, batch: batch.length }) + '\n');
            b.resolve();
          }
          return;
        } catch (e) {
          await sleep(Math.min(200 * attempt, 2000));
          if (attempt === 30) for (const b of batch) { stats.write(JSON.stringify({ dir: q.dir.name, key: b.key, failed: (e.message || '').slice(0, 200) }) + '\n'); b.resolve(); }
        }
      }
    })();
  }
}

async function applyOne(dst, dir, srcChannel, key, ev) {
  if (BATCH > 1) return enqueue(dst, dir, srcChannel, key, ev);
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const res = Buffer.from(await dst.submit('DataBridgeContract:ApplySync', {
        arguments: [srcChannel, key], endorsingOrganizations: dir.endorsers,
      })).toString();
      stats.write(JSON.stringify({ dir: dir.name, key, srcTx: ev.transactionId, srcBlock: Number(ev.blockNumber), appliedMs: Date.now(), result: res, attempts: attempt }) + '\n');
      return;
    } catch (e) {
      const msg = (e.message || '') + (e.details || []).map((x) => x.message).join(' ');
      // not yet committed on the endorser's copy of the source ledger, or MVCC on the marker -> retry
      await sleep(Math.min(200 * attempt, 2000));
      if (attempt === 30) stats.write(JSON.stringify({ dir: dir.name, key, failed: msg.slice(0, 300) }) + '\n');
    }
  }
}

async function runDirection(gw, dir) {
  const [sch, scc] = dir.src, [dch, dcc] = dir.dst;
  const src = gw.getNetwork(sch).getContract(scc);
  const dst = gw.getNetwork(dch).getContract(dcc);
  const cp = await checkpointers.file(path.join(cfg.stateDir || '/tmp', `checkpoint_${dir.name.replace('>', '')}.json`));
  const events = await gw.getNetwork(sch).getChaincodeEvents(scc, { checkpoint: cp, startBlock: 0n });
  const window = []; // in-order list of {ev, done}
  let inflight = 0;
  console.log(`[relay] ${dir.name} listening (checkpoint block ${cp.getBlockNumber()})`);
  for await (const ev of events) {
    if (ev.eventName !== 'CrossChannelSync') continue;
    while (inflight >= CONC) await sleep(5);
    const item = { ev, done: false }; window.push(item); inflight++;
    (async () => {
      const seenMs = Date.now();
      let keys = [];
      for (let i = 0; i < 20; i++) {
        try { keys = JSON.parse(Buffer.from(await src.evaluateTransaction('DataBridgeContract:ListOutbox', ev.transactionId)).toString()) || []; break; } catch { await sleep(200); }
      }
      await Promise.all(keys.map((k) => applyOne(dst, dir, sch, k, ev)));
      stats.write(JSON.stringify({ dir: dir.name, srcTx: ev.transactionId, seenMs, entries: keys.length }) + '\n');
      item.done = true; inflight--;
      while (window.length && window[0].done) await cp.checkpointChaincodeEvent(window.shift().ev);
    })();
  }
}

(async () => {
  const gw = gateway();
  await Promise.all(DIRS.map((d) => runDirection(gw, d)));
})().catch((e) => { console.error(e); process.exit(1); });
