import test from "node:test";
import assert from "node:assert/strict";
import { rewardProgress,operationSatisfied } from "../../shared/validation/reward-progress.ts";
import { rewardEligibility } from "../../backend/services/escrow/reward-assessment.ts";
import { hashBytes } from "../../solana/client/challenge-escrow.ts";
import { requestJson } from "../../backend/ai/assessment-engine.ts";
import { evidenceMime,validTextEvidence } from "../../shared/validation/evidence-file.ts";
import { apiFetch } from "../../frontend/lib/api-fetch.ts";
import { recoverBootstrapStep } from "../../backend/services/credentials/bootstrap-recovery.ts";
import { createMemoryDatabaseForTests } from "../../backend/database/adapters/d1-adapter.ts";
import { ensureCoreSchema } from "../../backend/database/schema/core-schema.ts";
const config={funder:"owner",reviewer:"primary",backup:"backup",amount:"50",slots:1,submitDeadline:100,reviewDeadline:200};
const state={state:1,accepted:3,funded:"50",allocated:"0",paid:"0",refunded:"0",submissions:1,resolved:0};
test("reviewer switches only after the review deadline and pending reasons remain visible",()=>{
 for(const [time,actor] of [[101,"primary"],[200,"primary"],[201,"backup"]] as const){
   const p=rewardProgress(config,state,{decision:0,paid:false},"approved",true,"student",actor,time);
   assert.equal(p.action,"record_result");assert.equal(p.available,true);assert.equal(p.actor,actor);
 }
 assert.equal(rewardProgress(config,state,{decision:0,paid:false},"approved",true,"student","primary",201).available,false);
 assert.equal(rewardProgress(config,state,{decision:0,paid:false},"approved",true,"student","primary",100).action,null);
 assert.equal(rewardProgress(config,{...state,state:2},{decision:3,paid:false},"approved",true,"student","student",300).action,"claim_award");
 assert.equal(rewardProgress(config,state,{decision:3,paid:true},"approved",true,"student","student",300).phase,"paid");
});
test("account existence never proves a funded operation or a claim",()=>{
 assert.equal(operationSatisfied("initialize",config,{...state,funded:"0"}),false);
 assert.equal(operationSatisfied("claim_award",config,state,{decision:3,paid:false}),false);
 assert.equal(operationSatisfied("record_result",config,state,{decision:0,paid:false}),false);
});
test("official hash and committed score threshold define eligibility, not approval alone",async()=>{
 const finalDraft={totalScore:0};const final_result_hash=(await hashBytes(JSON.stringify(finalDraft))).toString("hex");
 const input={assessment_status:"approved",final_result_hash,review_json:JSON.stringify({finalDraft}),termsText:JSON.stringify({minimumScore:80})};
 assert.equal(await rewardEligibility(input),false);
 assert.equal(await rewardEligibility({...input,termsText:JSON.stringify({minimumScore:0})}),true);
 assert.equal(await rewardEligibility({...input,final_result_hash:"tampered"}),null);
 assert.equal(await rewardEligibility({...input,termsText:"{}"}),null);
});
test("Markdown MIME fallback rejects binary disguised as text",()=>{
 assert.equal(evidenceMime("evidence.md",""),"text/markdown");
 assert.equal(evidenceMime("evidence.md","application/octet-stream"),"text/markdown");
 assert.equal(validTextEvidence(new Uint8Array([0,255]),"text/markdown"),false);
 assert.equal(validTextEvidence(new TextEncoder().encode("# Bài làm"),"text/markdown"),true);
});
test("OpenRouter distinguishes provider, length, refusal, empty and timeout failures",async()=>{
 const previous=globalThis.fetch;
 try{
 for(const [body,pattern] of [
  [{error:{code:503}},/Nhà cung cấp/],
  [{choices:[{finish_reason:"length",message:{content:null}}]},/giới hạn đầu ra/],
  [{choices:[{message:{refusal:"no"}}]},/từ chối/],
  [{choices:[{message:{content:null}}]},/không trả nội dung/],
  [{choices:[{message:{content:"bad json"}}]},/JSON không hợp lệ/],
 ] as const){
  globalThis.fetch=async()=>Response.json(body);
  await assert.rejects(()=>requestJson({OPENROUTER_API_KEY:"test",OPENROUTER_MODEL:"test/model"},"test",{},"test",{}),pattern);
 }
 globalThis.fetch=async()=>{throw new DOMException("timeout","TimeoutError")};
 await assert.rejects(()=>requestJson({OPENROUTER_API_KEY:"test",OPENROUTER_MODEL:"test/model"},"test",{},"test",{}),/thời gian/);
 }finally{globalThis.fetch=previous;}
});
test("frontend reports text and HTML errors without JSON parse failures",async()=>{
 const old=globalThis.fetch;
 try{
 globalThis.fetch=async()=>new Response("Wallet mismatch",{status:403});
 assert.equal(((await (await apiFetch("/test")).json()) as {error:string}).error,"Wallet mismatch");
 globalThis.fetch=async()=>new Response("<html>bad gateway</html>",{status:502});
 assert.equal((await apiFetch("/test")).status,502);
 }finally{globalThis.fetch=old;}
});
test("bootstrap persists bytes before send and recovers a lost response without preparing twice",async()=>{
 const db=createMemoryDatabaseForTests();await ensureCoreSchema(db);
 let exists=false,prepared=0,broadcasts=0;
 const chain={exists:async()=>exists,prepare:async()=>{prepared++;return{wire:"signed",signature:"sig",lastValidBlockHeight:10};},
 inspect:async()=> "absent" as const,broadcast:async()=>{broadcasts++;const row=await db.prepare("SELECT prepared_json FROM issuer_bootstrap_steps").first();assert.ok(row?.prepared_json);exists=true;throw Error("network lost");}};
 await assert.rejects(()=>recoverBootstrapStep(db,"issuer:credential","fingerprint",chain),/network lost/);
 assert.equal(await recoverBootstrapStep(db,"issuer:credential","fingerprint",chain),"sig");
 assert.equal(prepared,1);assert.equal(broadcasts,1);
 await assert.rejects(()=>recoverBootstrapStep(db,"issuer:credential","different",chain));
});

