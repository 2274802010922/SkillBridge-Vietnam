import { cashoutCapabilities, CASHOUT_PROVIDER, createCashoutReference, createDevnetCashoutQuote } from "@/lib/cashout";
import { SELECT_CASHOUT, serializeCashout, type CashoutRow } from "@/lib/cashout-record";
import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";
import { auditStatement } from "../../../lib/audit";
import { parseUsdcAmount } from "../../../lib/payments";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await env.DB.prepare(`
      UPDATE cashout_sessions SET status = 'quote_expired', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND status IN ('quote_ready', 'awaiting_wallet_signature')
        AND quote_expires_at IS NOT NULL AND quote_expires_at <= ? AND payment_tx IS NULL AND submitted_tx IS NULL
    `).bind(user.id, new Date().toISOString()).run();
    const [sessions, capabilities] = await Promise.all([
      env.DB.prepare(`${SELECT_CASHOUT} WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 12`).bind(user.id).all<CashoutRow>(),
      cashoutCapabilities(env),
    ]);
    return Response.json({ sessions: sessions.results.map((row) => serializeCashout(row, env.SOLANA_USDC_MINT)), capabilities }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

/** Create a short-lived Devnet quote bound to a tokenized test beneficiary and settlement wallet. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { amountUsdc?: string; beneficiaryId?: string };
    const amount = parseUsdcAmount(body.amountUsdc || "");
    if (!amount || BigInt(amount.atomic) > BigInt("1000000000000")) return Response.json({ error: "Nhập số USDC hợp lệ, tối đa 1.000.000 USDC Devnet." }, { status: 400 });
    const beneficiary = await env.DB.prepare(`SELECT id FROM cashout_beneficiaries WHERE id = ? AND user_id = ? AND status = 'sandbox_verified'`)
      .bind(body.beneficiaryId?.trim() || "", user.id).first<{ id: string }>();
    if (!beneficiary) return Response.json({ error: "Hãy thêm hoặc chọn tài khoản nhận thử nghiệm trước." }, { status: 400 });
    const capabilities = await cashoutCapabilities(env);
    if (!capabilities.devnetTransferEnabled || !capabilities.settlementWallet) {
      return Response.json({ error: capabilities.configurationError || "Off-ramp Devnet chưa được cấu hình." }, { status: 503 });
    }
    const calculation = createDevnetCashoutQuote(env, amount);
    if (BigInt(calculation.netVnd) <= BigInt(0)) return Response.json({ error: "Số tiền quá nhỏ sau phí thử nghiệm." }, { status: 400 });
    const id = crypto.randomUUID();
    const reference = createCashoutReference();
    const providerReference = `SB-DEVNET-${id.slice(0, 8).toUpperCase()}`;
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO cashout_sessions
          (id, user_id, beneficiary_id, wallet_address, amount_usdc, amount_atomic,
           estimated_vnd, fee_vnd, net_vnd, provider, status, provider_reference,
           rate_vnd, provider_fee_vnd, network_fee_vnd, quote_expires_at, rate_source,
           settlement_wallet, reference_key, verification_state, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quote_ready', ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_signature', ?)
      `).bind(
        id, user.id, beneficiary.id, user.walletAddress, amount.display, amount.atomic,
        calculation.grossVnd, calculation.feeVnd, calculation.netVnd, CASHOUT_PROVIDER, providerReference,
        calculation.rateVnd, calculation.providerFeeVnd, calculation.networkFeeVnd, calculation.expiresAt,
        calculation.rateSource, capabilities.settlementWallet, reference,
        JSON.stringify({ network: capabilities.network, mint: capabilities.mint, bankPayoutMode: capabilities.bankPayoutMode }),
      ),
      env.DB.prepare(`INSERT INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json) VALUES (?, ?, ?, 'quote.created', 'quote_ready', ?)`)
        .bind(crypto.randomUUID(), id, `${id}:quote.created`, JSON.stringify({ expiresAt: calculation.expiresAt, rateSource: calculation.rateSource })),
      auditStatement(env.DB, {
        actorUserId: user.id, action: "cashout.devnet_quote_created", targetType: "cashout_session", targetId: id,
        metadata: { amountUsdc: amount.display, providerReference, quoteExpiresAt: calculation.expiresAt, sandboxBankPayout: true },
      }),
    ]);
    const row = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    return Response.json({ session: row ? serializeCashout(row, env.SOLANA_USDC_MINT) : null, capabilities }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
