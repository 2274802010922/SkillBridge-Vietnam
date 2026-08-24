import bs58 from "bs58";
import {
  address,
  createSolanaClient,
  createTransaction,
  insertReferenceKeyToTransactionMessage,
  transactionToBase64,
  type TransactionSigner,
} from "gill";
import { getAssociatedTokenAccountAddress, getTransferTokensInstructions } from "gill/programs/token";
import { DEFAULT_USDC_DEVNET_MINT, type UsdcAmount } from "./payments.ts";
import { rewardVaultAddress } from "./reward-vault.ts";

export const CASHOUT_PROVIDER = "skillbridge_devnet_offramp";
export const CASHOUT_NETWORK = "solana:devnet";

/**
 * A receiving method is deliberately separate from the off-ramp provider.
 * Solana moves USDC, an off-ramp converts it to VND, and a payout provider
 * delivers that VND to the destination selected by the recipient.
 */
export const CASHOUT_PAYOUT_METHODS = ["bank", "momo", "zalopay"] as const;
export type CashoutPayoutMethod = (typeof CASHOUT_PAYOUT_METHODS)[number];
export type CashoutMethodCapability = {
  id: CashoutPayoutMethod;
  payoutProvider: string;
  availability: "sandbox" | "setup_required";
  requiresBankCode: boolean;
  requiresPhoneNumber: boolean;
};

export type CashoutEnvironment = {
  SOLANA_RPC_URL?: string;
  SOLANA_USDC_MINT?: string;
  SOLANA_REWARD_VAULT_SECRET?: string;
  SOLANA_AUTHORIZED_SIGNER_SECRET?: string;
  CASHOUT_DEVNET_SETTLEMENT_WALLET?: string;
  CASHOUT_SANDBOX_VND_RATE?: string;
  CASHOUT_PROVIDER_FEE_BPS?: string;
  CASHOUT_NETWORK_FEE_VND?: string;
  CASHOUT_QUOTE_TTL_SECONDS?: string;
  CASHOUT_MODE?: string;
  REAL_CASHOUT_ENABLED?: string;
  OFFRAMP_PROVIDER?: string;
  PAYOUT_PROVIDERS?: string;
  OFFRAMP_API_BASE_URL?: string;
  OFFRAMP_API_KEY?: string;
  PAYOS_CLIENT_ID?: string;
  PAYOS_API_KEY?: string;
  PAYOS_CHECKSUM_KEY?: string;
  PAYOS_PAYOUT_CHECKSUM_KEY?: string;
  MOMO_PARTNER_CODE?: string;
  MOMO_ACCESS_KEY?: string;
  MOMO_SECRET_KEY?: string;
  MOMO_PUBLIC_KEY?: string;
  MOMO_STORE_ID?: string;
  ZALOPAY_APP_ID?: string;
  ZALOPAY_MAC_KEY?: string;
  ZALOPAY_PRIVATE_KEY?: string;
  ZALOPAY_MERCHANT_WALLET_ID?: string;
};

export type CashoutQuote = {
  rateVnd: string;
  grossVnd: string;
  providerFeeVnd: string;
  networkFeeVnd: string;
  feeVnd: string;
  netVnd: string;
  expiresAt: string;
  rateSource: "configured_test_rate";
};