test("milestone signature claims prevent replay and retain idempotency under concurrent verification",async()=>{
 const {competitionFixture}=await import("../helpers/competition-fixture.ts");
 const {verifyMilestone}=await import("../../backend/services/payments/milestone-payment.ts");
 const f=await competitionFixture();
 try {
  await f.db.prepare("INSERT INTO freelance_contracts(id,organization_id,created_by_user_id,freelancer_user_id,title,description,total_amount_usdc,total_amount_atomic,status) VALUES('ct','issuer','reviewer','student','test','test','2','2000000','active')").run();
  await f.db.prepare("INSERT INTO contract_milestones(id,contract_id,title,amount_usdc,amount_atomic,position,status) VALUES('m1','ct','one','1','1000000',1,'approved'),('m2','ct','two','1','1000000',2,'approved')").run();
  const intent={sender:"sender",recipient:"recipient",mint:"mint",amountAtomic:"1000000",reference:"reference",network:"solana:devnet" as const};
  const verify=async(input:Parameters<NonNullable<Parameters<typeof verifyMilestone>[5]>>[0])=>{
    assert.equal(input.requireFinalized,true);assert.equal(input.expectedSenderWallet,intent.sender);assert.equal(input.expectedReference,intent.reference);
    return {signature:input.signature,senderWallet:"sender",recipientWallet:"recipient",amountAtomic:"1000000",observedAt:new Date().toISOString(),blockTime:1,referenceMatched:true};
  };
  const results=await Promise.allSettled([verifyMilestone(f.db,"m1","sig",intent,"rpc",verify),verifyMilestone(f.db,"m2","sig",intent,"rpc",verify)]);
  assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
  const paid=await f.db.prepare("SELECT id FROM contract_milestones WHERE status='paid'").all<{id:string}>();assert.equal(paid.results.length,1);
  assert.equal((await verifyMilestone(f.db,paid.results[0].id,"sig",intent,"rpc",verify)).reused,true);
 }finally{await f.stop();}
});
test("database trigger blocks late file metadata after escrow snapshot lock",async()=>{
 const {competitionFixture}=await import("../helpers/competition-fixture.ts");const f=await competitionFixture();
 try{
  await f.db.prepare("INSERT INTO escrow_submission_locks(submission_id,challenge_id,student_wallet,evidence_hash) VALUES('qa-submission','qa-challenge','wallet','hash')").run();
  await assert.rejects(()=>f.db.prepare("DELETE FROM submission_files WHERE id='qa-file'").run(),/immutable/);
  await assert.rejects(()=>f.db.prepare("UPDATE submission_files SET sha256='changed' WHERE id='qa-file'").run(),/immutable/);
  assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM submission_files WHERE id='qa-file'").first<{n:number}>())?.n,1);
 }finally{await f.stop();}
});
