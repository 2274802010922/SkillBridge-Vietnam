import { getAttestationDecoder, getSchemaDecoder, getCredentialDecoder, deserializeAttestationData, deriveAttestationPda, SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as SAS } from "sas-lib";
import { assertEscrowDevnet, escrowRpc } from "../client/challenge-escrow.ts";
export type ProofCheck={state:"active"|"invalid"|"unavailable";checkedAt:string;reason:string};
export async function verifyPortfolioCredential(rpc:string,expected:{attestation_address:string;schema_address:string;credential_address:string;student_wallet:string;challenge_id:string;evidence_hash:string;score:string}):Promise<ProofCheck>{
  const checkedAt=new Date().toISOString(),invalid=(reason:string):ProofCheck=>({state:"invalid",checkedAt,reason});
  try{
    await assertEscrowDevnet(rpc);
    const response=await escrowRpc<{value:Array<{owner:string;data:[string,string]}|null>}>(rpc,"getMultipleAccounts",[[expected.attestation_address,expected.schema_address,expected.credential_address],{encoding:"base64",commitment:"finalized"}]);
    if(response.value.length!==3)throw new Error("Incomplete RPC response");
    if(response.value.some(x=>!x))return invalid("REVOKED_OR_MISSING");
    if(response.value.some(x=>x?.owner!==String(SAS)))return invalid("WRONG_OWNER");
    const bytes=response.value.map(x=>Buffer.from(x!.data[0],"base64"));
    const a=getAttestationDecoder().decode(bytes[0]),s=getSchemaDecoder().decode(bytes[1]),c=getCredentialDecoder().decode(bytes[2]);
    if(a.discriminator!==0||s.discriminator!==2||c.discriminator!==1)return invalid("WRONG_TYPE");
    const [pda]=await deriveAttestationPda({credential:a.credential,schema:a.schema,nonce:a.nonce});
    if(String(pda)!==expected.attestation_address||a.schema!==expected.schema_address||a.credential!==expected.credential_address||s.credential!==a.credential)return invalid("WRONG_ISSUER");
    if(s.isPaused||(a.expiry!==BigInt(0)&&a.expiry<=BigInt(Math.floor(Date.now()/1000)))||!(c.authority===a.signer||c.authorizedSigners.includes(a.signer)))return invalid("INACTIVE");
    const data=deserializeAttestationData(s,a.data as Uint8Array) as Record<string,unknown>;
    if(data.studentWallet!==expected.student_wallet||data.challengeId!==expected.challenge_id||data.evidenceHash!==expected.evidence_hash||data.overallScore!==Number(expected.score)||data.humanApproved!==true)return invalid("PAYLOAD_MISMATCH");
    return {state:"active",checkedAt,reason:"FINALIZED_MATCH"};
  }catch{return {state:"unavailable",checkedAt,reason:"RPC_UNAVAILABLE"};}
}
