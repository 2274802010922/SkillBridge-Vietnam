// Isolated browser QA only; no live RPC, provider or wallet signing.
import {reliabilityFixture} from "./reliability-fixture.ts";
import {spawn} from "node:child_process";
import {hashBytes} from "../../solana/client/challenge-escrow.ts";
const f=await reliabilityFixture();
const draft={...f.draft};const hash=(await hashBytes(JSON.stringify(draft))).toString("hex");
await f.db.prepare("UPDATE assessments SET status='approved',final_result_hash=? WHERE id='qa-assessment'").bind(hash).run();
await f.db.prepare("UPDATE submissions SET state='approved' WHERE id='qa-submission'").run();
await f.db.prepare("INSERT INTO reviews(id,assessment_id,reviewer_user_id,decision,review_json) VALUES('qa-approved','qa-assessment','reviewer','approved',?)").bind(JSON.stringify({finalDraft:draft})).run();
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3266"],{env:{...process.env,NODE_ENV:"production",OPENROUTER_API_KEY:"",GEMINI_API_KEY:"",OPENAI_API_KEY:"",TOKENROUTER_API_KEY:"",TURSO_DATABASE_URL:f.dbUrl,TURSO_AUTH_TOKEN:"",SOLANA_RPC_URL:f.rpc,BLOB_STORE_ID:"",BLOB_READ_WRITE_TOKEN:""},stdio:"ignore"});
console.log(JSON.stringify({origin:"http://localhost:3266",cookies:f.cookies}));
process.once("SIGINT",()=>void stop());
process.once("SIGTERM",()=>void stop());
async function stop(){server.kill();await f.stop();process.exit(0);}
