#!/usr/bin/env python3
"""Run one benchmark round (load + resource monitoring) and save a merged JSON result.

  bench.py <result-name> <workload> <tps> <txCount> [--workers 4] [--org Org] [--channel ch] [--chaincode cc]

The network must already be up (./network.sh up ...). Results -> results/raw/<name>.json
"""
import argparse, csv, json, os, subprocess, time
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
NET = os.path.join(HERE, "work", "net")
RAW = os.path.join(HERE, "results", "raw")

DEFAULT_CH = {
    ("single", "*"): ("crowdfunding-channel", "crowdfunding"),
    ("dual", "startup"): ("governance-validation-channel", "governance"),
    ("dual", "*"): ("investment-execution-channel", "investment"),
}


def resources(csvfile, start, end):
    rows = [r for r in csv.DictReader(open(csvfile)) if start / 1000 <= float(r["t"]) <= end / 1000 + 1]
    by_t_role = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
    net = defaultdict(dict)
    host = []
    for r in rows:
        t = r["t"]
        if r["role"] == "host":
            host.append((float(r["cpu_pct"]), float(r["rss_mb"]))); continue
        a = by_t_role[t][r["role"]]; a[0] += float(r["cpu_pct"]); a[1] += float(r["rss_mb"])
        c = net[r["container"]]
        c.setdefault("first", (float(t), int(r["rx_bytes"]), int(r["tx_bytes"])))
        c["last"] = (float(t), int(r["rx_bytes"]), int(r["tx_bytes"]))
        c["role"] = r["role"]
    roles = defaultdict(lambda: {"cpu": [], "mem": []})
    for t, rs in by_t_role.items():
        for role, (cpu, mem) in rs.items():
            roles[role]["cpu"].append(cpu); roles[role]["mem"].append(mem)
    out = {}
    for role, v in roles.items():
        out[role] = {"cpuAvgPct": round(sum(v["cpu"]) / len(v["cpu"]), 1), "cpuPeakPct": round(max(v["cpu"]), 1),
                     "memAvgMB": round(sum(v["mem"]) / len(v["mem"]), 1), "memPeakMB": round(max(v["mem"]), 1)}
    bw = defaultdict(lambda: [0, 0])
    for c in net.values():
        if "last" not in c: continue
        bw[c["role"]][0] += c["last"][1] - c["first"][1]; bw[c["role"]][1] += c["last"][2] - c["first"][2]
    dur = max((end - start) / 1000, 1e-3)
    for role, (rx, tx) in bw.items():
        out.setdefault(role, {})
        out[role]["netRxMBps"] = round(rx / dur / 2**20, 3); out[role]["netTxMBps"] = round(tx / dur / 2**20, 3)
    if host:
        out["host"] = {"cpuAvgPct": round(sum(h[0] for h in host) / len(host), 1),
                       "cpuPeakPct": round(max(h[0] for h in host), 1),
                       "memUsedPeakMB": round(max(h[1] for h in host), 1)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name"); ap.add_argument("workload"); ap.add_argument("tps", type=float); ap.add_argument("tx", type=int)
    ap.add_argument("--workers", type=int, default=4); ap.add_argument("--org")
    ap.add_argument("--channel"); ap.add_argument("--chaincode"); ap.add_argument("--tag", default="")
    a = ap.parse_args()
    net = json.load(open(os.path.join(NET, "net.json")))
    ch, cc = DEFAULT_CH.get((net["topology"], a.workload)) or DEFAULT_CH[(net["topology"], "*")]
    ch, cc = a.channel or ch, a.chaincode or cc
    peers = defaultdict(list)
    for p in net["peers"]: peers[p["org"]].append(p["host"])
    os.makedirs(RAW, exist_ok=True)
    out = os.path.join(RAW, a.name + ".json")
    lg_out = os.path.join(RAW, "." + a.name + ".lg.json")
    mon_csv = os.path.join(RAW, "." + a.name + ".mon.csv"); stop = mon_csv + ".stop"
    if os.path.exists(stop): os.remove(stop)
    mon = subprocess.Popen(["python3", os.path.join(HERE, "monitor.py"), mon_csv, stop])
    cfg = {"channel": ch, "chaincode": cc, "workload": a.workload, "tps": a.tps, "txCount": a.tx,
           "workers": a.workers, "peers": peers, "cryptoRoot": "/crypto",
           "out": "/b/results/raw/." + a.name + ".lg.json"}
    if a.org: cfg["org"] = a.org
    time.sleep(1.5)
    subprocess.run(["docker", "run", "--rm", "--name", "loadgen-" + a.name, "--network", "cfnet",
                    "-v", f"{HERE}:/b", "-v", f"{NET}/crypto:/crypto:ro", "node:22-slim",
                    "node", "/b/loadgen/loadgen.js", json.dumps(cfg)], check=True, stdout=subprocess.DEVNULL)
    open(stop, "w").close(); mon.wait()
    res = json.load(open(lg_out))
    res["resources"] = resources(mon_csv, res["startMs"], res["endMs"])
    res["network"] = {k: net[k] for k in ("peersPerOrg", "orderers", "topology", "batchTimeout", "batchSize")}
    res["network"]["totalPeers"] = len(net["peers"])
    pol = os.path.join(NET, f"policy_{cc}")
    res["endorsementPolicy"] = open(pol).read().strip() if os.path.exists(pol) else None
    res["tag"] = a.tag; res["name"] = a.name
    json.dump(res, open(out, "w"), indent=2)
    os.remove(lg_out); os.remove(stop); os.remove(mon_csv)
    r = res; h = r["resources"].get("host", {})
    print(f"{a.name}: target={a.tps} send={r['sendRate']} tput={r['throughput']} succ={r['succeeded']}/{r['submitted']} "
          f"lat avg={r['latAvg']} p95={r['latP95']} max={r['latMax']} hostCPU={h.get('cpuAvgPct')}% err={r['errors']}")


if __name__ == "__main__":
    main()
