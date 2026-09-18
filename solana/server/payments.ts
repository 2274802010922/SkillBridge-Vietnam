import bs58 from "bs58";

export const USDC_DECIMALS = 6;
export const DEFAULT_USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const USDC_SCALE = BigInt(10) ** BigInt(USDC_DECIMALS);
export const SOL_DECIMALS = 9;
const SOL_SCALE = BigInt(10) ** BigInt(SOL_DECIMALS);
const SOLANA_DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const verifiedDevnetRpcUrls = new Set<string>();

function validSolanaAddress(value: string) {
  try { return bs58.decode(value).length === 32; } catch { return false; }
}

export type UsdcAmount = { display: string; atomic: string };

export function parseUsdcAmount(value: string): UsdcAmount | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const atomic = `${BigInt(whole) * USDC_SCALE + BigInt(fraction.padEnd(USDC_DECIMALS, "0"))}`;
  if (BigInt(atomic) <= BigInt(0)) return null;
  return { display: `${whole}.${fraction.padEnd(USDC_DECIMALS, "0")}`.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"), atomic };
}

export function formatUsdcAtomic(value: string) {
  const atomic = BigInt(value || "0");
  const whole = atomic / USDC_SCALE;
  const fraction = (atomic % USDC_SCALE).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function parseDecimalAmount(value: string, decimals: number, scale: bigint): UsdcAmount | null {
  const normalized = value.trim().replace(",", ".");
  const matcher = new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`);
  if (!matcher.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const atomic = `${BigInt(whole) * scale + BigInt(fraction.padEnd(decimals, "0"))}`;
  if (BigInt(atomic) <= BigInt(0)) return null;
  return { display: `${whole}.${fraction.padEnd(decimals, "0")}`.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"), atomic };
}

export function parseSolAmount(value: string): UsdcAmount | null {
  return parseDecimalAmount(value, SOL_DECIMALS, SOL_SCALE);
}

export function formatSolAtomic(value: string) {
  const atomic = BigInt(value || "0");
  const whole = atomic / SOL_SCALE;
  const fraction = (atomic % SOL_SCALE).toString().padStart(SOL_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
};

type RpcTransaction = {
  blockTime?: number | null;
  meta?: {
    err?: unknown;
    preTokenBalances?: TokenBalance[] | null;
    postTokenBalances?: TokenBalance[] | null;
    preBalances?: number[] | null;
    postBalances?: number[] | null;
  } | null;
  transaction?: { message?: { accountKeys?: Array<{ pubkey?: string } | string>; instructions?: Array<{ program?: string; parsed?: { type?: string; info?: { source?: string; destination?: string; lamports?: number | string } } }> } };
};

export type PaymentVerificationCode =
  | "TX_INVALID"
  | "TX_NOT_FOUND"
  | "TX_FAILED"
  | "NOT_FINALIZED"
  | "WRONG_NETWORK"
  | "WRONG_SENDER"
  | "WRONG_RECIPIENT"
  | "INSUFFICIENT_AMOUNT"
  | "REFERENCE_MISMATCH"
  | "RPC_UNAVAILABLE";

export class PaymentVerificationError extends Error {
  readonly code: PaymentVerificationCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: PaymentVerificationCode, message: string, status = 422, retryable = false) {
    super(message);
    this.name = "PaymentVerificationError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function aggregateBalances(balances: TokenBalance[] | null | undefined, mint: string, owner: string) {
  return (balances ?? []).filter((item) => item.mint === mint && item.owner === owner).reduce((total, item) => total + BigInt(item.uiTokenAmount?.amount ?? "0"), BigInt(0));
}

function senderFromBalances(pre: TokenBalance[] | null | undefined, post: TokenBalance[] | null | undefined, mint: string, recipient: string) {
  const owners = new Set([...(pre ?? []), ...(post ?? [])].filter((item) => item.mint === mint && item.owner && item.owner !== recipient).map((item) => item.owner as string));
  for (const owner of owners) {
    const delta = aggregateBalances(post, mint, owner) - aggregateBalances(pre, mint, owner);
    if (delta < BigInt(0)) return owner;
  }
  return null;
}

export type UsdcPaymentVerification = {
  signature: string;
  senderWallet: string | null;
  recipientWallet: string;
  amountAtomic: string;
  observedAt: string;
  blockTime: number | null;
  referenceMatched: boolean;
  confirmationStatus?: "finalized";
};

function hasReference(transaction: RpcTransaction, reference: string | undefined) {
  if (!reference) return true;
  const accountKeys = transaction.transaction?.message?.accountKeys ?? [];
  return accountKeys.some((key) => (typeof key === "string" ? key : key.pubkey) === reference);
}

function addressOf(key: { pubkey?: string } | string) {
  return typeof key === "string" ? key : key.pubkey;
}

function signatureIsValid(signature: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(signature);
}

async function rpcRequest<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
  } catch {
    throw new PaymentVerificationError("RPC_UNAVAILABLE", "Solana RPC không phản hồi.", 503, true);
  }
  if (!response.ok) throw new PaymentVerificationError("RPC_UNAVAILABLE", "Solana RPC không phản hồi.", 503, true);
  let payload: { result?: T; error?: { message?: string } };
  try { payload = await response.json() as { result?: T; error?: { message?: string } }; }
  catch { throw new PaymentVerificationError("RPC_UNAVAILABLE", "Solana RPC trả về dữ liệu không hợp lệ.", 503, true); }
  if (payload.error) throw new PaymentVerificationError("RPC_UNAVAILABLE", payload.error.message ?? "Không thể đọc dữ liệu trên Solana.", 503, true);
  return payload.result as T;
}

async function requireFinalized(signature: string, rpcUrl: string) {
  if (!verifiedDevnetRpcUrls.has(rpcUrl)) {
    const genesisHash = await rpcRequest<string>(rpcUrl, "getGenesisHash", []);
    if (genesisHash !== SOLANA_DEVNET_GENESIS_HASH) throw new PaymentVerificationError("WRONG_NETWORK", "Transaction không thuộc Solana Devnet.", 422, false);
    verifiedDevnetRpcUrls.add(rpcUrl);
  }
  const statusResponse = await rpcRequest<{ value?: Array<{ err?: unknown; confirmationStatus?: string } | null> }>(rpcUrl, "getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);
  const status = statusResponse?.value?.[0];
  if (!status) throw new PaymentVerificationError("TX_NOT_FOUND", "Không tìm thấy transaction trên Solana Devnet.", 404, true);
  if (status.err) throw new PaymentVerificationError("TX_FAILED", "Transaction đã thất bại trên Solana.", 422, false);
  if (status.confirmationStatus !== "finalized") throw new PaymentVerificationError("NOT_FINALIZED", "Transaction đã có nhưng chưa finalized. Hãy thử xác minh lại sau ít giây.", 202, true);
}

async function getTransaction(signature: string, rpcUrl: string, commitment: "confirmed" | "finalized", retries: number) {
  let transaction: RpcTransaction | null = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      transaction = await rpcRequest<RpcTransaction | null>(rpcUrl, "getTransaction", [signature, { commitment, encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    } catch (error) {
      if (!(error instanceof PaymentVerificationError) || error.code !== "RPC_UNAVAILABLE" || attempt === retries - 1) throw error;
    }
    if (transaction) break;
    if (attempt < retries - 1) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  if (!transaction) throw new PaymentVerificationError("TX_NOT_FOUND", "Không tìm thấy transaction trên Solana Devnet.", 404, true);
  if (!transaction.meta) throw new PaymentVerificationError("TX_NOT_FOUND", "Transaction chưa có dữ liệu xác minh.", 404, true);
  if (transaction.meta.err) throw new PaymentVerificationError("TX_FAILED", "Transaction đã thất bại trên Solana.", 422, false);
  return transaction;
}

function assertReference(transaction: RpcTransaction, expectedReference: string | undefined, allowMissingReference: boolean) {
  const referenceMatched = hasReference(transaction, expectedReference);
  if (expectedReference && !referenceMatched && !allowMissingReference) {
    throw new PaymentVerificationError("REFERENCE_MISMATCH", "Transaction không khớp mã tham chiếu của challenge.", 422, false);
  }
  return referenceMatched;
}

function assertExpectedSender(sender: string | null, expectedSenderWallet: string | undefined) {
  if (expectedSenderWallet && sender !== expectedSenderWallet) {
    throw new PaymentVerificationError("WRONG_SENDER", "Transaction phải được gửi từ đúng ví doanh nghiệp tạo challenge.", 403, false);
  }
}

export async function verifyUsdcPayment(input: {
  signature: string;
  recipientWallet: string;
  expectedAtomic: string;
  rpcUrl?: string;
  mint?: string;
  expectedReference?: string;
  expectedSenderWallet?: string;
  requireFinalized?: boolean;
  allowMissingReference?: boolean;
  /** Cashout reconciliation may record a positive partial deposit; default remains full payment. */
  observePartialDeposit?: boolean;
}): Promise<UsdcPaymentVerification> {
  if (!signatureIsValid(input.signature)) throw new PaymentVerificationError("TX_INVALID", "Transaction signature không hợp lệ.", 400, false);
  if (!validSolanaAddress(input.recipientWallet)) throw new PaymentVerificationError("WRONG_RECIPIENT", "Ví nhận không hợp lệ.", 422, false);
  const rpcUrl = input.rpcUrl || "https://api.devnet.solana.com";
  if (input.requireFinalized) await requireFinalized(input.signature, rpcUrl);
  const expected = BigInt(input.expectedAtomic);
  const transaction = await getTransaction(input.signature, rpcUrl, input.requireFinalized ? "finalized" : "confirmed", 4);
  const meta = transaction.meta;
  if (!meta) throw new PaymentVerificationError("TX_NOT_FOUND", "Transaction chưa có dữ liệu xác minh.", 404, true);
  const mint = input.mint || DEFAULT_USDC_DEVNET_MINT;
  const referenceMatched = assertReference(transaction, input.expectedReference, input.allowMissingReference === true);
  const pre = meta.preTokenBalances;
  const post = meta.postTokenBalances;
  const received = aggregateBalances(post, mint, input.recipientWallet) - aggregateBalances(pre, mint, input.recipientWallet);
  if (received <= BigInt(0) || (received < expected && !input.observePartialDeposit)) throw new PaymentVerificationError("INSUFFICIENT_AMOUNT", `Số USDC nhận được chưa đủ. Đã nhận ${formatUsdcAtomic(received.toString())} USDC.`, 422, false);
  const senderWallet = senderFromBalances(pre, post, mint, input.recipientWallet);
  assertExpectedSender(senderWallet, input.expectedSenderWallet);
  const blockTime = transaction.blockTime ?? null;
  return { signature: input.signature, senderWallet, recipientWallet: input.recipientWallet, amountAtomic: received.toString(), observedAt: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(), blockTime, referenceMatched, ...(input.requireFinalized ? { confirmationStatus: "finalized" as const } : {}) };
}

/** Verify native SOL received by a recipient wallet using the confirmed on-chain balance delta. */
export async function verifySolPayment(input: {
  signature: string;
  recipientWallet: string;
  expectedAtomic: string;
  rpcUrl?: string;
  expectedReference?: string;
  expectedSenderWallet?: string;
  requireFinalized?: boolean;
  allowMissingReference?: boolean;
}): Promise<UsdcPaymentVerification> {
  if (!signatureIsValid(input.signature)) throw new PaymentVerificationError("TX_INVALID", "Transaction signature không hợp lệ.", 400, false);
  if (!validSolanaAddress(input.recipientWallet)) throw new PaymentVerificationError("WRONG_RECIPIENT", "Ví nhận không hợp lệ.", 422, false);
  const rpcUrl = input.rpcUrl || "https://api.devnet.solana.com";
  if (input.requireFinalized) await requireFinalized(input.signature, rpcUrl);
  const transaction = await getTransaction(input.signature, rpcUrl, input.requireFinalized ? "finalized" : "confirmed", 4);
  const meta = transaction.meta;
  if (!meta) throw new PaymentVerificationError("TX_NOT_FOUND", "Transaction chưa có dữ liệu xác minh.", 404, true);
  const referenceMatched = assertReference(transaction, input.expectedReference, input.allowMissingReference === true);
  const keys = transaction.transaction?.message?.accountKeys ?? [];
  const instructions = transaction.transaction?.message?.instructions ?? [];
  const transfers = instructions
    .filter((instruction) => instruction.program === "system" && instruction.parsed?.type === "transfer" && instruction.parsed.info?.destination === input.recipientWallet)
    .map((instruction) => ({ sender: instruction.parsed?.info?.source ?? null, amount: BigInt(instruction.parsed?.info?.lamports ?? 0) }))
    .filter((transfer) => transfer.amount > BigInt(0));
  const matchingTransfers = input.expectedSenderWallet ? transfers.filter((transfer) => transfer.sender === input.expectedSenderWallet) : transfers;
  const recipientIndex = keys.findIndex((key) => addressOf(key) === input.recipientWallet);
  if (instructions.length > 0 && transfers.length === 0) throw new PaymentVerificationError("WRONG_RECIPIENT", "Transaction không chuyển đến Reward Vault.", 422, false);
  if (transfers.length === 0 && recipientIndex < 0) throw new PaymentVerificationError("WRONG_RECIPIENT", "Transaction không chuyển đến Reward Vault.", 422, false);
  if (transfers.length > 0 && matchingTransfers.length === 0) throw new PaymentVerificationError("WRONG_SENDER", "Transaction phải được gửi từ đúng ví doanh nghiệp tạo challenge.", 403, false);
  const received = matchingTransfers.length > 0
    ? matchingTransfers.reduce((total, transfer) => total + transfer.amount, BigInt(0))
    : BigInt(meta.postBalances?.[recipientIndex] ?? 0) - BigInt(meta.preBalances?.[recipientIndex] ?? 0);
  const expected = BigInt(input.expectedAtomic);
  if (received < expected) throw new PaymentVerificationError("INSUFFICIENT_AMOUNT", `Số SOL nhận được chưa đủ. Đã nhận ${formatSolAtomic(received.toString())} SOL.`, 422, false);
  const sender = matchingTransfers[0]?.sender ?? keys.find((key, index) => index !== recipientIndex && BigInt(meta.postBalances?.[index] ?? 0) < BigInt(meta.preBalances?.[index] ?? 0));
  const senderWallet = sender ? (typeof sender === "string" ? sender : sender.pubkey ?? null) : null;
  assertExpectedSender(senderWallet, input.expectedSenderWallet);
  const blockTime = transaction.blockTime ?? null;
  return { signature: input.signature, senderWallet, recipientWallet: input.recipientWallet, amountAtomic: received.toString(), observedAt: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(), blockTime, referenceMatched, ...(input.requireFinalized ? { confirmationStatus: "finalized" as const } : {}) };
}

export function explorerTransaction(signature: string) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

export function solanaPayUrl(input: { recipientWallet: string; amountUsdc: string; reference: string; mint?: string }) {
  const params = new URLSearchParams({ amount: input.amountUsdc, "spl-token": input.mint || DEFAULT_USDC_DEVNET_MINT, reference: input.reference, label: "SkillBridge", message: `Thanh toán invoice ${input.reference}` });
  return `solana:${input.recipientWallet}?${params.toString()}`;
}
