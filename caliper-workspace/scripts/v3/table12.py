#!/usr/bin/env python3
"""Build Table 12 for the v3 Caliper run.

  table12.py <single|dual> [report.html] [caliper.log] [oplog-dir]   -> results-v3/table12-<arch>.{md,json}

For every measured round (cool-down rounds excluded) it reports:
  * Caliper's own figures (from the HTML report): succeeded, failed, total transactions, send rate,
    average latency, throughput. Caliper aggregates ALL Fabric transactions of the round, including the
    prerequisite (setup) transactions that a workload submits before its named operation.
  * the NAMED operation alone (from the per-function operation log written by workloads/helpers.js):
    invocations, committed, success rate.
  * failure causes per contract function (from the Caliper log): Fabric validation code, or the
    endorsement-phase error for transactions rejected before ordering.
"""
import glob, html, json, os, re, sys
from collections import Counter, defaultdict
from datetime import datetime

ARCH = sys.argv[1]            # single | dual | single-isolated | dual-isolated
WS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
REPORT = sys.argv[2] if len(sys.argv) > 2 else f'{WS}/report-v3-{ARCH}-full.html'
LOG = sys.argv[3] if len(sys.argv) > 3 else f'{WS}/caliper-v3-{ARCH}.log'
OPLOG = sys.argv[4] if len(sys.argv) > 4 else f'{WS}/oplog-v3-{ARCH}'
ARCH_BASE = ARCH.split('-')[0]
OUT = f'{WS}/results-v3'; os.makedirs(OUT, exist_ok=True)

# round label -> named contract function
NAMED = {
    'createStartup': 'StartupContract:CreateStartup', 'createCampaign': 'StartupContract:CreateCampaign',
    'submitForValidation': 'StartupContract:SubmitForValidation', 'validateCampaign': 'ValidatorContract:ValidateCampaign',
    'approveOrRejectCampaign': 'ValidatorContract:ApproveOrRejectCampaign', 'shareCampaignToPlatform': 'StartupContract:ShareCampaignToPlatform',
    'publishCampaignToPortal': 'PlatformContract:PublishCampaignToPortal', 'registerInvestor': 'InvestorContract:RegisterInvestor',
    'viewCampaign': 'InvestorContract:ViewCampaign', 'makeInvestment': 'InvestorContract:MakeInvestment',
    'createInvestmentProposal': 'InvestorContract:CreateInvestmentProposal', 'respondToInvestmentProposal': 'StartupContract:RespondToInvestmentProposal',
    'initializeToken': 'TokenContract:InitializeToken', 'mintTokens': 'TokenContract:MintTokens', 'transferTokens': 'TokenContract:TransferTokens',
    'submitMilestoneReport': 'StartupContract:SubmitMilestoneReport', 'verifyMilestoneCompletion': 'ValidatorContract:VerifyMilestoneCompletion',
    'triggerFundRelease': 'PlatformContract:TriggerFundRelease', 'createDispute': 'PlatformContract:CreateDispute',
    'collectCampaignFee': 'PlatformContract:CollectCampaignFee', 'setFeeTiers': 'PlatformContract:SetCampaignFeeTier',
    'deleteCampaign': 'StartupContract:DeleteCampaign', 'withdrawInvestment': 'InvestorContract:WithdrawInvestment',
    'requestRefund': 'InvestorContract:RequestRefund', 'closeCampaign': 'PlatformContract:CloseCampaign',
}
LOAD = {'low': 'light', 'medium': 'medium', 'stress': 'stress'}

# ---------- Caliper HTML report ----------
# REPORT and LOG may be comma-separated (a run resumed in a second Caliper invocation)
rep = {}
for f in LOG.split(','):   # per-round result tables that Caliper prints into its log
    for m in re.finditer(r'^\| ([\w-]+-P\d\d-\w+)\s*\| (\d+)\s*\| (\d+)\s*\| ([\d.]+)\s*\| ([\d.-]+)\s*\| ([\d.-]+)\s*\| ([\d.-]+)\s*\| ([\d.]+)', open(f, errors='ignore').read(), re.M):
        g = m.groups(); num = lambda x: float(x) if x != '-' else 0.0
        rep[g[0]] = dict(succ=int(g[1]), fail=int(g[2]), send=float(g[3]), lat_max=num(g[4]), lat_min=num(g[5]), lat_avg=num(g[6]), tput=float(g[7]))
