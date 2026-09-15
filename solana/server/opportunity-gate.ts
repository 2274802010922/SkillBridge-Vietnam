import bs58 from "bs58";
import {Buffer} from "buffer";
import {escrowRpc,disc,assertEscrowDevnet} from "../client/challenge-escrow.ts";
import {
  AccountRole,
  address,
  getProgramDerivedAddress,
  type Address,
} from "gill";
import {
  sendSolanaInstructions,
  solanaSigners,
} from "./solana-credentials.ts";

export const OPPORTUNITY_GATE_PROGRAM_ADDRESS = address(
  "AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE",
);
const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");
const INITIALIZE_POLICY_DISCRIMINATOR = new Uint8Array([9, 186, 86, 225, 129, 162, 231, 56]);
const RECORD_ACCESS_DISCRIMINATOR = new Uint8Array([64, 187, 29, 123, 147, 64, 218, 100]);
async function readGate(rpc:string,key:string,type:string){const r=await escrowRpc<{value:{owner:string;data:[string,string]}|null}>(rpc,"getAccountInfo",[key,{encoding:"base64",commitment:"finalized"}]);if(!r.value)return null;const bytes=Buffer.from(r.value.data[0],"base64");if(r.value.owner!==String(OPPORTUNITY_GATE_PROGRAM_ADDRESS)||!bytes.subarray(0,8).equals(await disc("account:"+type)))throw new Error("Invalid gate account");return bytes;}

type SolanaEnvironment = {
  SOLANA_RPC_URL?: string;
  SOLANA_FEE_PAYER_SECRET?: string;
  SOLANA_ISSUER_SECRET?: string;
  SOLANA_AUTHORIZED_SIGNER_SECRET?: string;
};

function joinBytes(...parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function publicKeyBytes(value: Address | string) {
  const bytes = bs58.decode(String(value));
  if (bytes.length !== 32) throw new Error("Địa chỉ Solana phải có đúng 32 byte.");
  return bytes;
}

function u16(value: number) {
  const output = new Uint8Array(2);
  new DataView(output.buffer).setUint16(0, value, true);
  return output;
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function derivePolicyAddress(authority: Address, opportunityId: string) {
  const policyId = await digest(opportunityId);
  const [policy] = await getProgramDerivedAddress({
    programAddress: OPPORTUNITY_GATE_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode("policy"), publicKeyBytes(authority), policyId],
  });
  return { policy, policyId };
}

export async function initializeOpportunityPolicy(
  environment: SolanaEnvironment,
  input: {
    opportunityId: string;
    credentialAddress: string;
    schemaAddress: string;
    minimumScore: number;
  },
) {
  const { payer, authorizedSigner } = await solanaSigners(environment);
  const { policy, policyId } = await derivePolicyAddress(payer.address, input.opportunityId);
  const rpc=environment.SOLANA_RPC_URL||"https://api.devnet.solana.com";await assertEscrowDevnet(rpc);
  const recovered=async()=>{const p=await readGate(rpc,String(policy),"Policy");if(!p)return null;
    if(p.length<172||bs58.encode(p.subarray(72,104))!==input.credentialAddress||bs58.encode(p.subarray(104,136))!==input.schemaAddress||bs58.encode(p.subarray(136,168))!==String(authorizedSigner.address)||p.readUInt16LE(168)!==input.minimumScore||p[170]!==1)throw new Error("Existing policy differs from requested policy");
    return {policyAddress:String(policy),signature:null};};
  const prior=await recovered();if(prior)return prior;
  const instruction = {
    programAddress: OPPORTUNITY_GATE_PROGRAM_ADDRESS,
    accounts: [
      { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer },
      { address: policy, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: joinBytes(
      INITIALIZE_POLICY_DISCRIMINATOR,
      policyId,
      publicKeyBytes(input.credentialAddress),
      publicKeyBytes(input.schemaAddress),
      publicKeyBytes(authorizedSigner.address),
      u16(input.minimumScore),
    ),
  };
  let signature;try{signature = await sendSolanaInstructions(environment, payer, [instruction]);}catch(error){const existing=await recovered();if(existing)return existing;throw error;}
  return { policyAddress: String(policy), signature };
}

export async function recordOpportunityAccess(
  environment: SolanaEnvironment,
  input: {
    policyAddress: string;
    attestationAddress: string;
    subjectWallet: string;
    score: number;
    verificationPayload: string;
  },
) {
  const { payer, authorizedSigner } = await solanaSigners(environment);
  const policy = address(input.policyAddress);
  const attestation = address(input.attestationAddress);
  const subject = address(input.subjectWallet);
  const verificationDigest = await digest(input.verificationPayload);
  const [receipt] = await getProgramDerivedAddress({
    programAddress: OPPORTUNITY_GATE_PROGRAM_ADDRESS,
    seeds: [
      new TextEncoder().encode("access"),
      publicKeyBytes(policy),
      publicKeyBytes(subject),
      publicKeyBytes(attestation),
    ],
  });
  const rpc=environment.SOLANA_RPC_URL||"https://api.devnet.solana.com";await assertEscrowDevnet(rpc);
  const recovered=async()=>{const r=await readGate(rpc,String(receipt),"AccessReceipt");if(!r)return null;if(r.length<179||bs58.encode(r.subarray(8,40))!==String(policy)||bs58.encode(r.subarray(40,72))!==String(subject)||bs58.encode(r.subarray(72,104))!==String(attestation)||r.readUInt16LE(136)!==input.score)throw new Error("Receipt mismatch");return {receiptAddress:String(receipt),signature:null,verificationDigest:bs58.encode(r.subarray(138,170))};};
  const prior=await recovered();if(prior)return prior;
  const instruction = {
    programAddress: OPPORTUNITY_GATE_PROGRAM_ADDRESS,
    accounts: [
      { address: payer.address, role: AccountRole.WRITABLE_SIGNER, signer: payer },
      { address: authorizedSigner.address, role: AccountRole.READONLY_SIGNER, signer: authorizedSigner },
      { address: policy, role: AccountRole.READONLY },
      { address: receipt, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data: joinBytes(
      RECORD_ACCESS_DISCRIMINATOR,
      publicKeyBytes(attestation),
      publicKeyBytes(subject),
      u16(input.score),
      verificationDigest,
    ),
  };
  let signature;try{signature = await sendSolanaInstructions(environment, payer, [instruction]);}catch(error){const existing=await recovered();if(existing)return existing;throw error;}
  return { receiptAddress: String(receipt), signature, verificationDigest: bs58.encode(verificationDigest) };
}
