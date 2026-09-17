import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { competitionFixture } from "../helpers/competition-fixture.ts";
import { reserveIssuance } from "../../backend/services/credentials/issuance.ts";
let fixture:Awaited<ReturnType<typeof competitionFixture>>,server:ChildProcess;
const base="http://127.0.0.1:3241";
before(async()=>{
  fixture=await competitionFixture();await fixture.addCredential();
  await fixture.db.prepare("UPDATE assessments SET status='approved',final_result_hash='official-qa' WHERE id='qa-assessment'").run();
  server=spawn(process.execPath,["--import","./tests/helpers/mock-career-ai.mjs","node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3241"],{env:{...process.env,NODE_ENV:"production",TURSO_DATABASE_URL:fixture.dbUrl,TURSO_AUTH_TOKEN:"",SOLANA_RPC_URL:fixture.rpc,OPENROUTER_API_KEY:"test-only",OPENROUTER_MODEL:"qa/fixture",BLOB_STORE_ID:"",BLOB_READ_WRITE_TOKEN:""},stdio:"ignore"});
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)return;}catch{/* Wait for Next.js readiness. */}await new Promise(r=>setTimeout(r,300));}throw Error("Portfolio QA server unavailable");
});
after(async()=>{if(server?.exitCode===null){server.kill();await new Promise(r=>server.once("exit",r));}await fixture?.stop();});
async function api(role:string,path:string,body?:unknown,method=body?"POST":"GET"){
  return fetch(base+path,{method,headers:{cookie:fixture.cookies[role]??"","content-type":"application/json"},body:body?JSON.stringify(body):undefined});
}
test("portfolio HTTP journey isolates sources, requires review permission, caches AI and revokes sharing",async()=>{
  assert.equal((await api("","/api/portfolio/packs")).status,401);
  const catalog=await (await api("student","/api/portfolio/packs")).json() as {sources:Array<{id:string;kind:string;shareable:boolean}>};
  const source=catalog.sources.find(s=>s.kind==="assessment")!;assert.ok(source);assert.equal(source.shareable,false);
  const input={title:"Portfolio QA",purpose:"employment",target:"Research evidence",introduction:"Owner-approved introduction",sources:[{kind:source.kind,id:source.id}]};
  const created=await api("student","/api/portfolio/packs",input);assert.equal(created.status,201);
  const {id}=await created.json() as {id:string};
  assert.equal((await api("outsider",`/api/portfolio/packs/${id}`)).status,404);
  assert.equal((await api("outsider",`/api/portfolio/packs/${id}`,{...input,version:1},"PATCH")).status,404);
  assert.equal((await api("student",`/api/portfolio/packs/${id}/share`,{action:"publish",version:1,consent:true})).status,409);
  assert.equal((await api("student",`/api/portfolio/sources/${source.id}/permission`,{allowed:true},"PATCH")).status,403);
  assert.equal((await api("reviewer",`/api/portfolio/sources/${source.id}/permission`,{allowed:true},"PATCH")).status,200);
  assert.equal((await api("student",`/api/portfolio/packs/${id}`,{...input,version:1},"PATCH")).status,200);
  const aiInput={packId:id,version:2,locale:"en",consent:true};
  const ai=await api("student","/api/career-assistance",aiInput);assert.equal(ai.status,200,await ai.clone().text());
  const result=await ai.json() as {id:string;result:{claims:unknown[]};cached:boolean};assert.equal(result.result.claims.length,1);assert.equal(result.cached,false);
  const cached=await (await api("student","/api/career-assistance",aiInput)).json() as {cached:boolean};assert.equal(cached.cached,true);
  assert.equal((await api("outsider","/api/career-assistance/"+result.id)).status,404);
  const usage=await (await api("student","/api/features/usage")).json() as {aiUsed:number};assert.equal(usage.aiUsed,1);
  assert.equal((await api("student",`/api/portfolio/packs/${id}/share`,{action:"publish",version:2,consent:true})).status,200);
  const publicPack=await (await api("",`/api/portfolio/packs/${id}?public=1`)).json() as {content:{target:string};sources:unknown[]};assert.equal(publicPack.content.target,"");assert.equal(publicPack.sources.length,1);
  assert.equal((await api("student",`/api/portfolio/packs/${id}`,{...input,version:2,target:"INVALID_QUOTE_QA"},"PATCH")).status,200);
  const invalid=await api("student","/api/career-assistance",{...aiInput,version:3});assert.equal(invalid.status,500);
  assert.equal(((await (await api("student","/api/features/usage")).json()) as {aiUsed:number}).aiUsed,1);
  assert.equal((await api("reviewer",`/api/portfolio/sources/${source.id}/permission`,{allowed:false},"PATCH")).status,200);
  assert.equal((await api("",`/api/portfolio/packs/${id}?public=1`)).status,409);
  assert.equal((await api("student","/api/career-assistance/"+result.id)).status,409);
});
test("credential portfolio rechecks the chain and does not call a missing account active",async()=>{
  const input={title:"Credential QA",purpose:"freelance",target:"Work",introduction:"Evidence",sources:[{kind:"credential",id:"qa-credential"}]};
  const r=await api("student","/api/portfolio/packs",input);assert.equal(r.status,201);const {id}=await r.json() as {id:string};
  const before=await (await api("student",`/api/portfolio/packs/${id}`)).json() as {sources:Array<{verification:{state:string}}>};assert.equal(before.sources[0].verification.state,"active");
  fixture.revoke();
  const after=await (await api("student",`/api/portfolio/packs/${id}`)).json() as {sources:Array<{verification:{state:string}}>};assert.equal(after.sources[0].verification.state,"invalid");
});
test("employer comparison, notes, events and issuance status remain organization scoped",async()=>{
  await fixture.db.prepare("INSERT INTO opportunity_applications(id,opportunity_id,user_id,credential_id,wallet_address,profile_json,verification_json) SELECT 'app-student','qa-opportunity','student','qa-credential',student_wallet,'{\"displayName\":\"QA\",\"introduction\":\"QA candidate\"}','{}' FROM skill_credentials WHERE id='qa-credential'").run();
  const path="/api/opportunities/qa-opportunity/comparison?applicationId=app-student";
  assert.equal((await api("outsider",path)).status,403);
  assert.equal((await api("employer",path)).status,200);
  assert.equal((await api("employer","/api/opportunities/qa-opportunity/comparison",{applicationId:"app-student",note:"Private decision note"})).status,200);
  assert.equal((await api("student","/api/opportunities/qa-opportunity/comparison",{applicationId:"app-student",note:"Not authorized"})).status,403);
  for(let i=0;i<2;i++)assert.equal((await api("employer","/api/opportunities/qa-opportunity/applications",{applicationId:"app-student",action:"reviewing"},"PATCH")).status,200);
  assert.equal((await fixture.db.prepare("SELECT COUNT(*) AS n FROM application_events WHERE application_id='app-student'").first<{n:number}>())?.n,1);
  assert.equal((await api("employer","/api/opportunities/qa-opportunity/applications",{applicationId:"app-student",action:"shortlisted"},"PATCH")).status,409);
  await fixture.db.prepare("UPDATE feature_trials SET expires_at='2000-01-01' WHERE scope_id='org:employer'").run();
  assert.equal((await api("employer",path)).status,403);
  const records=await (await api("employer","/api/opportunities/qa-opportunity/applications")).json() as {applications:Array<{notes:unknown[]}>};assert.equal(records.applications[0].notes.length,1);
  // Separate assessment operation: do not create/broadcast any real transaction.
  await fixture.db.prepare("INSERT INTO participations(id,challenge_id,student_user_id) VALUES('qa-p-operation','qa-challenge','outsider')").run();
  await fixture.db.prepare("INSERT INTO submissions(id,participation_id) VALUES('qa-s-operation','qa-p-operation')").run();
  await fixture.db.prepare("INSERT INTO assessments(id,submission_id,provider,model,schema_version,assessment_json,ai_result_hash,final_result_hash,status) VALUES('qa-operation','qa-s-operation','manual','human','1','{}','h','f','approved')").run();
  await fixture.db.prepare("UPDATE challenges SET reward_slots=3 WHERE id='qa-challenge'").run();
  await reserveIssuance(fixture.db,{assessmentId:"qa-operation",challengeId:"qa-challenge",organizationId:"issuer",studentUserId:"outsider",studentWallet:"wallet",credentialAddress:"issuer",schemaAddress:"schema",score:80,evidenceHash:"hash",resultHash:"f",reviewerRole:"HUMAN",skills:[]});
  assert.equal((await api("employer","/api/credentials/operations/qa-operation")).status,403);
  const op=await api("outsider","/api/credentials/operations/qa-operation");assert.equal(op.status,200);assert.ok(!(await op.text()).includes("payload_json"));
  assert.equal((await api("outsider","/api/credentials/operations/qa-operation",{})).status,403);
});