for f in REPORT.split(','):
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8', errors='ignore').read()
    t = s[s.find('<table'):s.find('</table>')]
    for r in re.findall(r'<tr>(.*?)</tr>', t, re.S)[1:]:
        c = [html.unescape(re.sub('<.*?>', '', x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)]
        num = lambda x: float(x) if x not in ('-', '') else 0.0
        rep[c[0]] = dict(succ=int(c[1]), fail=int(c[2]), send=num(c[3]), lat_max=num(c[4]), lat_min=num(c[5]), lat_avg=num(c[6]), tput=num(c[7]))

# ---------- Caliper log: round windows + failures ----------
ts = lambda x: datetime.strptime(x, '%Y.%m.%d-%H:%M:%S.%f').timestamp() * 1000
windows, cur = [], None
fails = defaultdict(Counter)  # (round label, fcn) -> cause counts
lines = sum((open(f, errors='ignore').read().split('\n') for f in LOG.split(',')), [])
for i, line in enumerate(lines):
    m = re.match(r'(\S+) info .*Started round \d+ \((.+?)\)', line)
    if m:
        cur = {'label': m.group(2), 'start': ts(m.group(1))}; continue
    m = re.match(r'(\S+) info .*Finished round \d+ \((.+?)\) in', line)
    if m and cur:
        cur['end'] = ts(m.group(1)); windows.append(cur); cur = None; continue
    m = re.match(r'\S+ error .*Failed to perform (submit|query) transaction \[([^\]]+)\].*with error: (.*)', line)
    if m and cur:
        err = m.group(3)
        # Caliper appends the peer messages on the following lines ("-  peer:message")
        for nxt in lines[i + 1:i + 6]:
            if nxt.startswith('-  '):
                err += ' | ' + nxt
            elif not nxt.startswith('Details'):
                break
        code = re.search(r'status code: (\d+)', err)
        if code:
            cause = f'validation code {code.group(1)}' + {'11': ' (MVCC_READ_CONFLICT)', '12': ' (PHANTOM_READ_CONFLICT)', '10': ' (ENDORSEMENT_POLICY_FAILURE)'}.get(code.group(1), '')
        else:
            k = re.search(r'(startup \S+ not found|proposal not found|campaign \S+ not found|not found|already exists|ProposalResponsePayloads do not match|does not match|exceeding concurrency limit|DEADLINE_EXCEEDED|access denied[^,;]*|not published[^,;]*|blacklisted|insufficient balance|Channel has been shut down|timed out)', err, re.I)
            cause = 'endorsement: ' + (k.group(1) if k else err[:80])
        cause = re.sub(r'\S*_W\d+_T\d+\S*', '<id>', cause)
        fails[(cur['label'], m.group(2))][cause] += 1

# ---------- per-function operation log ----------
ops = []
for f in glob.glob(f'{OPLOG}/*.jsonl'):
    ops += [json.loads(l) for l in open(f) if l.strip()]
ops.sort(key=lambda o: o['t'])

rows = []
for w in windows:
    lab = w['label']
    if lab.startswith('cooldown') or lab not in rep:
        continue
    load, pid, op = lab.split('-', 2)
    fcn = NAMED.get(op)
    named = [o for o in ops if w['start'] <= o['t'] <= w['end'] + 5000 and o['fcn'] == fcn and not o['ro']]
    n_ok = sum(o['ok'] for o in named)
    allw = [o for o in ops if w['start'] <= o['t'] <= w['end'] + 5000 and not o['ro']]
    r = rep[lab]
    rows.append({
        'id': pid, 'operation': op, 'load': LOAD.get(load, load), 'function': fcn,
        'caliper_succ': r['succ'], 'caliper_fail': r['fail'], 'caliper_total': r['succ'] + r['fail'],
        'caliper_success_pct': round(100 * r['succ'] / max(1, r['succ'] + r['fail']), 1),
        'send_tps': r['send'], 'throughput_tps': r['tput'], 'lat_avg_s': r['lat_avg'], 'lat_max_s': r['lat_max'],
        'named_invocations': len(named), 'named_committed': n_ok,
        'named_success_pct': round(100 * n_ok / len(named), 1) if named else None,
        'tx_per_iteration': round(len(allw) / len(named), 2) if named else None,
        'failure_causes': {fn: dict(c) for (l, fn), c in fails.items() if l == lab},
    })

json.dump(rows, open(f'{OUT}/table12-{ARCH}.json', 'w'), indent=2)
md = [f'# Table 12 — v3 {ARCH}-channel Caliper results\n',
      '| ID | Operation | Load | Caliper Succ | Fail | Total tx | Success % | Throughput (TPS) | Avg lat (s) | Named-op committed / invoked | Named-op success % | Failure causes |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|']
for r in rows:
    causes = '; '.join(f"{fn.split(':')[1]}: " + ', '.join(f'{k} ×{v}' for k, v in c.items()) for fn, c in r['failure_causes'].items()) or '—'
    md.append(f"| {r['id']} | {r['operation']} | {r['load']} | {r['caliper_succ']} | {r['caliper_fail']} | {r['caliper_total']} | {r['caliper_success_pct']} | "
              f"{r['throughput_tps']} | {r['lat_avg_s']} | {r['named_committed']} / {r['named_invocations']} | {r['named_success_pct']} | {causes} |")
open(f'{OUT}/table12-{ARCH}.md', 'w').write('\n'.join(md) + '\n')
print(f'{len(rows)} rounds -> results-v3/table12-{ARCH}.md')
