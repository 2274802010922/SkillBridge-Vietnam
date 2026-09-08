export type DraftFundingSnapshot = {
  challengeStatus: string;
  fundStatus?: string | null;
  fundingTx?: string | null;
  verificationState?: string | null;
  fundedAtomic?: string | null;
  disbursedAtomic?: string | null;
};

export type DraftDeletionDecision =
  | { allowed: true }
  | { allowed: false; code: "NOT_DRAFT" | "TRANSACTION_PENDING" | "PAYOUT_EXISTS" | "REFUND_REQUIRED" };

function positiveAtomic(value: string | null | undefined) {
  try { return BigInt(value || "0") > BigInt(0); } catch { return false; }
}

export function draftFinancialFieldsLocked(fundId: string | null | undefined) {
  return Boolean(fundId);
}

export function draftDeletionDecision(snapshot: DraftFundingSnapshot): DraftDeletionDecision {
  if (snapshot.challengeStatus !== "draft") return { allowed: false, code: "NOT_DRAFT" };
  if (["checking", "pending_finalization"].includes(snapshot.verificationState || "")) return { allowed: false, code: "TRANSACTION_PENDING" };
  if (positiveAtomic(snapshot.disbursedAtomic)) return { allowed: false, code: "PAYOUT_EXISTS" };
  const hasFundedValue = positiveAtomic(snapshot.fundedAtomic) || Boolean(snapshot.fundingTx) || snapshot.fundStatus === "funded";
  if (hasFundedValue && snapshot.fundStatus !== "refunded") return { allowed: false, code: "REFUND_REQUIRED" };
  return { allowed: true };
}
