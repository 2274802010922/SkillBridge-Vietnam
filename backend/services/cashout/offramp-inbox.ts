import type { CashoutRow } from "./cashout-record.ts";
import { payloadHash, readFundingSnapshot } from "./offramp-snapshot.ts";
import { OfframpError, type PayoutEvent } from "./providers/types.ts";

export async function receivePayoutEvent(db: D1Database, event: PayoutEvent, rawHash = payloadHash(JSON.stringify(event))) {
  const identity = `${event.provider}:${event.mode}:${event.eventId}`;
  await db.prepare(`INSERT OR IGNORE INTO offramp_inbox
    (identity, provider, mode, event_id, order_id, payload_hash, event_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(identity, event.provider, event.mode, event.eventId, event.orderId, rawHash, JSON.stringify(event)).run();
  const saved = await db.prepare("SELECT payload_hash FROM offramp_inbox WHERE identity = ?").bind(identity).first<{ payload_hash: string }>();
  if (saved?.payload_hash !== rawHash) throw new OfframpError("Event ID reused with a different payload", "WEBHOOK_CONFLICT");
  return applyPayoutEvent(db, identity);
}

/** Resumes received/failed/expired leases. Changes, audit and acknowledgement commit together. */
export async function applyPayoutEvent(db: D1Database, identity: string) {
  const inbox = await db.prepare("SELECT * FROM offramp_inbox WHERE identity = ?").bind(identity)
    .first<{ status: string; event_json: string }>();
  if (!inbox) throw new OfframpError("Inbox event missing", "EVENT_MISSING", 404);
  if (inbox.status === "processed") return { processed: true, reused: true };
  if (inbox.status === "rejected") throw new OfframpError("Event quarantined: does not match the order", "EVENT_REJECTED");
  const token = crypto.randomUUID();
  const claim = await db.prepare(`UPDATE offramp_inbox SET status = 'processing', lease_token = ?, lease_until = ?, attempts = attempts + 1
    WHERE identity = ? AND status <> 'processed' AND lease_until <= ?`).bind(token, Date.now() + 30000, identity, Date.now()).run();
  if (!claim.meta.changes) return { processed: false, retryable: true };
  const event: PayoutEvent = JSON.parse(inbox.event_json);
  try {
    const order = await db.prepare("SELECT * FROM cashout_sessions WHERE id = ?").bind(event.orderId).first<CashoutRow>();
    if (!order) throw new OfframpError("Order not present yet", "ORDER_NOT_READY");
    const snapshot = readFundingSnapshot(order);
    if (event.provider !== snapshot.provider || event.mode !== snapshot.mode || event.providerOrderId !== snapshot.providerOrderId ||
      event.amountVnd !== snapshot.netVnd || event.currency !== snapshot.currency)
      throw new OfframpError("Provider event does not match order", "EVENT_ORDER_MISMATCH");
    if (!order.payment_tx || order.verification_state !== "verified") throw new OfframpError("Crypto reconciliation not complete", "CRYPTO_NOT_READY");
    if (!["bank_processing", "sandbox_completed", "payout_failed"].includes(order.status))
      throw new OfframpError("Order requires manual reconciliation", "ORDER_RECONCILIATION");
    const now = Date.now();
    const leaseSql = `EXISTS (SELECT 1 FROM offramp_inbox WHERE identity = ? AND lease_token = ? AND lease_until > ? AND status = 'processing')`;
    const eligible = `id = ? AND status = 'bank_processing' AND payment_tx IS NOT NULL AND verification_state = 'verified' AND ${leaseSql}`;
    const status = event.status === "completed" ? "sandbox_completed" : "payout_failed";
    const eventKey = `offramp:${identity}`;
    // Terminal results are monotonic: a late callback never regresses or silently retries a failed payout.
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json)
        SELECT ?, id, ?, 'payout.provider_result', ?, ? FROM cashout_sessions WHERE ${eligible}`)
        .bind(crypto.randomUUID(), eventKey, status, JSON.stringify({ eventId: event.eventId, realBankTransfer: false }), order.id, identity, token, now),
      db.prepare(`INSERT INTO audit_events (id, action, target_type, target_id, request_id, metadata_json)
        SELECT ?, 'cashout.provider_result', 'cashout_session', id, ?, ? FROM cashout_sessions WHERE ${eligible}`)
        .bind(crypto.randomUUID(), eventKey, JSON.stringify({ status, realBankTransfer: false }), order.id, identity, token, now),
      db.prepare(`UPDATE cashout_sessions SET status = ?, payout_status = ?, bank_reference = COALESCE(?, bank_reference),
        last_error_code = ?, updated_at = CURRENT_TIMESTAMP WHERE ${eligible}`)
        .bind(status, event.status === "completed" ? "sandbox_completed" : "provider_failed", event.bankReference || null,
          event.status === "failed" ? "SANDBOX_PAYOUT_FAILED" : null, order.id, identity, token, now),
      db.prepare(`UPDATE offramp_inbox SET status = 'processed', processed_at = CURRENT_TIMESTAMP, last_error = NULL,
        lease_until = 0 WHERE identity = ? AND lease_token = ? AND lease_until > ? AND EXISTS
        (SELECT 1 FROM cashout_sessions WHERE id = ? AND status IN ('sandbox_completed', 'payout_failed') AND payment_tx IS NOT NULL AND verification_state = 'verified')`)
        .bind(identity, token, now, order.id),
    ]);
    const result = await db.prepare("SELECT status FROM offramp_inbox WHERE identity = ?").bind(identity).first<{ status: string }>();
    return { processed: result?.status === "processed", retryable: result?.status !== "processed" };
  } catch (error) {
    const rejected = error instanceof OfframpError && ["EVENT_ORDER_MISMATCH", "SNAPSHOT_INVALID", "PROVIDER_UNAVAILABLE"].includes(error.code);
    await db.prepare(`UPDATE offramp_inbox SET status = ?, lease_until = 0, next_retry_at = ?, last_error = ?
      WHERE identity = ? AND lease_token = ? AND status <> 'processed'`)
      .bind(rejected ? "rejected" : "failed", Date.now() + 5000, error instanceof OfframpError ? error.code : "APPLY_RETRY_REQUIRED", identity, token).run();
    if (error instanceof OfframpError && ["ORDER_NOT_READY", "CRYPTO_NOT_READY", "ORDER_RECONCILIATION"].includes(error.code))
      return { processed: false, retryable: true };
    throw error;
  }
}

export async function resumeOrderInbox(db: D1Database, orderId: string) {
  const pending = await db.prepare(`SELECT identity FROM offramp_inbox WHERE order_id = ? AND status IN ('received','processing','failed') AND attempts < 20
    ORDER BY created_at, identity LIMIT 20`).bind(orderId).all<{ identity: string }>();
  for (const item of pending.results) await applyPayoutEvent(db, item.identity);
}
