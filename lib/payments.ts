import bs58 from "bs58";

export const USDC_DECIMALS = 6;
export const DEFAULT_USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const USDC_SCALE = BigInt(10) ** BigInt(USDC_DECIMALS);

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

type TokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
};

type RpcTransaction = {
  blockTime?: number | null;
  meta?: { err?: unknown; preTokenBalances?: TokenBalance[] | null; postTokenBalances?: TokenBalance[] | null } | null;
  transaction?: { message?: { accountKeys?: Array<{ pubkey?: string } | string> } };
};

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
};

export async function verifyUsdcPayment(input: {
  signature: string;
  recipientWallet: string;
  expectedAtomic: string;
  rpcUrl?: string;
  mint?: string;
  expectedReference?: string;
}): Promise<UsdcPaymentVerification> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(input.signature)) throw new Error("Transaction signature không hợp lệ.");
  if (!validSolanaAddress(input.recipientWallet)) throw new Error("Ví nhận không hợp lệ.");
  const expected = BigInt(input.expectedAtomic);
  let transaction: RpcTransaction | null = null;
  let lastRpcError: string | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(input.rpcUrl || "https://api.devnet.solana.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [input.signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] }),
    });
    if (!response.ok) throw new Error("Solana RPC không phản hồi.");
    const payload = await response.json() as { result?: RpcTransaction | null; error?: { message?: string } };
    if (payload.error) {
      lastRpcError = payload.error.message ?? "Không thể đọc giao dịch trên Solana.";
    } else if (payload.result) {
      transaction = payload.result;
      break;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  if (lastRpcError && !transaction) throw new Error(lastRpcError);
  if (!transaction?.meta || transaction.meta.err) throw new Error("Giao dịch chưa thành công hoặc chưa được xác nhận.");
  const mint = input.mint || DEFAULT_USDC_DEVNET_MINT;
  if (input.expectedReference) {
    const accountKeys = transaction.transaction?.message?.accountKeys ?? [];
    const hasReference = accountKeys.some((key) => (typeof key === "string" ? key : key.pubkey) === input.expectedReference);
    if (!hasReference) throw new Error("Giao dịch không khớp reference của invoice.");
  }
  const pre = transaction.meta.preTokenBalances;
  const post = transaction.meta.postTokenBalances;
  const received = aggregateBalances(post, mint, input.recipientWallet) - aggregateBalances(pre, mint, input.recipientWallet);
  if (received < expected) throw new Error(`Số USDC nhận được chưa đủ. Đã nhận ${formatUsdcAtomic(received.toString())} USDC.`);
  const blockTime = transaction.blockTime ?? null;
  return { signature: input.signature, senderWallet: senderFromBalances(pre, post, mint, input.recipientWallet), recipientWallet: input.recipientWallet, amountAtomic: received.toString(), observedAt: blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString(), blockTime };
}

export function explorerTransaction(signature: string) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

export function solanaPayUrl(input: { recipientWallet: string; amountUsdc: string; reference: string; mint?: string }) {
  const params = new URLSearchParams({ amount: input.amountUsdc, "spl-token": input.mint || DEFAULT_USDC_DEVNET_MINT, reference: input.reference, label: "SkillBridge", message: `Thanh toán invoice ${input.reference}` });
  return `solana:${input.recipientWallet}?${params.toString()}`;
}
