import test from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { address, getTransactionDecoder } from "gill";
import { getSchemaEncoder,getCredentialEncoder,getAttestationEncoder,serializeAttestationData,SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as SAS } from "sas-lib";
import { issuanceTransport } from "../../solana/server/credential-issuance.ts";
test("issuance transport signs persisted bytes and rejects mismatched finalized SAS payloads",async()=>{
  const payer=nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(1)),signer=nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(2));
  const key=(n:number)=>address(bs58.encode(new Uint8Array(32).fill(n)));
  const credential=key(30),schemaKey=key(31);
  const fields=["studentWallet","challengeId","overallScore","evidenceHash","reviewerRole","humanApproved"];
  const fieldNames=Buffer.concat(fields.map(f=>{const b=Buffer.from(f),size=Buffer.alloc(4);size.writeUInt32LE(b.length);return Buffer.concat([size,b]);}));
  const schema={discriminator:2,credential,name:Buffer.from("PROOF-OF-SKILL"),description:Buffer.from("QA"),fieldNames,layout:new Uint8Array([12,12,0,12,12,10]),version:1,isPaused:false};
  const account=(bytes:ArrayLike<number>)=>({owner:String(SAS),data:[Buffer.from(bytes).toString("base64"),"base64"]});
  const accounts=new Map<string,ReturnType<typeof account>>([
    [String(schemaKey),account(getSchemaEncoder().encode(schema))],
    [String(credential),account(getCredentialEncoder().encode({discriminator:1,authority:address(bs58.encode(payer.publicKey)),name:Buffer.from("QA"),authorizedSigners:[address(bs58.encode(signer.publicKey))]}))],
  ]);
  let finalized=false,submitted="";
  const original=globalThis.fetch;
  globalThis.fetch=(async(_url,init)=>{
    const b=JSON.parse(String(init?.body));let result:unknown;
    if(b.method==="getGenesisHash")result="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
    else if(b.method==="getAccountInfo")result={context:{slot:1},value:accounts.get(b.params[0])??null};
    else if(b.method==="getLatestBlockhash")result={context:{slot:1},value:{blockhash:String(key(4)),lastValidBlockHeight:100}};
    else if(b.method==="getSignatureStatuses")result={context:{slot:1},value:[finalized?{confirmationStatus:"finalized",err:null}:null]};
    else if(b.method==="getBlockHeight")result=10;
    else if(b.method==="sendTransaction"){submitted=b.params[0];result=bs58.encode(Buffer.from(submitted,"base64").subarray(1,65));}
    else throw new Error("Unexpected RPC: "+b.method);
    return Response.json({jsonrpc:"2.0",id:b.id,result});
  }) as typeof fetch;
  try{
    const chain=issuanceTransport({SOLANA_RPC_URL:"http://qa.invalid",SOLANA_FEE_PAYER_SECRET:JSON.stringify([...payer.secretKey]),SOLANA_ISSUER_SECRET:JSON.stringify([...payer.secretKey]),SOLANA_AUTHORIZED_SIGNER_SECRET:JSON.stringify([...signer.secretKey])});
    const p={assessmentId:"qa",challengeId:"challenge",organizationId:"org",studentUserId:"student",studentWallet:String(key(10)),credentialAddress:String(credential),schemaAddress:String(schemaKey),score:80,evidenceHash:"hash",resultHash:"result",reviewerRole:"HUMAN",skills:[],expiryUnix:Math.floor(Date.now()/1000)+3600};
    const tx=await chain.prepare(p),decoded=getTransactionDecoder().decode(Buffer.from(tx.wire,"base64"));
    for(const k of [payer,signer])assert.ok(nacl.sign.detached.verify(new Uint8Array(decoded.messageBytes),new Uint8Array(decoded.signatures[address(bs58.encode(k.publicKey))]!),k.publicKey));
    assert.equal(await chain.inspect(p,tx),"absent");await chain.broadcast(tx);assert.equal(submitted,tx.wire);
    const data={studentWallet:p.studentWallet,challengeId:p.challengeId,overallScore:p.score,evidenceHash:p.evidenceHash,reviewerRole:p.reviewerRole,humanApproved:true};
    const attestation=(score:number)=>account(getAttestationEncoder().encode({discriminator:0,nonce:address(tx.nonceAddress),credential,schema:schemaKey,data:serializeAttestationData(schema,{...data,overallScore:score}),signer:address(tx.signer),expiry:BigInt(p.expiryUnix),tokenAccount:key(11)}));
    accounts.set(tx.attestationAddress,attestation(80));finalized=true;
    assert.equal(await chain.inspect(p,tx),"finalized");
    accounts.set(tx.attestationAddress,attestation(81));assert.equal(await chain.inspect(p,tx),"mismatch");
    accounts.delete(tx.attestationAddress);assert.equal(await chain.inspect(p,tx),"mismatch");
  }finally{globalThis.fetch=original;}
});
