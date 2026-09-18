import type { CashoutRow } from "./cashout-record.ts";
import { readFundingSnapshot } from "./offramp-snapshot.ts";
import { ensureProviderOrder } from "./offramp-operations.ts";
import { receivePayoutEvent, resumeOrderInbox } from "./offramp-inbox.ts";
import { storedProvider } from "./providers/registry.ts";
import { OfframpError } from "./providers/types.ts";

export async function acceptCashoutQuote(db: D1Database, order: CashoutRow) {
  await ensureProviderOrder(db, readFundingSnapshot(order));
  const acceptedAt = new Date().toISOString();
  if (!order.quote_expires_at || order.quote_expires_at <= acceptedAt)
    throw new OfframpError("Quote expired. Do not send funds.", "QUOTE_EXPIRED");
  const eligible = "id = ? AND user_id = ? AND status = 'quote_ready' AND quote_expires_at > ? AND payment_tx IS NULL AND submitted_tx IS NULL";
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json)
      SELECT ?, id, ?, 'quote.accepted', 'awaiting_wallet_signature', '{}' FROM cashout_sessions WHERE ${eligible}`)
      .bind(crypto.randomUUID(), `${order.id}:quote.accepted`, order.id, order.user_id, acceptedAt),
    db.prepare(`INSERT INTO audit_events (id,actor_user_id,action,target_type,target_id,request_id,metadata_json)
      SELECT ?, user_id, 'cashout.quote_accepted', 'cashout_session', id, ?, '{"devnet":true,"sandboxBankPayout":true}'
      FROM cashout_sessions WHERE ${eligible}`).bind(crypto.randomUUID(), `${order.id}:quote.accepted`, order.id, order.user_id, acceptedAt),
    db.prepare(`UPDATE cashout_sessions SET status = 'awaiting_wallet_signature', terms_accepted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE ${eligible}`)
      .bind(acceptedAt, order.id, order.user_id, acceptedAt),
  ]);
}

export async function reconcileCashout(db: D1Database, orderId: string) {
  await resumeOrderInbox(db, orderId);
  const order = await db.prepare("SELECT * FROM cashout_sessions WHERE id = ?").bind(orderId).first<CashoutRow>();
  if (!order) throw new OfframpError("Order not found", "ORDER_NOT_FOUND", 404);
  const snapshot = readFundingSnapshot(order);
  if (["sandbox_completed", "payout_failed", "reconciliation_required"].includes(order.status)) return;
  if (order.status !== "bank_processing" || !order.payment_tx || order.verification_state !== "verified")
    throw new OfframpError("Verify the existing Devnet signature first; do not send again", "CRYPTO_NOT_READY");
  const provider = storedProvider(snapshot.provider, snapshot.mode, snapshot.adapterVersion);
  await ensureProviderOrder(db, snapshot, provider);
  const event = await provider.getOrderStatus(snapshot, true);
  if (event) await receivePayoutEvent(db, event);
}
