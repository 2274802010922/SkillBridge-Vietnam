import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../auth/auth";
import { SELECT_CASHOUT, serializeCashout, type CashoutRow } from "../../../services/cashout/cashout-record";
import { reconcileCashout, acceptCashoutQuote } from "../../../services/cashout/offramp-orchestrator";

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
        await env.DB.prepare("UPDATE cashout_sessions SET status = 'quote_expired', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'quote_ready' AND payment_tx IS NULL AND submitted_tx IS NULL").bind(id).run();
        return Response.json({ error: "Báo giá đã hết hạn. Hãy tạo báo giá mới.", code: "QUOTE_EXPIRED" }, { status: 409 });
      }
      await acceptCashoutQuote(env.DB, session);
    } else if (body.action === "refresh") {
      await reconcileCashout(env.DB, id);
    } else {
      return Response.json({ error: "Action cash-out không hợp lệ." }, { status: 400 });
    }
    const updated = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    return Response.json({ session: updated ? serializeCashout(updated, env.SOLANA_USDC_MINT) : null });
  } catch (error) { return jsonError(error); }
}
