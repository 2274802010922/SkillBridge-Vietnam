import bs58 from "bs58";
import { address, createTransaction, transactionToBase64WithSigners } from "gill";
import { deriveAttestationPda, getCreateAttestationInstruction, getAttestationDecoder,
  getCredentialDecoder, getSchemaDecoder, serializeAttestationData, deserializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as SAS } from "sas-lib";
import { assertEscrowDevnet, escrowRpc, hashBytes } from "../client/challenge-escrow.ts";
import { solanaClient, solanaSigners } from "./solana-credentials.ts";
import type { IssuancePayload, IssuanceTransport, PreparedIssuance } from "../../backend/services/credentials/issuance.ts";

type Environment = Parameters<typeof solanaSigners>[0];
type Raw = {owner:string; data:[string,string]};
async function rawAccount(rpc: string, key: string) {
  const {value}=await escrowRpc<{value:Raw|null}>(rpc,"getAccountInfo",[key,{encoding:"base64",commitment:"finalized"}]);
  if (!value) return null;
  if (value.owner!==String(SAS)) throw new Error("SAS_OWNER_MISMATCH");
  return Buffer.from(value.data[0],"base64");
}
function fields(p: IssuancePayload) {
  return {studentWallet:p.studentWallet,challengeId:p.challengeId,overallScore:p.score,evidenceHash:p.evidenceHash,reviewerRole:p.reviewerRole,humanApproved:true};
}
export function issuanceTransport(env: Environment): IssuanceTransport {
  const rpc=env.SOLANA_RPC_URL||"https://api.devnet.solana.com";
  return {
    async prepare(p) {
      await assertEscrowDevnet(rpc);
      const {payer,authorizedSigner}=await solanaSigners(env);
      const credential=address(p.credentialAddress),schema=address(p.schemaAddress);
      const schemaBytes=await rawAccount(rpc,p.schemaAddress);
      if(!schemaBytes)throw new Error("SCHEMA_UNAVAILABLE");
      const schemaData=getSchemaDecoder().decode(schemaBytes);
      if(schemaData.discriminator!==2||schemaData.credential!==credential||schemaData.isPaused)throw new Error("SCHEMA_INVALID");
      const nonce=address(bs58.encode(await hashBytes(p.assessmentId)));
      const [attestation]=await deriveAttestationPda({credential,schema,nonce});
      const {value:latest}=await solanaClient(env).rpc.getLatestBlockhash({commitment:"confirmed"}).send();
      const wire=await transactionToBase64WithSigners(createTransaction({version:"legacy",feePayer:payer,
        latestBlockhash:latest,computeUnitLimit:1400000,computeUnitPrice:1,instructions:[
          await getCreateAttestationInstruction({payer,authority:authorizedSigner,credential,schema,attestation,nonce,expiry:p.expiryUnix,data:serializeAttestationData(schemaData,fields(p))}),
        ]}));
      return {wire,signature:bs58.encode(Buffer.from(wire,"base64").subarray(1,65)),nonceAddress:String(nonce),attestationAddress:String(attestation),lastValidBlockHeight:Number(latest.lastValidBlockHeight),signer:String(authorizedSigner.address)};
    },
    async inspect(p,tx) {
      await assertEscrowDevnet(rpc);
      const [expected]=await deriveAttestationPda({credential:address(p.credentialAddress),schema:address(p.schemaAddress),nonce:address(bs58.encode(await hashBytes(p.assessmentId)))});
      if(String(expected)!==tx.attestationAddress)return "mismatch";
      const {value:statuses}=await escrowRpc<{value:Array<{confirmationStatus:string;err:unknown}|null>}>(rpc,"getSignatureStatuses",[[tx.signature],{searchTransactionHistory:true}]);
      const status=statuses[0];
      if(status?.confirmationStatus==="finalized"&&status.err)return "failed";
      const raw=await rawAccount(rpc,tx.attestationAddress);
      if(raw){
        const a=getAttestationDecoder().decode(raw);
        if(a.discriminator!==0||a.credential!==p.credentialAddress||a.schema!==p.schemaAddress||a.nonce!==tx.nonceAddress||a.signer!==tx.signer||a.expiry!==BigInt(p.expiryUnix))return "mismatch";
        const schemaRaw=await rawAccount(rpc,p.schemaAddress),issuerRaw=await rawAccount(rpc,p.credentialAddress);
        if(!schemaRaw||!issuerRaw)return "mismatch";
        const schema=getSchemaDecoder().decode(schemaRaw),issuer=getCredentialDecoder().decode(issuerRaw);
        if(schema.discriminator!==2||issuer.discriminator!==1||schema.credential!==p.credentialAddress||schema.isPaused||!(issuer.authority===a.signer||issuer.authorizedSigners.includes(a.signer)))return "mismatch";
        const actual=deserializeAttestationData(schema,a.data as Uint8Array) as Record<string,unknown>;
        if(Object.entries(fields(p)).some(([k,v])=>actual[k]!==v))return "mismatch";
        // Do not claim a new signature created this account unless that exact tx finalized.
        return status?.confirmationStatus==="finalized"&&!status.err?"finalized":"pending";
      }
      if(status?.confirmationStatus==="finalized")return "mismatch"; // Missing after success: may be revoked.
      if(status)return "pending";
      const height=await escrowRpc<number>(rpc,"getBlockHeight",[{commitment:"finalized"}]);
      return height>tx.lastValidBlockHeight?"expired":"absent";
    },
    async broadcast(tx: PreparedIssuance) {
      const signature=await escrowRpc<string>(rpc,"sendTransaction",[tx.wire,{encoding:"base64",preflightCommitment:"confirmed",maxRetries:2}]);
      if(signature!==tx.signature)throw new Error("SIGNATURE_MISMATCH");
    },
  };
}
