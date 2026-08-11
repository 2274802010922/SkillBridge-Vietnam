import bs58 from "bs58";
import {
  address,
  createKeyPairSignerFromBytes,
  createSolanaClient,
  createTransaction,
  type Instruction,
  type Signature,
  type TransactionSigner,
} from "gill";
import {
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
  deriveAttestationPda,
  deriveCredentialPda,
  deriveEventAuthorityAddress,
  deriveSchemaPda,
  deserializeAttestationData,
  fetchAttestation,
  fetchSchema,
  getCloseAttestationInstruction,
  getCreateAttestationInstruction,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  serializeAttestationData,
} from "sas-lib";

type SolanaEnvironment = {
  SOLANA_RPC_URL?: string;
  SOLANA_FEE_PAYER_SECRET?: string;
  SOLANA_ISSUER_SECRET?: string;
  SOLANA_AUTHORIZED_SIGNER_SECRET?: string;
};

function secretBytes(value: string | undefined, label: string) {
  if (!value) throw new Error(`${label} chưa được cấu hình.`);
  try {
    if (value.trim().startsWith("[")) return Uint8Array.from(JSON.parse(value) as number[]);
    return bs58.decode(value.trim());
  } catch { throw new Error(`${label} không đúng định dạng keypair 64 byte.`); }
}

export async function solanaSigners(environment: SolanaEnvironment) {
  const payer = await createKeyPairSignerFromBytes(secretBytes(environment.SOLANA_FEE_PAYER_SECRET, "SOLANA_FEE_PAYER_SECRET"));
  const issuer = await createKeyPairSignerFromBytes(secretBytes(environment.SOLANA_ISSUER_SECRET, "SOLANA_ISSUER_SECRET"));
  const authorizedSigner = await createKeyPairSignerFromBytes(secretBytes(environment.SOLANA_AUTHORIZED_SIGNER_SECRET, "SOLANA_AUTHORIZED_SIGNER_SECRET"));
  return { payer, issuer, authorizedSigner };
}

export function solanaClient(environment: SolanaEnvironment) {
  return createSolanaClient({ urlOrMoniker: (environment.SOLANA_RPC_URL || "devnet") as "devnet" });
}

export async function sendSolanaInstructions(environment: SolanaEnvironment, payer: TransactionSigner, instructions: Instruction[]): Promise<Signature> {
  const solana = solanaClient(environment);
  const { value: latestBlockhash } = await solana.rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const transaction = createTransaction({ version: "legacy", feePayer: payer, instructions, latestBlockhash, computeUnitLimit: 1_400_000, computeUnitPrice: 1 });
  return solana.sendAndConfirmTransaction(transaction, { commitment: "confirmed" });
}

export function explorerTransaction(signature: string) { return `https://explorer.solana.com/tx/${signature}?cluster=devnet`; }
export function explorerAddress(value: string) { return `https://explorer.solana.com/address/${value}?cluster=devnet`; }

export async function bootstrapIssuer(environment: SolanaEnvironment, organizationId: string) {
  const { payer, issuer, authorizedSigner } = await solanaSigners(environment);
  const credentialName = `SKILLBRIDGE-${organizationId.slice(0, 8).toUpperCase()}`;
  const schemaName = "PROOF-OF-SKILL";
  const [credential] = await deriveCredentialPda({ authority: issuer.address, name: credentialName });
  const credentialTx = await sendSolanaInstructions(environment, payer, [getCreateCredentialInstruction({ payer, authority: issuer, credential, name: credentialName, signers: [authorizedSigner.address] })]);
  const [schema] = await deriveSchemaPda({ credential, name: schemaName, version: 1 });
  const schemaTx = await sendSolanaInstructions(environment, payer, [getCreateSchemaInstruction({ payer, authority: issuer, credential, schema, name: schemaName, description: "Human-approved, evidence-linked SkillBridge assessment", fieldNames: ["studentWallet","challengeId","overallScore","evidenceHash","reviewerRole","humanApproved"], layout: new Uint8Array([12,12,0,12,12,10]) })]);
  return { credentialName, credentialAddress: credential, schemaName, schemaAddress: schema, authorizedSignerAddress: authorizedSigner.address, credentialTx, schemaTx };
}

export async function issueAttestation(environment: SolanaEnvironment, input: { credentialAddress:string;schemaAddress:string;studentWallet:string;challengeId:string;score:number;evidenceHash:string;reviewerRole:string;nonceSeed:string;expiryUnix:number }) {
  const { payer, authorizedSigner } = await solanaSigners(environment);
  const nonceDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.nonceSeed));
  const nonce = address(bs58.encode(new Uint8Array(nonceDigest)));
  const credential = address(input.credentialAddress); const schema = address(input.schemaAddress);
  const [attestation] = await deriveAttestationPda({ credential, schema, nonce });
  const schemaAccount = await fetchSchema(solanaClient(environment).rpc, schema);
  const data = serializeAttestationData(schemaAccount.data, { studentWallet:input.studentWallet,challengeId:input.challengeId,overallScore:input.score,evidenceHash:input.evidenceHash,reviewerRole:input.reviewerRole,humanApproved:true });
  const signature = await sendSolanaInstructions(environment, payer, [await getCreateAttestationInstruction({ payer, authority:authorizedSigner, credential, schema, attestation, nonce, expiry:input.expiryUnix, data })]);
  return { nonceAddress:nonce,attestationAddress:attestation,signature };
}

export async function revokeAttestation(environment: SolanaEnvironment, credentialAddress:string, attestationAddress:string) {
  const { payer, authorizedSigner } = await solanaSigners(environment);
  const eventAuthority = await deriveEventAuthorityAddress();
  return sendSolanaInstructions(environment,payer,[getCloseAttestationInstruction({payer,authority:authorizedSigner,credential:address(credentialAddress),attestation:address(attestationAddress),eventAuthority,attestationProgram:SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS})]);
}

export async function verifyAttestation(environment: SolanaEnvironment, input:{schemaAddress:string;attestationAddress:string;studentWallet:string;challengeId:string;minimumScore?:number}) {
  try { const solana=solanaClient(environment);const schema=await fetchSchema(solana.rpc,address(input.schemaAddress));if(schema.data.isPaused)return{valid:false,reason:"SCHEMA_PAUSED" as const};const attestation=await fetchAttestation(solana.rpc,address(input.attestationAddress));const data=deserializeAttestationData(schema.data,attestation.data.data as Uint8Array) as Record<string,unknown>;const expiry=BigInt(attestation.data.expiry);if(expiry!==BigInt(0)&&BigInt(Math.floor(Date.now()/1000))>=expiry)return{valid:false,reason:"EXPIRED" as const,data};const valid=data.studentWallet===input.studentWallet&&data.challengeId===input.challengeId&&Number(data.overallScore)>=Number(input.minimumScore??0)&&data.humanApproved===true;return{valid,reason:valid?"ACTIVE_AND_ELIGIBLE" as const:"POLICY_MISMATCH" as const,data};}catch{return{valid:false,reason:"NO_ACTIVE_ATTESTATION" as const};}
}
