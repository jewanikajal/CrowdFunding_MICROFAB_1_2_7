const fs=require('fs'),path=require('path'),crypto=require('crypto'),grpc=require('@grpc/grpc-js');
const {connect,signers,hash}=require('@hyperledger/fabric-gateway');
const dom=o=>`${o.toLowerCase()}.example.com`, CH='investment-execution-channel';
function gw(org,user='User1'){const d=dom(org),h=`peer0.${d}`,b=`/crypto/peerOrganizations/${d}`,m=`${b}/users/${user}@${d}/msp`;
 const c=new grpc.Client(`${h}:7051`,grpc.credentials.createSsl(fs.readFileSync(`${b}/peers/${h}/tls/ca.crt`)));
 return connect({client:c,identity:{mspId:`${org}MSP`,credentials:fs.readFileSync(path.join(m,'signcerts',fs.readdirSync(`${m}/signcerts`)[0]))},
  signer:signers.newPrivateKeySigner(crypto.createPrivateKey(fs.readFileSync(path.join(m,'keystore',fs.readdirSync(`${m}/keystore`)[0])))),hash:hash.sha256});}
(async()=>{
 const id='INV_pan_'+Date.now().toString(36), pan='PANX'+Date.now().toString(36).slice(-5).toUpperCase();
 const inv=gw('InvestorOrg').getNetwork(CH).getContract('investment');
 const p=inv.newProposal('InvestorContract:RegisterInvestor',{arguments:[id,'Ravi','0','',''],transientData:{kyc:Buffer.from(JSON.stringify({annualIncome:45000000,aadharNumber:'7777-6666-5555',panNumber:pan}))}});
 const tx=await p.endorse(); const st=await (await tx.submit()).getStatus();
 console.log(`register ${id}: ${st.successful?'VALID':'code '+st.code}  (PAN=${pan})`);
 for(const org of ['InvestorOrg','ValidatorOrg','StartupOrg','PlatformOrg']){
  try{const r=Buffer.from(await gw(org).getNetwork(CH).getContract('investment').evaluateTransaction('DataBridgeContract:ReadData','InvestorValidatorShared','INVESTOR_SHARED_'+id)).toString();
   console.log(`${org.padEnd(13)} read PAN: ALLOWED -> ${r}`);}
  catch(e){const m=(e.details||[]).map(d=>d.message).join(' ')||e.message; console.log(`${org.padEnd(13)} read PAN: DENIED  -> ${m.match(/tx creator does not have[^,]*/)?.[0]||m.slice(0,120)}`);}
 }
 const blk=Buffer.from(await gw('StartupOrg').getNetwork(CH).getContract('qscc').evaluateTransaction('GetBlockByTxID',CH,tx.getTransactionId()));
 console.log(`PAN in block fetched by StartupOrg: ${blk.includes(Buffer.from(pan))?'YES (leak)':'NO'}`);
 process.exit(0);})().catch(e=>{console.error(e);process.exit(1)});
