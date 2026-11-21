#!/usr/bin/env python3
"""Resource monitor: samples every container on the `cfnet` network once per second
straight from cgroup v1 / procfs (no `docker stats` overhead) and writes a CSV.

  monitor.py <out.csv> <stopfile>

Columns: t, container, role, cpu_pct (100 = one vCPU), rss_mb, rx_bytes, tx_bytes
plus a pseudo-container "__host__" with whole-host CPU% (100 = all vCPUs) and used memory.
"""
import csv, json, os, subprocess, sys, time

out, stopfile = sys.argv[1], sys.argv[2]


def role(name):
    if name.startswith("couchdb."): return "couchdb"
    if name.startswith("orderer"): return "orderer"
    if name.startswith("peer") and name.endswith(".example.com"): return "peer"
    if name.startswith("peer"): return "chaincode"
    if name.startswith("loadgen"): return "loadgen"
    return "other"


def containers():
    ids = subprocess.run(["docker", "ps", "-q", "--no-trunc", "--filter", "network=cfnet"],
                         capture_output=True, text=True).stdout.split()
    if not ids: return {}
    info = json.loads(subprocess.run(["docker", "inspect"] + ids, capture_output=True, text=True).stdout)
    return {c["Id"]: (c["Name"].lstrip("/"), c["State"]["Pid"]) for c in info}


def rd(path):
    try:
        with open(path) as f: return f.read()
    except OSError: return None


def host_cpu():
    v = list(map(int, rd("/proc/stat").splitlines()[0].split()[1:]))
    idle = v[3] + v[4]
    return sum(v), idle


def sample(cs):
    now = {}
    for cid, (name, pid) in cs.items():
        u = rd(f"/sys/fs/cgroup/cpuacct/docker/{cid}/cpuacct.usage")
        ms = rd(f"/sys/fs/cgroup/memory/docker/{cid}/memory.stat")
        nd = rd(f"/proc/{pid}/net/dev")
        if u is None: continue
        rss = 0
        for line in (ms or "").splitlines():
            k, _, val = line.partition(" ")
            if k == "total_rss": rss = int(val)
        rx = tx = 0
        for line in (nd or "").splitlines():
            if "eth0:" in line:
                f = line.split(":")[1].split(); rx, tx = int(f[0]), int(f[8])
        now[cid] = (name, int(u), rss, rx, tx)
    return now


cs = containers(); refresh = time.time()
prev, pt = sample(cs), time.time()
ph = host_cpu()
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["t", "container", "role", "cpu_pct", "rss_mb", "rx_bytes", "tx_bytes"])
    while not os.path.exists(stopfile):
        time.sleep(1.0)
        if time.time() - refresh > 10:
            cs = containers(); refresh = time.time()
        cur, ct = sample(cs), time.time()
        dt = ct - pt
        for cid, (name, u, rss, rx, tx) in cur.items():
            if cid in prev:
                cpu = (u - prev[cid][1]) / 1e9 / dt * 100
                w.writerow([f"{ct:.2f}", name, role(name), f"{cpu:.1f}", f"{rss/2**20:.1f}", rx, tx])
        h = host_cpu()
        tot, idle = h[0] - ph[0], h[1] - ph[1]
        mem = rd("/proc/meminfo").split("\n")
        mi = {l.split(":")[0]: int(l.split()[1]) for l in mem if l}
        used = (mi["MemTotal"] - mi["MemAvailable"]) / 1024
        w.writerow([f"{ct:.2f}", "__host__", "host", f"{(1 - idle / max(tot, 1)) * 100:.1f}", f"{used:.1f}", 0, 0])
        f.flush()
        prev, pt, ph = cur, ct, h
