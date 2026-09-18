import type { CashoutEnvironment, CashoutQuote } from "../cashout.ts";
import type { FxReference } from "../fx-rates.ts";
import type { UsdcAmount } from "../../../../solana/server/payments.ts";

/** Persist this document unchanged. Runtime configuration must not reroute an order. */
export type FundingSnapshot = {
  provider: string; mode: "devnet_sandbox"; adapterVersion: "2"; termsVersion: "sandbox-v2";
  orderId: string; providerOrderId: string; userId: string; wallet: string;
  beneficiaryId: string; method: "bank" | "momo" | "zalopay";
  network: "solana:devnet"; mint: string; recipient: string; reference: string;
  amountAtomic: string; netVnd: string; currency: "VND"; country: "VN";
  quoteId: string; quoteCreatedAt: string; quoteExpiresAt: string; fundingDeadline: string;
  quoteKind: "test"; calculation: CashoutQuote | null;
};

export type PayoutEvent = {
  eventId: string; orderId: string; providerOrderId: string;
  provider: string; mode: "devnet_sandbox"; amountVnd: string; currency: "VND";
  status: "completed" | "failed"; bankReference?: string;
};

export interface OfframpProvider {
  readonly id: string;
  getCapabilities(): {
    mode: "devnet_sandbox"; network: "solana:devnet"; currency: "VND";
    country: "VN"; methods: readonly string[]; minAtomic: string; maxAtomic: string;
    kyc: "not_required_for_sandbox"; refunds: false; realPayoutEnabled: false;
  };
  getQuote(env: CashoutEnvironment, amount: UsdcAmount, reference: FxReference, now?: Date): CashoutQuote;
  createOrder(snapshot: FundingSnapshot, idempotencyKey: string): Promise<{ providerOrderId: string }>;
  getFundingInstructions(snapshot: FundingSnapshot): FundingSnapshot;
  getOrderStatus(snapshot: FundingSnapshot, cryptoConfirmed: boolean): Promise<PayoutEvent | null>;
  verifyAndNormalizeWebhook(raw: string, headers: Headers, secret: string, now?: number): Promise<PayoutEvent>;
}

export class OfframpError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 409) { super(message); this.code = code; this.status = status; }
}