function validSolanaAddress(value: string) {
  try { return bs58.decode(value).length === 32; } catch { return false; }
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

function configuredPayoutProviders(environment: CashoutEnvironment) {
  const configured = environment.PAYOUT_PROVIDERS?.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return new Set(configured?.length ? configured : ["payos", "momo", "zalopay"]);
}

function hasProductionCredentials(environment: CashoutEnvironment, provider: string) {
  if (provider === "payos") return Boolean(environment.PAYOS_CLIENT_ID && environment.PAYOS_API_KEY && environment.PAYOS_PAYOUT_CHECKSUM_KEY);
  if (provider === "momo") return Boolean(environment.MOMO_PARTNER_CODE && environment.MOMO_ACCESS_KEY && environment.MOMO_SECRET_KEY && environment.MOMO_PUBLIC_KEY);
  if (provider === "zalopay") return Boolean(environment.ZALOPAY_APP_ID && environment.ZALOPAY_MAC_KEY && environment.ZALOPAY_PRIVATE_KEY && environment.ZALOPAY_MERCHANT_WALLET_ID);
  return false;
}

export function payoutProviderForMethod(method: CashoutPayoutMethod, environment: CashoutEnvironment) {
  const enabled = configuredPayoutProviders(environment);
  if (method === "bank") return enabled.has("payos") ? "payos" : enabled.has("momo") ? "momo" : enabled.has("zalopay") ? "zalopay" : "sandbox";
  return method;
}

/**
 * This function exposes configuration honestly. Provider credentials alone do
 * not enable real USDC-to-VND conversion: that requires a contracted,
 * licensed off-ramp adapter. Until then every available path stays sandboxed.
 */
export function cashoutMethodCapabilities(environment: CashoutEnvironment): CashoutMethodCapability[] {
  const productionRequested = environment.CASHOUT_MODE === "production" && environment.REAL_CASHOUT_ENABLED === "true";
  const hasContractedOffRamp = Boolean(
    environment.OFFRAMP_PROVIDER && environment.OFFRAMP_PROVIDER !== "devnet_sandbox" &&
    environment.OFFRAMP_API_BASE_URL && environment.OFFRAMP_API_KEY,
  );
  return CASHOUT_PAYOUT_METHODS.map((id) => {
    const payoutProvider = payoutProviderForMethod(id, environment);
    const providerConfigured = hasProductionCredentials(environment, payoutProvider);
    return {
      id,
      payoutProvider,
      // There is intentionally no "live" result until a concrete provider
      // adapter has passed certification. This avoids a credential-only switch
      // ever triggering a real transfer.
      availability: productionRequested && hasContractedOffRamp && providerConfigured ? "setup_required" : "sandbox",
      requiresBankCode: id === "bank",
      requiresPhoneNumber: id === "momo" || id === "zalopay",
    };
  });
}

/** A deterministic, time-limited test quote. A licensed provider replaces this adapter on Mainnet. */
export function createDevnetCashoutQuote(environment: CashoutEnvironment, amount: UsdcAmount, now = new Date()): CashoutQuote {
  const rate = BigInt(Math.max(1, positiveInteger(environment.CASHOUT_SANDBOX_VND_RATE, 25_000, 1_000_000)));
  const providerFeeBps = BigInt(positiveInteger(environment.CASHOUT_PROVIDER_FEE_BPS, 80, 10_000));
  const networkFee = BigInt(positiveInteger(environment.CASHOUT_NETWORK_FEE_VND, 5_000, 10_000_000));
  const gross = BigInt(amount.atomic) * rate / BigInt(1_000_000);
  const providerFee = gross * providerFeeBps / BigInt(10_000);
  const totalFee = providerFee + networkFee;
  const net = gross > totalFee ? gross - totalFee : BigInt(0);
  const ttl = Math.max(60, positiveInteger(environment.CASHOUT_QUOTE_TTL_SECONDS, 300, 1_800));
  return {
    rateVnd: rate.toString(), grossVnd: gross.toString(), providerFeeVnd: providerFee.toString(),
    networkFeeVnd: networkFee.toString(), feeVnd: totalFee.toString(), netVnd: net.toString(),
    expiresAt: new Date(now.getTime() + ttl * 1_000).toISOString(), rateSource: "configured_test_rate",
  };
}

export function createCashoutReference() {
  return bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function cashoutSettlementWallet(environment: CashoutEnvironment) {
  const configured = environment.CASHOUT_DEVNET_SETTLEMENT_WALLET?.trim();
  if (configured) {
    if (!validSolanaAddress(configured)) throw new Error("CASHOUT_DEVNET_SETTLEMENT_WALLET không phải địa chỉ Solana hợp lệ.");
    return configured;
  }
  return String(await rewardVaultAddress(environment));
}

export async function cashoutCapabilities(environment: CashoutEnvironment) {
  try {
    const settlementWallet = await cashoutSettlementWallet(environment);
    const methods = cashoutMethodCapabilities(environment);
    return {
      provider: CASHOUT_PROVIDER,
      network: CASHOUT_NETWORK,
      asset: "USDC",
      mint: environment.SOLANA_USDC_MINT || DEFAULT_USDC_DEVNET_MINT,
      devnetTransferEnabled: true,
      directSolanaPay: true,
      bankPayoutMode: "sandbox_only" as const,
      quoteKind: "time_limited_test_quote" as const,
      settlementWallet,
      methods,
      realPayoutEnabled: false,
      productionMessage: "USDC-to-VND production remains disabled until a licensed off-ramp adapter is certified.",
    };
  } catch (error) {
    return {
      provider: CASHOUT_PROVIDER,
      network: CASHOUT_NETWORK,
      asset: "USDC",
      mint: environment.SOLANA_USDC_MINT || DEFAULT_USDC_DEVNET_MINT,
      devnetTransferEnabled: false,
      directSolanaPay: false,
      bankPayoutMode: "unavailable" as const,
      quoteKind: "time_limited_test_quote" as const,
      settlementWallet: null,
      methods: cashoutMethodCapabilities(environment),
      realPayoutEnabled: false,
      productionMessage: "USDC-to-VND production remains disabled until a licensed off-ramp adapter is certified.",
      configurationError: error instanceof Error ? error.message : "Off-ramp Devnet chưa được cấu hình.",
    };
  }
}

export function solanaPayCashoutUrl(input: { settlementWallet: string; amountUsdc: string; reference: string; mint?: string }) {
  const params = new URLSearchParams({
    amount: input.amountUsdc,
    "spl-token": input.mint || DEFAULT_USDC_DEVNET_MINT,
    reference: input.reference,
    label: "SkillBridge Devnet Off-ramp",
    message: "Nạp USDC Devnet cho lệnh đổi VND thử nghiệm",
  });
  return `solana:${input.settlementWallet}?${params.toString()}`;
}

/** Build an unsigned, reference-bound Devnet USDC transfer. The user's wallet remains the only signer. */
export async function buildCashoutTransferTransaction(environment: CashoutEnvironment, input: { senderWallet: string; settlementWallet: string; amountAtomic: string; reference: string }) {
  const sender = address(input.senderWallet);
  const recipient = address(input.settlementWallet);
  const mint = address(environment.SOLANA_USDC_MINT || DEFAULT_USDC_DEVNET_MINT);
  const sourceAta = await getAssociatedTokenAccountAddress(mint, sender);
  const destinationAta = await getAssociatedTokenAccountAddress(mint, recipient);
  const solana = createSolanaClient({ urlOrMoniker: (environment.SOLANA_RPC_URL || "devnet") as "devnet" });
  const { value: latestBlockhash } = await solana.rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const instructions = getTransferTokensInstructions({
    feePayer: sender as unknown as TransactionSigner,
    mint,
    authority: sender as unknown as TransactionSigner,
    sourceAta,
    destination: recipient,
    destinationAta,
    amount: BigInt(input.amountAtomic),
  });
  const transaction = createTransaction({ version: "legacy", feePayer: sender as unknown as TransactionSigner, instructions, latestBlockhash });
  return transactionToBase64(insertReferenceKeyToTransactionMessage(address(input.reference), transaction));
}

export function cashoutStatusLabel(status: string, locale: "vi" | "en") {
  const labels: Record<string, [string, string]> = {
    quote_ready: ["Báo giá sẵn sàng", "Quote ready"],
    quote_expired: ["Báo giá đã hết hạn", "Quote expired"],
    awaiting_wallet_signature: ["Chờ ký bằng ví", "Awaiting wallet signature"],
    onchain_pending: ["Đang chờ finalized", "Awaiting finalization"],
    bank_processing: ["USDC đã xác minh · đối soát thử nghiệm", "USDC verified · test reconciliation"],
    sandbox_completed: ["Đã hoàn tất trên Devnet", "Completed on Devnet"],
    onchain_failed: ["Xác minh thất bại", "Verification failed"],
  };
  return labels[status]?.[locale === "vi" ? 0 : 1] ?? status.replaceAll("_", " ");
}
