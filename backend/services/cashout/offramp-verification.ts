import { PaymentVerificationError, verifyUsdcPayment } from "../../../solana/server/payments.ts";
import type { CashoutRow } from "./cashout-record.ts";
import { fundingDisposition, readFundingSnapshot } from "./offramp-snapshot.ts";
import { OfframpError } from "./providers/types.ts";

export async function verifyCashoutFunding(db: D1Database, order: CashoutRow, signature: string,
  mode: "automatic" | "manual", rpcUrl?: string, verify = verifyUsdcPayment) {
  if (!signature) throw new OfframpError("Cần transaction signature.", "TX_INVALID", 400);
  if (order.payment_tx) {
    if (order.payment_tx === signature) return { reused: true };
    throw new OfframpError("Lệnh đã có giao dịch. Không gửi thêm USDC.", "PAYMENT_TX_LOCKED");
  }
  const snapshot = readFundingSnapshot(order);
  if (!["awaiting_wallet_signature", "onchain_pending", "onchain_failed", ...(mode === "manual" ? ["quote_expired"] : [])].includes(order.status))
    throw new OfframpError("Lệnh chưa sẵn sàng xác minh.", "INVALID_ORDER_STATE");
  // New journal enforces BOTH one signature/order and one order/signature across Vercel instances.
  // Legacy rows are checked inside the insert, not just with a racy preflight query.
  await db.prepare(`INSERT OR IGNORE INTO offramp_signature_claims (signature, order_id)
    SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM cashout_sessions WHERE id <> ? AND (payment_tx = ? OR submitted_tx = ?))
    AND EXISTS (SELECT 1 FROM cashout_sessions WHERE id = ? AND payment_tx IS NULL AND (submitted_tx IS NULL OR submitted_tx = ?))`)
    .bind(signature, order.id, order.id, signature, signature, order.id, signature).run();
  const claim = await db.prepare("SELECT order_id FROM offramp_signature_claims WHERE signature = ?").bind(signature).first<{ order_id: string }>();
  if (claim?.order_id !== order.id) throw new OfframpError("Một signature đang thuộc lệnh khác hoặc lệnh này đang kiểm tra signature khác. Không gửi thêm USDC.", "TX_ALREADY_USED");
  const marked = await db.prepare(`UPDATE cashout_sessions SET status = 'onchain_pending', submitted_tx = ?, verification_state = 'checking',
    last_error_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND payment_tx IS NULL
    AND (submitted_tx IS NULL OR submitted_tx = ?) AND status IN ('awaiting_wallet_signature','onchain_pending','onchain_failed','quote_expired')`)
    .bind(signature, order.id, signature).run();
  if (!marked.meta.changes) throw new OfframpError("Order changed; reload and verify the saved signature", "ORDER_CHANGED");
  try {
    const payment = await verify({ signature, recipientWallet: snapshot.recipient, expectedAtomic: snapshot.amountAtomic,
      rpcUrl, mint: snapshot.mint, expectedReference: snapshot.reference, expectedSenderWallet: snapshot.wallet,
      requireFinalized: true, allowMissingReference: mode === "manual", observePartialDeposit: true });
    const reason = fundingDisposition(snapshot, payment.amountAtomic, payment.blockTime ?? null);
    const state = reason ? "reconciliation_required" : "bank_processing";
    const eligible = "id = ? AND submitted_tx = ? AND payment_tx IS NULL AND status = 'onchain_pending'";
    const evidence = JSON.stringify({ signature, amountAtomic: payment.amountAtomic, referenceMatched: payment.referenceMatched,
      network: snapshot.network, mint: snapshot.mint, reason, mode });
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json)
        SELECT ?, id, ?, 'transaction.finalized', ?, ? FROM cashout_sessions WHERE ${eligible}`)
        .bind(crypto.randomUUID(), `cashout.tx:${signature}`, state, evidence, order.id, signature),
      db.prepare(`INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, request_id, metadata_json)
        SELECT ?, user_id, 'cashout.devnet_payment_verified', 'cashout_session', id, ?, ? FROM cashout_sessions WHERE ${eligible}`)
        .bind(crypto.randomUUID(), `cashout.tx:${signature}`, evidence, order.id, signature),
      db.prepare(`UPDATE cashout_sessions SET status = ?, payout_status = ?, payment_tx = ?, payment_observed_at = ?,
        verification_state = ?, last_error_code = ?, updated_at = CURRENT_TIMESTAMP WHERE ${eligible}`)
        .bind(state, reason ? "not_started" : "awaiting_provider", signature, payment.observedAt,
          reason ? "reconciliation_required" : "verified", reason, order.id, signature),
    ]);
    return { reconciliationRequired: Boolean(reason) };
  } catch (error) {
    if (!(error instanceof PaymentVerificationError)) throw error;
    const pending = ["NOT_FINALIZED", "TX_NOT_FOUND", "RPC_UNAVAILABLE"].includes(error.code);
    await db.batch([
      db.prepare(`UPDATE cashout_sessions SET status = ?, submitted_tx = ?, verification_state = ?, last_error_code = ?,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND submitted_tx = ? AND payment_tx IS NULL AND status = 'onchain_pending'`)
        .bind(pending ? "onchain_pending" : "onchain_failed", pending ? signature : null,
          pending ? "pending_finalization" : "failed", error.code, order.id, signature),
      ...(!pending ? [db.prepare(`DELETE FROM offramp_signature_claims WHERE signature = ? AND order_id = ? AND EXISTS
        (SELECT 1 FROM cashout_sessions WHERE id = ? AND payment_tx IS NULL AND submitted_tx IS NULL AND status = 'onchain_failed')`)
        .bind(signature, order.id, order.id)] : []),
    ]);
    throw error;
  }
}
