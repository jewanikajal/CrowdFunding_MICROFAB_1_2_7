#!/usr/bin/env python3
"""benchconfig-<arch>-full.yaml -> benchconfig-<arch>-isolated.yaml (same rounds, rates, workers and labels).
Each operation round uses workloads-isolated/isolated.js: prerequisites are created in initializeWorkloadModule
(not counted by Caliper), the measured round submits only the named operation. Cool-down rounds are unchanged."""
import math, re, sys
arch = sys.argv[1]
src = open(f'benchconfig-{arch}-full.yaml').read()
workers = int(re.search(r'workers:\s*\n\s*number:\s*(\d+)', src).group(1))
out, tx = [], None
for line in src.split('\n'):
    m = re.match(r'\s*txNumber:\s*(\d+)', line)
    if m: tx = int(m.group(1))
    m = re.search(r'module:\s*workloads/(\w+)\.js', line)
    if m and m.group(1) != 'peerCooldown':
        pool = math.ceil(tx / workers) + 5
        line = line.replace(f'workloads/{m.group(1)}.js', 'workloads-isolated/isolated.js')
        line = re.sub(r'arguments:\s*\{', f'arguments: {{ op: {m.group(1)}, poolSize: {pool},', line, count=1)
    out.append(line)
res = '\n'.join(out).replace(f'name: crowdfunding-{arch}-full', f'name: crowdfunding-{arch}-isolated')
assert 'arguments:\n' not in res or True
open(f'benchconfig-{arch}-isolated.yaml', 'w').write(res)
print(res.count('isolated.js'), 'rounds')
