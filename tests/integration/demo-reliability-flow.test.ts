import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {spawn,type ChildProcess} from "node:child_process";
import {reliabilityFixture} from "../helpers/reliability-fixture.ts";
import {parseChallengeContent,contentForPrompt} from "../../shared/validation/challenge-content.ts";
import {RUBRIC} from "../../shared/validation/assessment-contract.ts";
import {disc,hashBytes,ESCROW_PROGRAM} from "../../solana/client/challenge-escrow.ts";
let f:Awaited<ReturnType<typeof reliabilityFixture>>,server:ChildProcess;
const base="http://127.0.0.1:3265";
before(async()=>{
 f=await reliabilityFixture();
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3265"],{env:{...process.env,NODE_ENV:"production",AI_PROVIDER:"openrouter",OPENROUTER_API_KEY:"test-only",OPENROUTER_MODEL:"test/model",TURSO_DATABASE_URL:f.dbUrl,TURSO_AUTH_TOKEN:"",SOLANA_RPC_URL:f.rpc,BLOB_STORE_ID:"",BLOB_READ_WRITE_TOKEN:""},stdio:"ignore"});
 for(let i=0;i<80;i++){try{if((await fetch(base)).ok)return;}catch{/* Server starting. */}await new Promise(r=>setTimeout(r,250));}throw Error("QA server not ready");
});
after(async()=>{if(server?.exitCode===null){server.kill();await new Promise(r=>server.once("exit",r));}await f?.stop();});
const api=(role:string,path:string,body?:unknown)=>fetch(base+path,{method:body?"POST":"GET",headers:{cookie:f.cookies[role]||"","content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
const url="/api/challenges/qa-challenge/escrow";
test("unauthenticated and wrong wallet errors are readable JSON",async()=>{
 const r=await api("none",url);assert.equal(r.status,401);assert.ok((await r.json() as {error:string}).error);
 const wrong=await api("reviewer",url,{action:"initialize",senderWallet:f.w.outsider});assert.equal(wrong.status,403);assert.ok((await wrong.json() as {error:string}).error);
});
test("invalid cached AI remains a failure and never triggers a new provider request",async()=>{
 const c=await f.db.prepare("SELECT c.*,s.reflection,s.evidence_json FROM challenges c JOIN participations p ON p.challenge_id=c.id JOIN submissions s ON s.participation_id=p.id WHERE s.id='qa-submission'").first<Record<string,string>>();
 const files=await f.db.prepare("SELECT id,sha256,size_bytes,content_type FROM submission_files WHERE submission_id='qa-submission' ORDER BY created_at").all<{id:string;sha256:string;size_bytes:string;content_type:string}>();
 const key=(await hashBytes(JSON.stringify({
  submissionId:"qa-submission",files:files.results.map(x=>({id:x.id,sha256:x.sha256,size:x.size_bytes,type:x.content_type})),
  reflection:c!.reflection,submitted:JSON.parse(c!.evidence_json),brief:contentForPrompt(parseChallengeContent(c!.content_json,c!.brief))||c!.brief,
  rubric:JSON.parse(c!.rubric_json),extractionVersion:"local-chunks-v2",promptVersion:"assessment-v3-file-bindings",provider:"openrouter",model:"test/model"
 }))).toString("hex");
 await f.db.prepare("UPDATE assessments SET status='contract_failed',assessment_mode='ai_assisted',cache_key=?,assessment_json=? WHERE id='qa-assessment'").bind(key,JSON.stringify({draft:f.draft,provenance:{validationPassed:false,validationErrors:["fixture invalid"]}})).run();
 const r=await api("reviewer","/api/assessments/generate",{submissionId:"qa-submission"});
 assert.equal(r.status,422,await r.clone().text());
 assert.ok((await r.json() as {error:string}).error.includes("chấm thủ công"));
});
test("score zero can be approved as a grade but is recorded as ineligible, never allocated",async()=>{
 assert.equal((await api("reviewer","/api/assessments/manual",{action:"start",submissionId:"qa-submission"})).status,200);
 const r=await api("reviewer","/api/assessments/manual",{action:"decide",assessmentId:"qa-assessment",decision:"approved",finalDraft:{summary:"No evidence",rubric:RUBRIC.map(x=>({id:x.id,score:0,rationale:"No evidence for this criterion"}))}});
 assert.equal(r.status,200);
 const built=await api("reviewer",url,{action:"record_result",senderWallet:f.w.reviewer,submissionId:"qa-submission"});
 assert.equal(built.status,200);const data=await built.json() as {transaction:string};const bytes=Buffer.from(data.transaction,"base64");const at=bytes.indexOf(await disc("global:record_result"));assert.ok(at>=0);assert.equal(bytes[at+8],0);
 assert.equal((await api("reviewer",url,{action:"allocate_award",senderWallet:f.w.reviewer,submissionId:"qa-submission"})).status,409);
});
test("sync reports postconditions rather than treating any account as funded",async()=>{
 f.control.funded=BigInt(0);f.control.phase=0;await f.resetMirror();
 const r=await api("reviewer",url,{action:"sync"});assert.equal(r.status,200);const d=await r.json() as {funded:boolean;operationComplete:boolean;detail:unknown};assert.equal(d.funded,false);assert.equal(d.operationComplete,false);assert.ok(d.detail);
 f.control.funded=BigInt(50000000);f.control.phase=1;await f.resetMirror();
});
test("pending history and wrong operation preserve recovery without false success",async()=>{
 const built=await api("reviewer",url,{action:"record_result",senderWallet:f.w.reviewer,submissionId:"qa-submission"});
 const op=await built.json() as {operationId:string};const payload={action:"sync",signature:"11111111111111111111111111111111",operationId:op.operationId};
 f.control.finalized=false;assert.equal((await (await api("reviewer",url,payload)).json() as {code:string}).code,"NOT_FINALIZED");
 f.control.finalized=true;f.control.missingTx=true;assert.equal((await (await api("reviewer",url,payload)).json() as {code:string}).code,"TX_NOT_FOUND");
 f.control.missingTx=false;f.control.wrongAction=true;assert.equal((await api("reviewer",url,payload)).status,409);f.control.wrongAction=false;
});
test("positive review to allocation to claim completes matching operations and survives repeated sync",async()=>{
 f.control.decision=0;f.control.paid=false;await f.resetMirror();
 await f.db.prepare("UPDATE submissions SET state='in_review' WHERE id='qa-submission'").run();
 await f.db.prepare("UPDATE assessments SET status='in_review',assessment_mode='manual' WHERE id='qa-assessment'").run();
 const approved=await api("reviewer","/api/assessments/manual",{action:"decide",assessmentId:"qa-assessment",decision:"approved",finalDraft:{summary:"Complete supporting evidence",rubric:RUBRIC.map(x=>({id:x.id,score:x.maxScore,rationale:"Evidence supports this criterion"}))}});
 assert.equal(approved.status,200);
 for(const [role,action,next] of [["reviewer","record_result",1],["reviewer","allocate_award",3],["student","claim_award",3]] as const){
  const built=await api(role,url,{action,senderWallet:f.w[role],submissionId:"qa-submission"});assert.equal(built.status,200,await built.clone().text());
  const op=await built.json() as {operationId:string};
  const expected=await f.db.prepare("SELECT instructions_json FROM escrow_operation_expectations WHERE operation_id=?").bind(op.operationId).first<{instructions_json:string}>();
  f.control.instructions=(JSON.parse(expected!.instructions_json) as Array<{data:string;accounts:string[]}>).map(ix=>({...ix,programId:ESCROW_PROGRAM}));
  f.control.action=action;f.control.decision=next;if(action==="claim_award")f.control.paid=true;
  const signature="test"+(await hashBytes(action)).toString("hex");
  for(let retry=0;retry<2;retry++){
   const verified=await api(role,url,{action:"sync",operationId:op.operationId,signature});
   assert.equal(verified.status,200,await verified.clone().text());
   assert.equal((await verified.json() as {operationComplete:boolean}).operationComplete,true);
  }
 }
 f.control.instructions=null;
});
test("record allocation claim snapshots agree on payouts, including external claims",async()=>{
 f.control.decision=3;f.control.paid=true;await f.resetMirror();
 const r=await api("reviewer",url);assert.equal(r.status,200);
 const payout=await api("reviewer","/api/payouts");assert.equal(payout.status,200);
 const rows=(await payout.json() as {payouts:Array<{payout_status:string;chain_verified:boolean}>}).payouts;
 assert.equal(rows[0].payout_status,"paid");assert.equal(rows[0].chain_verified,true);
 const student=await (await api("student",url)).json() as {dbSubmissions:Array<{progress:{phase:string;action:string|null}}>};
 assert.equal(student.dbSubmissions[0].progress.phase,"paid");assert.equal(student.dbSubmissions[0].progress.action,null);
 assert.equal(f.methods.filter(x=>x==="sendTransaction").length,0);
});
