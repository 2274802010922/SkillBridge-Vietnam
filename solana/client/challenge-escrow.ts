import bs58 from "bs58";
import { Buffer } from "buffer";
import {
  address,
  AccountRole,
  createSolanaClient,
  createTransaction,
  createNoopSigner,
  getProgramDerivedAddress,
  partiallySignTransactionMessageWithSigners,
  transactionToBase64,
  type Instruction,
  type TransactionSigner,
} from "gill";
import { getAssociatedTokenAccountAddress } from "gill/programs/token";

export const ESCROW_PROGRAM = "HBasPxF9R83pCFdeuvvXW5Hpt7hSMTXghLRSzeAEGpDB";
export const SYSTEM = "11111111111111111111111111111111";
export const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export type EscrowConfig = {
  challengeId: string;
  funder: string;
  reviewer: string;
  backup: string;
  registrar: string;
  mint: string;
  amount: string;
  slots: number;
  submitDeadline: number;
  reviewDeadline: number;
  termsHash: string;
  termsText: string;
};
export type EscrowState = {
  observedSlot?: number;
  funder: string;
  reviewer: string;
  backup: string;
  registrar: string;
  mint: string;
  id: string;
  terms: string;
  amount: string;
  slots: number;
  submitDeadline: number;
  reviewDeadline: number;
  state: number;
  accepted: number;
  funded: string;
  allocated: string;
  paid: string;
  refunded: string;
  submissions: number;
  resolved: number;
  bump: number;
};
export type SubmissionState = {
  escrow: string;
  student: string;
  submissionId: string;
  evidenceHash: string;
  resultHash: string;
  decision: number;
  paid: boolean;
};
export type EscrowAction =
  | "initialize"
  | "accept_role"
  | "publish"
  | "register_submission"
  | "record_result"
  | "allocate_award"
  | "claim_award"
  | "refund_unused"
  | "finalize_results"
  | "cancel_empty";
