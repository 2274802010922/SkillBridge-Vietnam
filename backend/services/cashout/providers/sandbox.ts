import { createHmac, timingSafeEqual } from "node:crypto";
import bs58 from "bs58";
import { createDevnetCashoutQuote } from "../cashout.ts";
import { OfframpError, type FundingSnapshot, type OfframpProvider, type PayoutEvent } from "./types.ts";

export const SANDBOX_PROVIDER = "skillbridge_devnet_offramp";
export function sandboxSignature(secret: string, timestamp: string, eventId: string, raw: string) {
  return `v2=${createHmac("sha256", secret).update(`${timestamp}.${eventId}.${raw}`).digest("hex")}`;
}

export class SandboxProvider implements OfframpProvider {
  readonly id = SANDBOX_PROVIDER;
  getCapabilities() {
    return { mode: "devnet_sandbox", network: "solana:devnet", currency: "VND", country: "VN",
      methods: ["bank", "momo", "zalopay"], minAtomic: "1", maxAtomic: "1000000000000",
      kyc: "not_required_for_sandbox", refunds: false, realPayoutEnabled: false } as const;
  }
  getQuote = createDevnetCashoutQuote;
  getFundingInstructions(s: FundingSnapshot) {
    if (s.provider !== this.id || s.mode !== "devnet_sandbox" || s.adapterVersion !== "2" ||
      s.network !== "solana:devnet" || s.country !== "VN" || s.currency !== "VND" ||
      !this.getCapabilities().methods.includes(s.method) || !/^\d+$/.test(s.amountAtomic) ||
      BigInt(s.amountAtomic) < BigInt(1) || BigInt(s.amountAtomic) > BigInt("1000000000000") ||
      !/^\d+$/.test(s.netVnd) || BigInt(s.netVnd) <= BigInt(0) ||
      ![s.mint, s.recipient, s.wallet, s.reference].every(validAddress) ||
      !Number.isFinite(Date.parse(s.quoteCreatedAt)) || !Number.isFinite(Date.parse(s.fundingDeadline)) || !Number.isFinite(Date.parse(s.quoteExpiresAt))) {
      throw new OfframpError("Unsupported or damaged sandbox funding snapshot", "SNAPSHOT_INVALID", 422);
    }
    return s;
  }
  async createOrder(snapshot: FundingSnapshot, idempotencyKey: string) {
    this.getFundingInstructions(snapshot);
    if (idempotencyKey !== `create:${snapshot.orderId}`) throw new OfframpError("Invalid operation key", "OPERATION_CONFLICT");
    // Pure, deterministic sandbox simulation: retrying never creates another payout.
    return { providerOrderId: snapshot.providerOrderId };
  }
  async getOrderStatus(snapshot: FundingSnapshot, cryptoConfirmed: boolean): Promise<PayoutEvent | null> {
    this.getFundingInstructions(snapshot);
    if (!cryptoConfirmed) return null;
    return { eventId: `sandbox-status:${snapshot.orderId}`, orderId: snapshot.orderId,
      providerOrderId: snapshot.providerOrderId, provider: this.id, mode: snapshot.mode,
      amountVnd: snapshot.netVnd, currency: "VND", status: "completed",
      bankReference: `VND-SANDBOX-${snapshot.orderId}` };
  }
  async verifyAndNormalizeWebhook(raw: string, headers: Headers, secret: string, now = Date.now()): Promise<PayoutEvent> {
    const eventId = headers.get("x-skillbridge-event-id") || "";
    const timestamp = headers.get("x-skillbridge-timestamp") || "";
    const signature = headers.get("x-skillbridge-signature") || "";
    if (Buffer.byteLength(raw) > 65536) throw new OfframpError("Payload too large", "WEBHOOK_SIZE", 413);
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(eventId) || !/^\d{10}$/.test(timestamp) ||
      Math.abs(now - Number(timestamp) * 1000) > 300000) throw new OfframpError("Webhook expired or invalid headers", "WEBHOOK_REPLAY", 401);
    const expected = sandboxSignature(secret, timestamp, eventId, raw);
    if (!/^v2=[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      throw new OfframpError("Invalid webhook signature", "WEBHOOK_SIGNATURE", 401);
    let event: PayoutEvent;
    try { event = JSON.parse(raw); } catch { throw new OfframpError("Invalid JSON", "WEBHOOK_PAYLOAD", 400); }
    if (!event || event.provider !== this.id || event.mode !== "devnet_sandbox" ||
      typeof event.orderId !== "string" || !/^[\w-]{1,100}$/.test(event.orderId) ||
      typeof event.providerOrderId !== "string" || event.providerOrderId.length > 160 ||
      event.currency !== "VND" || !/^\d{1,24}$/.test(event.amountVnd) ||
      !["completed", "failed"].includes(event.status) ||
      (event.status === "completed" && !/^VND-SANDBOX-[\w-]{1,100}$/.test(event.bankReference || "")))
      throw new OfframpError("Invalid sandbox event", "WEBHOOK_PAYLOAD", 400);
    // Whitelist fields: neither raw bank data nor arbitrary provider payload enters the journal.
    return { eventId, orderId: event.orderId, providerOrderId: event.providerOrderId,
      provider: this.id, mode: "devnet_sandbox", amountVnd: event.amountVnd,
      currency: "VND", status: event.status,
      ...(event.status === "completed" ? { bankReference: event.bankReference } : {}) };
  }
}

function validAddress(value: string) {
  try { return bs58.decode(value).length === 32; } catch { return false; }
}
