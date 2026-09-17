import assert from "node:assert/strict";
import test from "node:test";
import { credentialFixture } from "../helpers/credential-fixture.ts";
import { reserveIssuance, recoverIssuance, issuanceOperation, publicIssuance,
  type IssuanceRequest, type IssuanceTransport, type PreparedIssuance } from "../../backend/services/credentials/issuance.ts";

function input(id="a"): IssuanceRequest {
  return {assessmentId:id,challengeId:"challenge",organizationId:"org",studentUserId:id==="a"?"student":"student-b",studentWallet:"wallet",credentialAddress:"issuer",schemaAddress:"schema",score:90,evidenceHash:"hash",resultHash:"final",reviewerRole:"BUSINESS_HUMAN_REVIEWER",skills:[]};
}
function fakeChain(){
  let status:Awaited<ReturnType<IssuanceTransport["inspect"]>>="absent",prepared=0,sent=0;
  const tx:PreparedIssuance={wire:"signed-wire-private",signature:"signature",nonceAddress:"nonce",attestationAddress:"attestation",lastValidBlockHeight:10,signer:"signer"};
  const chain:IssuanceTransport={prepare:async()=>{prepared++;return tx;},inspect:async()=>status,broadcast:async()=>{sent++;status="pending";}};
  return {chain,set:(next:typeof status)=>{status=next;},counts:()=>({prepared,sent}),tx};
}
test("atomic credential reservation prevents two assessments consuming the last slot",async()=>{
  const db=await credentialFixture();
  const result=await Promise.allSettled([reserveIssuance(db,input("a")),reserveIssuance(db,input("b"))]);
  assert.equal(result.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM credential_issuance_operations").first<{n:number}>())?.n,1);
});
test("same assessment retries share a reservation and frozen expiry",async()=>{
  const db=await credentialFixture();
  const rows=await Promise.all([reserveIssuance(db,input()),reserveIssuance(db,input())]);
  assert.equal(rows[0].payload_json,rows[1].payload_json);
  await assert.rejects(reserveIssuance(db,{...input(),score:99}));
});
test("wire is durable before broadcast; finalized recovery is idempotent and private",async()=>{
  const db=await credentialFixture(),f=fakeChain();await reserveIssuance(db,input());
  const broadcast=f.chain.broadcast;
  f.chain.broadcast=async tx=>{assert.ok((await issuanceOperation(db,"a"))?.prepared_json?.includes(tx.wire));await broadcast(tx);};
  const pending=await recoverIssuance(db,"a","owner",f.chain);
  assert.equal(pending.operation.status,"broadcast");assert.equal("credential" in pending,false);
  assert.ok(!JSON.stringify(publicIssuance((await issuanceOperation(db,"a"))!)).includes("signed-wire"));
  f.set("finalized");assert.ok((await recoverIssuance(db,"a","owner",f.chain)).credential);
  assert.ok((await recoverIssuance(db,"a","owner",f.chain)).credential);
  assert.deepEqual(f.counts(),{prepared:1,sent:1});
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='credential.issued'").first<{n:number}>())?.n,1);
});
test("chain success followed by DB failure recovers without preparing or sending again",async()=>{
  const db=await credentialFixture(),f=fakeChain();await reserveIssuance(db,input());
  await recoverIssuance(db,"a","owner",f.chain);f.set("finalized");
  const batch=db.batch.bind(db);db.batch=async()=>{throw new Error("Injected DB outage");};
  assert.equal((await recoverIssuance(db,"a","owner",f.chain)).operation.status,"finalized");
  db.batch=batch;
  assert.ok((await recoverIssuance(db,"a","owner",f.chain)).credential);
  assert.deepEqual(f.counts(),{prepared:1,sent:1});
});
test("RPC/broadcast timeout keeps capacity and original signed bytes",async()=>{
  const db=await credentialFixture(),f=fakeChain();await reserveIssuance(db,input());
  f.chain.broadcast=async()=>{throw new Error("Timeout after submission");};
  assert.equal((await recoverIssuance(db,"a","owner",f.chain)).operation.status,"broadcast");
  await assert.rejects(reserveIssuance(db,input("b")));
  f.set("finalized");assert.ok((await recoverIssuance(db,"a","owner",f.chain)).credential);
  assert.equal(f.counts().prepared,1);
});
test("concurrent recovery holds one lease and does not duplicate preparation",async()=>{
  const db=await credentialFixture(),f=fakeChain();await reserveIssuance(db,input());
  await Promise.all([recoverIssuance(db,"a","owner",f.chain),recoverIssuance(db,"a","owner",f.chain)]);
  assert.equal(f.counts().prepared,1);assert.equal(f.counts().sent,1);
});
test("revoked stored credentials are never resurrected",async()=>{
  const db=await credentialFixture(),f=fakeChain();await reserveIssuance(db,input());
  await recoverIssuance(db,"a","owner",f.chain);f.set("finalized");await recoverIssuance(db,"a","owner",f.chain);
  await db.prepare("UPDATE skill_credentials SET status='revoked'").run();
  const result=await recoverIssuance(db,"a","owner",f.chain);
  assert.equal(result.credential?.status,"revoked");assert.equal(f.counts().prepared,1);
});
test("mismatched accounts require review; safe blockhash expiry retains frozen payload",async()=>{
  const db=await credentialFixture(),f=fakeChain();const op=await reserveIssuance(db,input());
  f.set("expired");assert.equal((await recoverIssuance(db,"a","owner",f.chain)).operation.status,"reserved");
  assert.equal((await issuanceOperation(db,"a"))?.payload_json,op.payload_json);
  f.set("mismatch");assert.equal((await recoverIssuance(db,"a","owner",f.chain)).operation.status,"needs_review");
  await assert.rejects(reserveIssuance(db,input("b")));
});