export async function hashBytes(text: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
}
export async function disc(name: string) {
  return (await hashBytes(name)).subarray(0, 8);
}
const pk = (key: string) => bs58.decode(key);
const meta = (key: string, role: AccountRole = AccountRole.READONLY) => ({
  address: address(key),
  role,
});
function u64(value: string | number) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(value));
  return b;
}
function i64(value: number) {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(value));
  return b;
}
function u16(value: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value);
  return b;
}
export async function escrowAddress(
  config: Pick<EscrowConfig, "funder" | "challengeId">,
) {
  return String(
    (
      await getProgramDerivedAddress({
        programAddress: address(ESCROW_PROGRAM),
        seeds: [
          Buffer.from("escrow"),
          pk(config.funder),
          await hashBytes(config.challengeId),
        ],
      })
    )[0],
  );
}
export async function submissionAddress(escrow: string, student: string) {
  return String(
    (
      await getProgramDerivedAddress({
        programAddress: address(ESCROW_PROGRAM),
        seeds: [Buffer.from("submission"), pk(escrow), pk(student)],
      })
    )[0],
  );
}
export async function escrowRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<T> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const data = (await r.json()) as { result: T; error?: { message: string } };
  if (!r.ok || data.error)
    throw new Error("Solana RPC: " + (data.error?.message || r.status));
  return data.result;
}
export async function assertEscrowDevnet(rpcUrl: string) {
  const genesis = await escrowRpc<string>(rpcUrl, "getGenesisHash", []);
  if (genesis !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG")
    throw new Error("Quỹ thưởng này chỉ dùng Solana Devnet.");
}
class Reader {
  offset = 8;
  readonly b: Buffer;
  constructor(b: Buffer) {
    this.b = b;
  }
  key() {
    const k = bs58.encode(this.b.subarray(this.offset, this.offset + 32));
    this.offset += 32;
    return k;
  }
  hex() {
    const v = this.b.subarray(this.offset, this.offset + 32).toString("hex");
    this.offset += 32;
    return v;
  }
  n64() {
    const v = this.b.readBigUInt64LE(this.offset).toString();
    this.offset += 8;
    return v;
  }
  time() {
    const v = Number(this.b.readBigInt64LE(this.offset));
    this.offset += 8;
    return v;
  }
  n16() {
    const v = this.b.readUInt16LE(this.offset);
    this.offset += 2;
    return v;
  }
  n32() {
    const v = this.b.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }
  n8() {
    return this.b[this.offset++];
  }
}
export function decodeEscrow(b: Buffer): EscrowState {
  const r = new Reader(b);
  return {
    funder: r.key(),
    reviewer: r.key(),
    backup: r.key(),
    registrar: r.key(),
    mint: r.key(),
    id: r.hex(),
    terms: r.hex(),
    amount: r.n64(),
    slots: r.n16(),
    submitDeadline: r.time(),
    reviewDeadline: r.time(),
    state: r.n8(),
    accepted: r.n8(),
    funded: r.n64(),
    allocated: r.n64(),
    paid: r.n64(),
    refunded: r.n64(),
    submissions: r.n32(),
    resolved: r.n32(),
    bump: r.n8(),
  };
}
export function decodeSubmission(b: Buffer): SubmissionState {
  const r = new Reader(b);
  return {
    escrow: r.key(),
    student: r.key(),
    submissionId: r.hex(),
    evidenceHash: r.hex(),
    resultHash: r.hex(),
    decision: r.n8(),
    paid: r.n8() === 1,
  };
}
export async function readEscrowAccount(
  rpcUrl: string,
  key: string,
  type: "Escrow",
): Promise<EscrowState | null>;
export async function readEscrowAccount(
  rpcUrl: string,
  key: string,
  type: "Submission",
): Promise<SubmissionState | null>;
export async function readEscrowAccount(
  rpcUrl: string,
  key: string,
  type: "Escrow" | "Submission",
): Promise<EscrowState | SubmissionState | null> {
  const result = await escrowRpc<{
    context: { slot: number };
    value: { owner: string; data: [string, string] } | null;
  }>(rpcUrl, "getAccountInfo", [
    key,
    { encoding: "base64", commitment: "finalized" },
  ]);
  if (!result.value) return null;
  const b = Buffer.from(result.value.data[0], "base64");
  if (
    result.value.owner !== ESCROW_PROGRAM ||
    !b.subarray(0, 8).equals(await disc("account:" + type))
  )
    throw new Error("Tài khoản quỹ không hợp lệ.");
  return type === "Escrow"
    ? { ...decodeEscrow(b), observedSlot: result.context.slot }
    : decodeSubmission(b);
}
export async function listEscrowSubmissions(rpcUrl: string, key: string) {
  const result = await escrowRpc<
    Array<{ pubkey: string; account: { data: [string, string] } }>
  >(rpcUrl, "getProgramAccounts", [
    ESCROW_PROGRAM,
    {
      encoding: "base64",
      commitment: "finalized",
      filters: [{ dataSize: 184 }, { memcmp: { offset: 8, bytes: key } }],
    },
  ]);
  return result.map((a) => ({
    ...decodeSubmission(Buffer.from(a.account.data[0], "base64")),
    address: a.pubkey,
  }));
}
// Create ATA idempotently with fixed associated-token/system/classic-token program IDs.
async function ataInstruction(
  payer: string,
  owner: string,
  mint: string,
): Promise<{ ata: string; instruction: Instruction }> {
  const ata = String(
    await getAssociatedTokenAccountAddress(address(mint), address(owner)),
  );
  return {
    ata,
    instruction: {
      programAddress: address(ATA),
      accounts: [
        meta(payer, AccountRole.WRITABLE_SIGNER),
        meta(ata, AccountRole.WRITABLE),
        meta(owner),
        meta(mint),
        meta(SYSTEM),
        meta(TOKEN),
      ],
      data: new Uint8Array([1]),
    },
  };
}
export async function escrowInstructions(
  config: EscrowConfig,
  actor: string,
  action: EscrowAction,
  extra: {
    student?: string;
    submissionId?: string;
    evidenceHash?: string;
    resultHash?: string;
    eligible?: boolean;
  } = {},
): Promise<Instruction[]> {
  const e = await escrowAddress(config);
  const instructions: Instruction[] = [];
  let accounts = [
    meta(actor, AccountRole.WRITABLE_SIGNER),
    meta(e, AccountRole.WRITABLE),
    meta(SYSTEM),
  ];
  let args: Uint8Array[] = [];
  if (action === "initialize")
    args = [
      await hashBytes(config.challengeId),
      Buffer.from(config.termsHash, "hex"),
      pk(config.reviewer),
      pk(config.backup),
      pk(config.registrar),
      pk(config.mint),
      u64(config.amount),
      u16(config.slots),
      i64(config.submitDeadline),
      i64(config.reviewDeadline),
    ];
  if (action === "register_submission") {
    accounts = [
      meta(actor, AccountRole.WRITABLE_SIGNER),
      meta(config.registrar, AccountRole.READONLY_SIGNER),
      meta(e, AccountRole.WRITABLE),
      meta(await submissionAddress(e, actor), AccountRole.WRITABLE),
      meta(SYSTEM),
    ];
    args = [
      await hashBytes(extra.submissionId!),
      Buffer.from(extra.evidenceHash!, "hex"),
    ];
  }
  if (
    action === "record_result" ||
    action === "allocate_award" ||
    action === "claim_award"
  ) {
    accounts = [
      meta(actor, AccountRole.WRITABLE_SIGNER),
      meta(e, AccountRole.WRITABLE),
      meta(await submissionAddress(e, extra.student!), AccountRole.WRITABLE),
    ];
    if (action === "record_result")
      args = [
        new Uint8Array([extra.eligible ? 1 : 0]),
        Buffer.from(extra.resultHash!, "hex"),
      ];
    if (action === "claim_award")
      accounts.push(meta(extra.student!, AccountRole.WRITABLE));
  }
  if (action === "refund_unused")
    accounts = [
      meta(actor, AccountRole.WRITABLE_SIGNER),
      meta(e, AccountRole.WRITABLE),
      meta(config.funder, AccountRole.WRITABLE),
    ];
  if (
    config.mint !== SYSTEM &&
    (action === "initialize" ||
      action === "claim_award" ||
      action === "refund_unused")
  ) {
    const source = await ataInstruction(
      actor,
      action === "initialize" ? config.funder : e,
      config.mint,
    );
    const dest = await ataInstruction(
      actor,
      action === "initialize"
        ? e
        : action === "claim_award"
          ? extra.student!
          : config.funder,
      config.mint,
    );
    instructions.push(dest.instruction);
    if (action !== "initialize")
      accounts.push(
        meta(source.ata, AccountRole.WRITABLE),
        meta(dest.ata, AccountRole.WRITABLE),
        meta(TOKEN),
      );
  }
  instructions.push({
    programAddress: address(ESCROW_PROGRAM),
    accounts,
    data: Buffer.concat([await disc("global:" + action), ...args]),
  });
  if (action === "initialize") {
    const fundingAccounts = [
      meta(actor, AccountRole.WRITABLE_SIGNER),
      meta(e, AccountRole.WRITABLE),
      meta(SYSTEM),
    ];
    if (config.mint !== SYSTEM) {
      fundingAccounts.push(
        meta(
          String(
            await getAssociatedTokenAccountAddress(
              address(config.mint),
              address(actor),
            ),
          ),
          AccountRole.WRITABLE,
        ),
        meta(
          String(
            await getAssociatedTokenAccountAddress(
              address(config.mint),
              address(e),
            ),
          ),
          AccountRole.WRITABLE,
        ),
        meta(TOKEN),
      );
    }
    instructions.push({
      programAddress: address(ESCROW_PROGRAM),
      accounts: fundingAccounts,
      data: await disc("global:fund"),
    });
  }
  return instructions;
}
export async function buildEscrowTransaction(
  rpcUrl: string,
  actor: string,
  instructions: Instruction[],
  registrar?: TransactionSigner,
) {
  const solana = createSolanaClient({ urlOrMoniker: rpcUrl as "devnet" });
  const { value: latestBlockhash } = await solana.rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();
  const signedInstructions = registrar
    ? instructions.map((ix) => ({
        ...ix,
        accounts: ix.accounts?.map((a) =>
          a.address === registrar.address && a.role >= 2
            ? { ...a, signer: registrar }
            : a,
        ),
      }))
    : instructions;
  const tx = createTransaction({
    version: "legacy",
    feePayer: createNoopSigner(address(actor)),
    instructions: signedInstructions,
    latestBlockhash,
    computeUnitLimit: 300000,
  });
  return transactionToBase64(
    await partiallySignTransactionMessageWithSigners(tx),
  );
}
