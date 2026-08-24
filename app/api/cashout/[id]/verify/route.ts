import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../../lib/auth";
import { auditStatement } from "../../../../../lib/audit";
import { SELECT_CASHOUT, serializeCashout, type CashoutRow } from "../../../../../lib/cashout-record";
import { PaymentVerificationError, verifyUsdcPayment } from "../../../../../lib/payments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const body = await request.json() as { signature?: string; mode?: "automatic" | "manual" };
    const signature = body.signature?.trim() ?? "";
    const mode = body.mode === "manual" ? "manual" : "automatic";
    if (!signature) return Response.json({ error: "Cần transaction signature để xác minh.", code: "TX_INVALID" }, { status: 400 });
    const session = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    if (!session) return Response.json({ error: "Không tìm thấy lệnh rút tiền." }, { status: 404 });
    if (session.payment_tx) {
      if (session.payment_tx === signature && ["bank_processing", "sandbox_completed"].includes(session.status)) {
        return Response.json({ session: serializeCashout(session, env.SOLANA_USDC_MINT), reused: true });
      }
      if (session.payment_tx !== signature) return Response.json({ error: "Lệnh này đã gắn với một transaction khác. Không gửi thêm USDC.", code: "PAYMENT_TX_LOCKED" }, { status: 409 });
    }
    if (session.submitted_tx && session.submitted_tx !== signature && session.status === "onchain_pending") {
      return Response.json({ error: "Một transaction khác đang chờ finalized. Hãy kiểm tra lại signature đó, không gửi thêm USDC.", code: "PENDING_SIGNATURE_EXISTS" }, { status: 409 });
    }
    if (!["awaiting_wallet_signature", "onchain_pending", "onchain_failed", ...(mode === "manual" ? ["quote_expired"] : [])].includes(session.status)) {
      return Response.json({ error: "Lệnh chưa sẵn sàng để xác minh giao dịch.", code: "INVALID_ORDER_STATE" }, { status: 409 });
    }
    if (!session.settlement_wallet || !session.reference_key) return Response.json({ error: "Lệnh thiếu cấu hình settlement Devnet." }, { status: 503 });
    const duplicate = await env.DB.prepare("SELECT id, user_id FROM cashout_sessions WHERE (payment_tx = ? OR submitted_tx = ?) AND id <> ?").bind(signature, signature, id).first<{ id: string; user_id: string }>();
    if (duplicate) return Response.json({ error: "Transaction đã được sử dụng cho một lệnh khác.", code: "TX_ALREADY_USED" }, { status: 409 });

    await env.DB.batch([
      env.DB.prepare(`
        UPDATE cashout_sessions SET status = 'onchain_pending', submitted_tx = ?, verification_state = 'checking',
          last_error_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
      `).bind(signature, id, user.id),
      env.DB.prepare("INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json) VALUES (?, ?, ?, 'transaction.submitted', 'onchain_pending', ?)")
        .bind(crypto.randomUUID(), id, `${id}:transaction.submitted:${signature}`, JSON.stringify({ signature, mode })),
    ]);

    try {
      const payment = await verifyUsdcPayment({
        signature,
        recipientWallet: session.settlement_wallet,
        expectedAtomic: session.amount_atomic,
        rpcUrl: env.SOLANA_RPC_URL,
        mint: env.SOLANA_USDC_MINT,
        expectedReference: session.reference_key,
        expectedSenderWallet: session.wallet_address,
        requireFinalized: true,
        allowMissingReference: mode === "manual",
      });
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE cashout_sessions SET status = 'bank_processing', submitted_tx = ?, payment_tx = ?, payment_observed_at = ?,
            verification_state = 'verified', last_error_code = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ? AND submitted_tx = ?
        `).bind(signature, signature, payment.observedAt, id, user.id, signature),
        env.DB.prepare("INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json) VALUES (?, ?, ?, 'transaction.finalized', 'bank_processing', ?)")
          .bind(crypto.randomUUID(), id, `cashout.tx:${signature}`, JSON.stringify({ signature, amountAtomic: payment.amountAtomic, senderWallet: payment.senderWallet, recipientWallet: payment.recipientWallet, referenceMatched: payment.referenceMatched, network: "solana:devnet" })),
        auditStatement(env.DB, {
          actorUserId: user.id, action: "cashout.devnet_payment_verified", targetType: "cashout_session", targetId: id,
          metadata: { signature, amountAtomic: payment.amountAtomic, referenceMatched: payment.referenceMatched, mode },
        }),
      ]);
    } catch (error) {
      if (!(error instanceof PaymentVerificationError)) throw error;
      const pending = error.code === "NOT_FINALIZED" || error.code === "TX_NOT_FOUND" || error.code === "RPC_UNAVAILABLE";
      await env.DB.prepare(`
        UPDATE cashout_sessions SET status = ?, submitted_tx = ?, verification_state = ?, last_error_code = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ? AND submitted_tx = ?
      `).bind(pending ? "onchain_pending" : "onchain_failed", pending ? signature : null, pending ? "pending_finalization" : "failed", error.code, id, user.id, signature).run();
      const updated = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
      return Response.json({ error: error.message, code: error.code, retryable: error.retryable, session: updated ? serializeCashout(updated, env.SOLANA_USDC_MINT) : null }, { status: error.status });
    }
    const updated = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    return Response.json({ session: updated ? serializeCashout(updated, env.SOLANA_USDC_MINT) : null });
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return Response.json({ error: "Transaction đã được sử dụng cho một lệnh khác.", code: "TX_ALREADY_USED" }, { status: 409 });
    }
    return jsonError(error);
  }
}
