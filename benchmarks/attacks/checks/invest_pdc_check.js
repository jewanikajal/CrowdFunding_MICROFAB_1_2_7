const fs=require('fs'),path=require('path'),crypto=require('crypto'),grpc=require('@grpc/grpc-js');
const {connect,signers,hash}=require('@hyperledger/fabric-gateway');
const dom=o=>`${o.toLowerCase()}.example.com`, G='governance-validation-channel', IC='investment-execution-channel', sleep=ms=>new Promise(r=>setTimeout(r,ms));
const gws={};
function gw(org,user='User1'){const k=org+user; if(gws[k])return gws[k]; const d=dom(org),h=`peer0.${d}`,b=`/crypto/peerOrganizations/${d}`,m=`${b}/users/${user}@${d}/msp`;
 const c=new grpc.Client(`${h}:7051`,grpc.credentials.createSsl(fs.readFileSync(`${b}/peers/${h}/tls/ca.crt`)));
 return gws[k]=connect({client:c,identity:{mspId:`${org}MSP`,credentials:fs.readFileSync(path.join(m,'signcerts',fs.readdirSync(`${m}/signcerts`)[0]))},
  signer:signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(m,'keystore',fs.readdirSync(`${m}/keystore`)[0])))),hash:hash.sha256});}
const cc=(org,ch,n)=>gw(org).getNetwork(ch).getContract(n);
async function sub(org,ch,n,fn,args,transient){const p=cc(org,ch,n).newProposal(fn,{arguments:args.map(String),transientData:transient});
 try{const tx=await p.endorse();const st=await (await tx.submit()).getStatus();return {ok:st.successful,tx:tx.getTransactionId(),err:st.successful?'':'code '+st.code};}
 catch(e){return {ok:false,err:((e.details||[]).map(d=>d.message).join(' ')||e.message).slice(0,200)};}}
function findHash(o){if(!o||typeof o!=='object')return null;for(const[k,v]of Object.entries(o)){if(/validationProofHash/i.test(k)&&typeof v==='string'&&v)return v;const h=findHash(v);if(h)return h;}return null;}
(async()=>{
 const R=Date.now().toString(36), st='ST_'+R, camp='CAMP_'+R, val='VAL_'+R, inv='INV_'+R, invt='INVT_'+R, prop='PROP_'+R;
 const amount=25000000+parseInt(R.slice(-3),36), terms='TERMS_'+R;
 const steps=[];
 const step=async(label,p)=>{const r=await p; steps.push(`${r.ok?'OK  ':'FAIL'} ${label}${r.ok?'':' -> '+r.err}`); return r;};
 await step('Startup CreateStartup',sub('StartupOrg',G,'governance','StartupContract:CreateStartup',[st,'f','S','x','D']));
 await step('Startup CreateCampaign',sub('StartupOrg',G,'governance','StartupContract:CreateCampaign',[camp,st,'Technology','2027-12-31','INR','false','false','2024-01-01','MVP','FinTech','["ai"]','true','false','90','1','1','2027','50000000','1Cr-5Cr','P','d','[]']));
 await step('Startup SubmitForValidation',sub('StartupOrg',G,'governance','StartupContract:SubmitForValidation',[camp,'[]','n']));
 await step('Validator ValidateCampaign',sub('ValidatorOrg',G,'governance','ValidatorContract:ValidateCampaign',[val,camp,'V1','h','[]']));
 await step('Validator Approve',sub('ValidatorOrg',G,'governance','ValidatorContract:ApproveOrRejectCampaign',[val,camp,'APPROVED',8.5,3.2,'LOW','[]','[]','']));
 await step('Validator ShareValidationToPlatform',sub('ValidatorOrg',G,'governance','ValidatorContract:ShareValidationToPlatform',[val,camp]));
 const h=findHash(JSON.parse(Buffer.from(await cc('StartupOrg',G,'governance').evaluateTransaction('StartupContract:GetCampaign',camp)).toString()));
 await step('Startup ShareCampaignToPlatform',sub('StartupOrg',G,'governance','StartupContract:ShareCampaignToPlatform',[camp,h]));
 await step('Platform PublishCampaignToPortal',sub('PlatformOrg',G,'governance','PlatformContract:PublishCampaignToPortal',[camp,h]));
 let seen=false; for(let i=0;i<40&&!seen;i++){try{await cc('InvestorOrg',IC,'investment').evaluateTransaction('DataBridgeContract:ReadData','AllOrgsShared','CAMPAIGN_PUBLIC_'+camp);seen=true;}catch{await sleep(1000);}}
 steps.push(`${seen?'OK  ':'FAIL'} campaign bridged to investment channel`);
 await step('Investor RegisterInvestor (KYC transient)',sub('InvestorOrg',IC,'investment','InvestorContract:RegisterInvestor',[inv,'Ravi','0','',''],{kyc:Buffer.from(JSON.stringify({annualIncome:45000000,aadharNumber:'1-2-3',panNumber:'P'}))}));
 const mi=await step(`Investor MakeInvestment (amount ${amount})`,sub('InvestorOrg',IC,'investment','InvestorContract:MakeInvestment',[invt,camp,inv,amount,'INR']));
 const cp=await step('Investor CreateInvestmentProposal',sub('InvestorOrg',IC,'investment','InvestorContract:CreateInvestmentProposal',[prop,camp,inv,st,amount,'INR','10%','24m','[]',terms]));
 console.log(steps.join('\n'));
 console.log('\nWho can read the records in StartupInvestorShared (investment channel)?');
 for(const [label,key] of [['investment record','INVESTMENT_'+invt],['proposal','PROPOSAL_'+prop]])
  for(const org of ['StartupOrg','InvestorOrg','ValidatorOrg','PlatformOrg']){
   try{const r=Buffer.from(await cc(org,IC,'investment').evaluateTransaction('DataBridgeContract:ReadData','StartupInvestorShared',key)).toString(); console.log(`  ${label.padEnd(17)} ${org.padEnd(13)} ALLOWED  ${r.slice(0,90)}`);}
   catch(e){const m=(e.details||[]).map(d=>d.message).join(' ')||e.message; console.log(`  ${label.padEnd(17)} ${org.padEnd(13)} DENIED   ${(m.match(/tx creator does not have[^,]*/)||[m.slice(0,90)])[0]}`);}
  }
 console.log('\nIs the content visible in the blocks every channel member (e.g. ValidatorOrg) receives?');
 for(const [label,r,needle] of [['investment',mi,String(amount)],['proposal',cp,terms]]){ if(!r.ok) continue;
  const blk=Buffer.from(await cc('ValidatorOrg',IC,'qscc').evaluateTransaction('GetBlockByTxID',IC,r.tx));
  console.log(`  ${label}: ${blk.includes(Buffer.from(needle))?'YES - '+needle+' appears in plaintext (sent as transaction argument)':'NO'}`);}
 Object.values(gws).forEach(g=>g.close()); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
