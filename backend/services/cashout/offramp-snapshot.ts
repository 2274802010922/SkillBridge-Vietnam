import { createHash } from "node:crypto";
import type { CashoutRow } from "./cashout-record.ts";
import { storedProvider } from "./providers/registry.ts";
import { OfframpError, type FundingSnapshot } from "./providers/types.ts";

export function payloadHash(value: string) { return createHash("sha256").update(value).digest("hex"); }

export function readFundingSnapshot(row: CashoutRow): FundingSnapshot {
  const metadata = JSON.parse(row.metadata_json || "{}");
  let snapshot: FundingSnapshot = metadata.offramp;
  if (snapshot) {
    if (metadata.offrampHash !== payloadHash(JSON.stringify(snapshot)))
      throw new OfframpError("Funding snapshot hash mismatch", "SNAPSHOT_INVALID", 422);
  } else {
    // Legacy recovery deliberately requires the STORED mint, never a current environment default.
    if (!metadata.mint || metadata.network !== "solana:devnet")
      throw new OfframpError("Legacy order has no reliable network/mint snapshot. Manual reconciliation required; do not resend.", "LEGACY_RECONCILIATION", 409);
    snapshot = {
      provider: row.provider, mode: row.execution_mode as "devnet_sandbox", adapterVersion: "2", termsVersion: "sandbox-v2",
      orderId: row.id, providerOrderId: `sandbox:${row.id}`, userId: row.user_id,
      wallet: row.wallet_address, beneficiaryId: row.beneficiary_id || "legacy",
      method: row.payout_method as FundingSnapshot["method"], network: metadata.network,
      mint: metadata.mint, recipient: row.settlement_wallet || "", reference: row.reference_key || "",
      amountAtomic: row.amount_atomic, netVnd: row.net_vnd, currency: "VND", country: "VN",
      quoteId: row.quote_id || row.id,
      quoteCreatedAt: row.created_at.includes("T") ? row.created_at : row.created_at.replace(" ", "T") + "Z",
      quoteExpiresAt: row.quote_expires_at || "",
      // No retroactive extension of legacy quotes.
      fundingDeadline: row.quote_expires_at || "", quoteKind: "test", calculation: null,
    };
  }
  if (snapshot.orderId !== row.id || snapshot.userId !== row.user_id || snapshot.wallet !== row.wallet_address ||
    snapshot.provider !== row.provider || snapshot.mode !== row.execution_mode ||
    snapshot.amountAtomic !== row.amount_atomic || snapshot.netVnd !== row.net_vnd ||
    snapshot.recipient !== row.settlement_wallet || snapshot.reference !== row.reference_key ||
    snapshot.beneficiaryId !== (row.beneficiary_id || "legacy") || snapshot.method !== row.payout_method ||
    snapshot.quoteExpiresAt !== row.quote_expires_at)
    throw new OfframpError("Order differs from immutable quote", "SNAPSHOT_INVALID", 422);
  return storedProvider(snapshot.provider, snapshot.mode, snapshot.adapterVersion).getFundingInstructions(snapshot);
}

export function fundingDisposition(snapshot: FundingSnapshot, amount: string, blockTime: number | null) {
  if (BigInt(amount) < BigInt(snapshot.amountAtomic)) return "UNDERPAYMENT";
  if (BigInt(amount) > BigInt(snapshot.amountAtomic)) return "OVERPAYMENT";
  if (blockTime === null) return "BLOCK_TIME_UNKNOWN";
  if (blockTime < Math.floor(Date.parse(snapshot.quoteCreatedAt) / 1000)) return "FUNDING_BEFORE_QUOTE";
  if (blockTime * 1000 > Date.parse(snapshot.fundingDeadline)) return "LATE_FUNDING";
  return null;
}
