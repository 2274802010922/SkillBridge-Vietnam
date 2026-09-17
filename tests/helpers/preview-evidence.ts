// Local-only visual QA. Never imported by app routes; binds to loopback only.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { competitionFixture } from "./competition-fixture.ts";
import { savePack, grantPack } from "../../backend/services/portfolios/packs.ts";
const fixture=await competitionFixture();await fixture.addCredential();
await fixture.db.prepare("UPDATE assessments SET status='approved',final_result_hash='qa-final'").run();
await fixture.db.prepare("INSERT INTO evidence_publication_permissions(assessment_id,allowed,actor_id) VALUES('qa-assessment',1,'reviewer')").run();
await fixture.db.prepare("INSERT INTO opportunity_applications(id,opportunity_id,user_id,credential_id,wallet_address,profile_json,verification_json) SELECT 'qa-app','qa-opportunity','student','qa-credential',student_wallet,?, '{}' FROM skill_credentials WHERE id='qa-credential'").bind(JSON.stringify({displayName:"Minh Anh · QA",introduction:"Ứng viên minh họa từ bài làm nghiên cứu khách hàng.",portfolio:""})).run();
await fixture.db.prepare("INSERT INTO opportunity_applications(id,opportunity_id,user_id,credential_id,wallet_address,profile_json,verification_json) SELECT 'qa-other','qa-opportunity','outsider','qa-credential',address,?, '{}' FROM wallets WHERE user_id='outsider'").bind(JSON.stringify({displayName:"Ứng viên B · QA",introduction:"Ứng viên minh họa: chứng nhận không khớp ví, cần kiểm tra.",portfolio:""})).run();
const pack=await savePack(fixture.db,"student",{title:"Marketing intern · Dữ liệu QA",purpose:"employment",target:"Nghiên cứu khách hàng và giải thích quyết định từ bằng chứng.",introduction:"Đây là hồ sơ kiểm thử. Tôi dùng kết quả đánh giá để trình bày bài làm nghiên cứu khách hàng, không phải dữ liệu người dùng thật.",sources:[{kind:"assessment",id:"qa-assessment"}]});
await grantPack(fixture.db,"student",pack.id,"qa-app");
const child=spawn(process.execPath,["--import","./tests/helpers/mock-career-ai.mjs","node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3342"],{env:{...process.env,TURSO_DATABASE_URL:fixture.dbUrl,TURSO_AUTH_TOKEN:"",SOLANA_RPC_URL:fixture.rpc,OPENROUTER_API_KEY:"test-only",OPENROUTER_MODEL:"qa/fixture",BLOB_STORE_ID:"",BLOB_READ_WRITE_TOKEN:""},stdio:"ignore"});
for(let i=0;i<80;i++){try{if((await fetch("http://127.0.0.1:3342")).ok)break;}catch{/* Wait for the local QA server. */}await new Promise(r=>setTimeout(r,300));}
const proxy=createServer(async(req,res)=>{
  const role=req.url?.match(/^\/__qa\/(student|employer|reviewer)/)?.[1];
  if(role){res.writeHead(302,{"set-cookie":fixture.cookies[role]+"; Path=/; HttpOnly; SameSite=Lax",location:role==="student"?`/app/profile/packs/${pack.id}`:role==="employer"?"/app/opportunities/qa-opportunity":"/app/reviews"});res.end();return;}
  try{
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value&&key!=="host")headers.set(key,Array.isArray(value)?value.join(","):value);
    if(headers.get("origin")==="http://127.0.0.1:3343")headers.set("origin","http://127.0.0.1:3342");
    const response=await fetch("http://127.0.0.1:3342"+(req.url??"/"),{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined,redirect:"manual"});
    res.statusCode=response.status;response.headers.forEach((v,k)=>{if(!["content-encoding","content-length","transfer-encoding"].includes(k))res.setHeader(k,v);});res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(502);res.end("Local QA upstream unavailable");}
});
proxy.listen(3343,"127.0.0.1",()=>console.log("Local fixture ready: http://127.0.0.1:3343/__qa/student (also employer/reviewer). Mock AI and RPC; no live transactions."));
async function stop(){proxy.close();child.kill();await fixture.stop();process.exit();}
process.on("SIGINT",()=>void stop());process.on("SIGTERM",()=>void stop());
