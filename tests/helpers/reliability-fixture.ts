import {competitionFixture} from "./competition-fixture.ts";
import {createServer} from "node:http";
import bs58 from "bs58";
import {disc,hashBytes,escrowAddress,submissionAddress,ESCROW_PROGRAM,SYSTEM} from "../../solana/client/challenge-escrow.ts";
export async function reliabilityFixture(){
 const f=await competitionFixture();
 const wallets=await f.db.prepare("SELECT user_id,address FROM wallets").all<{user_id:string;address:string}>();
 const w=Object.fromEntries(wallets.results.map(x=>[x.user_id,x.address]));
 const now=Math.floor(Date.now()/1000);
 const c={challengeId:"qa-challenge",funder:w.reviewer,reviewer:w.reviewer,backup:w.employer,registrar:w.outsider,mint:SYSTEM,amount:"50000000",slots:1,submitDeadline:now-600,reviewDeadline:now+3600,
 termsText:JSON.stringify({minimumScore:80}),termsHash:""};
 c.termsHash=(await hashBytes(c.termsText)).toString("hex");
 const address=await escrowAddress(c),subAddress=await submissionAddress(address,w.student);
 const control={funded:BigInt(50000000),phase:1,accepted:3,decision:0,paid:false,finalized:true,action:"initialize",missingTx:false,wrongAction:false,instructions:null as Array<{programId:string;accounts:string[];data:string}>|null};
 const n=(v:string|number|bigint,size:number)=>{const b=Buffer.alloc(size);if(size===8)b.writeBigUInt64LE(BigInt(v));else if(size===4)b.writeUInt32LE(Number(v));else if(size===2)b.writeUInt16LE(Number(v));else b.writeUInt8(Number(v));return b;};
 const account=async()=>Buffer.concat([await disc("account:Escrow"),...["funder","reviewer","backup","registrar","mint"].map(k=>Buffer.from(bs58.decode(c[k as keyof typeof c] as string))),
 await hashBytes(c.challengeId),Buffer.from(c.termsHash,"hex"),n(c.amount,8),n(c.slots,2),n(c.submitDeadline,8),n(c.reviewDeadline,8),n(control.phase,1),n(control.accepted,1),n(control.funded,8),n(control.decision===3?c.amount:0,8),n(control.paid?c.amount:0,8),n(0,8),n(1,4),n(control.decision?1:0,4),n(255,1),Buffer.alloc(74)]);
 const receipt=async()=>Buffer.concat([await disc("account:Submission"),Buffer.from(bs58.decode(address)),Buffer.from(bs58.decode(w.student)),await hashBytes("qa-submission"),Buffer.alloc(32,1),Buffer.alloc(32),n(control.decision,1),n(control.paid?1:0,1),Buffer.alloc(14)]);
 const methods:string[]=[];
 const rpcServer=createServer(async(req,res)=>{
  let text="";for await(const chunk of req)text+=chunk;
  const b=JSON.parse(text);methods.push(b.method);let result;
  if(b.method==="getGenesisHash")result="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
  else if(b.method==="getAccountInfo")result={context:{slot:999},value:b.params[0]===address?{owner:ESCROW_PROGRAM,data:[(await account()).toString("base64"),"base64"]}:null};
  else if(b.method==="getProgramAccounts")result=[{pubkey:subAddress,account:{owner:ESCROW_PROGRAM,data:[(await receipt()).toString("base64"),"base64"]}}];
  else if(b.method==="getSignatureStatuses")result={value:[{confirmationStatus:control.finalized?"finalized":"confirmed",err:null}]};
  else if(b.method==="getTransaction")result=control.missingTx?null:{meta:{err:null},transaction:{message:{accountKeys:[w.reviewer,w.student,w.employer,address,ESCROW_PROGRAM],instructions:control.instructions??[{programId:ESCROW_PROGRAM,accounts:[w.reviewer,w.employer,w.student,address,subAddress],data:bs58.encode(await disc("global:"+(control.wrongAction?"cancel_empty":control.action)))}]}}};
  else if(b.method==="getLatestBlockhash")result={context:{slot:999},value:{blockhash:SYSTEM,lastValidBlockHeight:999999999}};
  else {res.writeHead(400);res.end(JSON.stringify({error:{message:"Unexpected test RPC "+b.method}}));return;}
  res.setHeader("content-type","application/json");res.end(JSON.stringify({jsonrpc:"2.0",id:b.id,result}));
 });
 await new Promise<void>(r=>rpcServer.listen(0,"127.0.0.1",r));
 await f.db.prepare("UPDATE challenges SET reward_type='sol',reward_asset='sol',reward_amount_atomic='50000000',reward_amount_usdc='0.05',minimum_score='80' WHERE id='qa-challenge'").run();
 await f.db.prepare("INSERT INTO challenge_escrows(challenge_id,program_id,escrow_address,config_json) VALUES(?,?,?,?)").bind(c.challengeId,ESCROW_PROGRAM,address,JSON.stringify(c)).run();
 await f.db.prepare("INSERT INTO escrow_submission_locks(submission_id,challenge_id,student_wallet,evidence_hash) VALUES(?,?,?,?)").bind("qa-submission",c.challengeId,w.student,Buffer.alloc(32,1).toString("hex")).run();
 return {...f,w,c,address,control,methods,rpc:"http://127.0.0.1:"+(rpcServer.address() as {port:number}).port,
   resetMirror:()=>f.db.prepare("UPDATE challenge_escrows SET chain_state_json=NULL,chain_slot=0 WHERE challenge_id='qa-challenge'").run(),
   stop:async()=>{await new Promise<void>(r=>rpcServer.close(()=>r()));await f.stop();}};
}
