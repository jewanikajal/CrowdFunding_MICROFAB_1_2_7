#!/usr/bin/env python3
"""Move confidential investment/proposal inputs to the transient map (attack P4).
Inserts, at the top of each listed function, a block that requires the sensitive plaintext
arguments to be empty and loads their real values from transient["private"]."""
import re, sys

# (receiver, function, [(param, transientKey, type, required)])
SPECS = {
  'MakeInvestment': ('i *InvestorContract', [('campaignID','campaignId','s',1),('investorID','investorId','s',1),('amount','amount','n',1),('currency','currency','s',1)]),
  'CreateInvestmentProposal': ('i *InvestorContract', [('campaignID','campaignId','s',1),('investorID','investorId','s',1),('startupID','startupId','s',1),
        ('investmentAmount','investmentAmount','n',1),('currency','currency','s',1),('equity','equity','s',0),('duration','duration','s',0),
        ('milestonesJSON','milestones','s',0),('proposedTerms','proposedTerms','s',0)]),
  'RespondToCounterOffer': ('i *InvestorContract', [('action','action','s',1),('counterAmount','counterAmount','n',0),('counterTerms','counterTerms','s',0)]),
  'AcceptAgreement': ('i *InvestorContract', [('investorID','investorId','s',1)]),
  'RespondToInvestmentProposal': ('s *StartupContract', [('action','action','s',1),('counterAmount','counterAmount','n',0),('counterTerms','counterTerms','s',0),('modifiedMilestonesJSON','modifiedMilestones','s',0)]),
  # AcknowledgeInvestment differs between single and dual; params are discovered from the signature
  'AcknowledgeInvestment': ('s *StartupContract', None),
}
ACK_KEYS = {'campaignID':('campaignId','s',1),'startupID':('startupId','s',1),'investorID':('investorId','s',1),'message':('message','s',0),'amount':('amount','n',1)}

def block(fields):
    zero = ' && '.join(f'{p} == 0' if t=='n' else f'{p} == ""' for p,_,t,_ in fields)
    out = ['\t// Hardening (P4): confidential inputs come from transient["private"], never from block-recorded arguments',
           f'\tpriv, perr := privateInput(ctx, {zero})', '\tif perr != nil {', '\t\treturn perr', '\t}']
    for p,k,t,req in fields:
        if t=='s':
            out += [f'\tif err := priv.str("{k}", &{p}, {"true" if req else "false"}); err != nil {{', '\t\treturn err', '\t}']
        elif req:
            out += [f'\tif err := priv.num("{k}", &{p}); err != nil {{', '\t\treturn err', '\t}']
        else:
            out += [f'\tif _, ok := priv["{k}"]; ok {{', f'\t\tif err := priv.num("{k}", &{p}); err != nil {{', '\t\t\treturn err', '\t\t}', '\t}']
    return '\n'.join(out) + '\n'

def patch(path):
    s = open(path).read(); n = 0
    for fn,(recv,fields) in SPECS.items():
        m = re.search(r'func \(' + re.escape(recv) + r'\) ' + fn + r'\((.*?)\n\) error \{\n', s, re.S)
        if not m: continue
        if 'Hardening (P4)' in s[m.end():m.end()+200]: continue
        if fields is None:
            params = re.findall(r'\n\t(\w+) (string|float64)', m.group(1))
            fields = [(p,)+ACK_KEYS[p] for p,_ in params if p in ACK_KEYS]
        s = s[:m.end()] + block(fields) + s[m.end():]; n += 1
    open(path,'w').write(s); return n

if __name__ == '__main__':
    for p in sys.argv[1:]: print(p, 'patched functions:', patch(p))
