import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { auditStatement } from "../../../../lib/audit";
import { SELECT_CASHOUT, serializeCashout, type CashoutRow } from "../../../../lib/cashout-record";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    const session = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    if (!session) return Response.json({ error: "Không tìm thấy lệnh rút tiền." }, { status: 404 });
    const events = await env.DB.prepare(`
      SELECT event_type, status, metadata_json, created_at FROM cashout_events
      WHERE cashout_session_id = ? ORDER BY created_at ASC
    `).bind(id).all();
    return Response.json({ session: serializeCashout(session, env.SOLANA_USDC_MINT), events: events.results }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

/** Accept a quote or reconcile the Devnet provider state. Actual VND payout remains disabled. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const body = await request.json() as { action?: "accept_quote" | "refresh"; acceptedTerms?: boolean };
    const session = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    if (!session) return Response.json({ error: "Không tìm thấy lệnh rút tiền." }, { status: 404 });

    if (body.action === "accept_quote") {
      if (session.status === "awaiting_wallet_signature" && session.terms_accepted_at) return Response.json({ session: serializeCashout(session, env.SOLANA_USDC_MINT), reused: true });
      if (!body.acceptedTerms) return Response.json({ error: "Bạn cần xác nhận đây là giao dịch Devnet và VND chỉ là đối soát thử nghiệm." }, { status: 400 });
      if (session.status !== "quote_ready") return Response.json({ error: "Báo giá không còn ở trạng thái có thể xác nhận." }, { status: 409 });
      if (!session.quote_expires_at || new Date(session.quote_expires_at).getTime() <= Date.now()) {
        await env.DB.prepare("UPDATE cashout_sessions SET status = 'quote_expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
        return Response.json({ error: "Báo giá đã hết hạn. Hãy tạo báo giá mới.", code: "QUOTE_EXPIRED" }, { status: 409 });
      }
      const acceptedAt = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare("UPDATE cashout_sessions SET status = 'awaiting_wallet_signature', terms_accepted_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'quote_ready'")
          .bind(acceptedAt, id, user.id),
        env.DB.prepare("INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json) VALUES (?, ?, ?, 'quote.accepted', 'awaiting_wallet_signature', '{}')")
          .bind(crypto.randomUUID(), id, `${id}:quote.accepted`),
        auditStatement(env.DB, { actorUserId: user.id, action: "cashout.quote_accepted", targetType: "cashout_session", targetId: id, metadata: { devnet: true, sandboxBankPayout: true } }),
      ]);
    } else if (body.action === "refresh") {
      if (session.status === "sandbox_completed") return Response.json({ session: serializeCashout(session, env.SOLANA_USDC_MINT), reused: true });
      if (session.status !== "bank_processing" || !session.payment_tx) return Response.json({ error: "Chưa có giao dịch USDC finalized để đối soát." }, { status: 409 });
      const bankReference = session.bank_reference || `VND-SANDBOX-${id.slice(0, 8).toUpperCase()}`;
      await env.DB.batch([
        env.DB.prepare("UPDATE cashout_sessions SET status = 'sandbox_completed', bank_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'bank_processing'")
          .bind(bankReference, id, user.id),
        env.DB.prepare("INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json) VALUES (?, ?, ?, 'bank.sandbox_reconciled', 'sandbox_completed', ?)")
          .bind(crypto.randomUUID(), id, `${id}:bank.sandbox_reconciled`, JSON.stringify({ bankReference, realBankTransfer: false })),
        auditStatement(env.DB, { actorUserId: user.id, action: "cashout.sandbox_bank_reconciled", targetType: "cashout_session", targetId: id, metadata: { bankReference, realBankTransfer: false } }),
      ]);
    } else {
      return Response.json({ error: "Action cash-out không hợp lệ." }, { status: 400 });
    }
    const updated = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    return Response.json({ session: updated ? serializeCashout(updated, env.SOLANA_USDC_MINT) : null });
  } catch (error) { return jsonError(error); }
}
