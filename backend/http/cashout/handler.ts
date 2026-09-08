import {
  CASHOUT_PAYOUT_METHODS,
  cashoutCapabilities,
  CASHOUT_PROVIDER,
  createCashoutReference,
  createDevnetCashoutQuote,
  payoutProviderForMethod,
  type CashoutPayoutMethod,
} from "@/backend/services/cashout/cashout";
import {
  SELECT_CASHOUT,
  serializeCashout,
  type CashoutRow,
} from "@/backend/services/cashout/cashout-record";
import { getFxReference } from "@/backend/services/cashout/fx-rates";
import { env } from "@/backend/config/runtime-env";
import {
  assertSameOrigin,
  jsonError,
  requireSessionUser,
  sha256,
} from "../../auth/auth";
import { auditStatement } from "../../services/audit/audit";
import { parseUsdcAmount } from "../../../solana/server/payments";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await env.DB.prepare(
      `
      UPDATE cashout_sessions SET status = 'quote_expired', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND status IN ('quote_ready', 'awaiting_wallet_signature')
        AND quote_expires_at IS NOT NULL AND quote_expires_at <= ? AND payment_tx IS NULL AND submitted_tx IS NULL
    `,
    )
      .bind(user.id, new Date().toISOString())
      .run();
    const [sessions, capabilities] = await Promise.all([
      env.DB.prepare(
        `${SELECT_CASHOUT} WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 12`,
      )
        .bind(user.id)
        .all<CashoutRow>(),
      cashoutCapabilities(env),
    ]);
    return Response.json(
      {
        sessions: sessions.results.map((row) =>
          serializeCashout(row, env.SOLANA_USDC_MINT),
        ),
        capabilities,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

/** Create a short-lived Devnet quote bound to a tokenized test destination and settlement wallet. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as {
      amountUsdc?: string;
      beneficiaryId?: string;
      payoutMethod?: string;
    };
    const amount = parseUsdcAmount(body.amountUsdc || "");
    if (!amount || BigInt(amount.atomic) > BigInt("1000000000000"))
      return Response.json(
        { error: "Nhập số USDC hợp lệ, tối đa 1.000.000 USDC Devnet." },
        { status: 400 },
      );
    const payoutMethod = body.payoutMethod?.trim().toLowerCase() || "bank";
    if (!(CASHOUT_PAYOUT_METHODS as readonly string[]).includes(payoutMethod))
      return Response.json(
        { error: "Phương thức nhận thưởng không hợp lệ." },
        { status: 400 },
      );
    const typedPayoutMethod = payoutMethod as CashoutPayoutMethod;
    const beneficiary = await env.DB.prepare(
      `
      SELECT id, payout_method, payout_provider FROM cashout_beneficiaries
      WHERE id = ? AND user_id = ? AND status = 'sandbox_verified'
    `,
    )
      .bind(body.beneficiaryId?.trim() || "", user.id)
      .first<{ id: string; payout_method: string; payout_provider: string }>();
    if (!beneficiary || beneficiary.payout_method !== typedPayoutMethod) {
      return Response.json(
        { error: "Hãy thêm hoặc chọn đúng nơi nhận thử nghiệm trước." },
        { status: 400 },
      );
    }
    const capabilities = await cashoutCapabilities(env);
    if (!capabilities.devnetTransferEnabled || !capabilities.settlementWallet) {
      return Response.json(
        {
          error:
            capabilities.configurationError ||
            "Off-ramp Devnet chưa được cấu hình.",
        },
        { status: 503 },
      );
    }
    const marketReference = await getFxReference(env);
    if (marketReference.warning) {
      return Response.json(
        {
          error:
            "Các nguồn tỷ giá đang chênh lệch vượt ngưỡng an toàn. Hãy thử lại sau, không gửi USDC theo báo giá chưa ổn định.",
          code: "FX_SOURCES_DIVERGE",
        },
        { status: 503 },
      );
    }
    const calculation = createDevnetCashoutQuote(env, amount, marketReference);
    if (BigInt(calculation.netVnd) <= BigInt(0))
      return Response.json(
        { error: "Số tiền quá nhỏ sau phí thử nghiệm." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    const reference = createCashoutReference();
    const quoteId = `fxq_${crypto.randomUUID().replaceAll("-", "")}`;
    const providerReference = `SB-DEVNET-${id.slice(0, 8).toUpperCase()}`;
    const payoutProvider = payoutProviderForMethod(typedPayoutMethod, env);
    const quotePayload = {
      quoteId,
      marketReference,
      rateVnd: calculation.rateVnd,
      netVnd: calculation.netVnd,
      providerFeeVnd: calculation.providerFeeVnd,
      networkFeeVnd: calculation.networkFeeVnd,
      expiresAt: calculation.expiresAt,
    };
    const quotePayloadHash = await sha256(JSON.stringify(quotePayload));
    const rateStatements = marketReference.sources
      .filter((source) => source.rate)
      .map((source) =>
        env.DB.prepare(
          `
        INSERT INTO fx_rate_snapshots
          (id, cashout_session_id, provider, pair, rate, source_updated_at, freshness, confidence, payload_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        ).bind(
          crypto.randomUUID(),
          id,
          source.provider,
          source.pair,
          source.rate,
          source.updatedAt,
          source.freshness,
          source.confidence || null,
          quotePayloadHash,
        ),
      );
    await env.DB.batch([
      env.DB.prepare(
        `
        INSERT INTO cashout_sessions
          (id, user_id, beneficiary_id, wallet_address, amount_usdc, amount_atomic,
           estimated_vnd, fee_vnd, net_vnd, provider, payout_method, payout_provider, execution_mode, payout_status,
           status, provider_reference,
           rate_vnd, provider_fee_vnd, network_fee_vnd, quote_expires_at, rate_source,
           quote_id, reference_rate_vnd, usdc_usd_rate, usd_vnd_rate, reference_updated_at, reference_freshness, spread_bps, quote_payload_hash,
           settlement_wallet, reference_key, verification_state, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'devnet_sandbox', 'not_started', 'quote_ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_signature', ?)
      `,
      ).bind(
        id,
        user.id,
        beneficiary.id,
        user.walletAddress,
        amount.display,
        amount.atomic,
        calculation.grossVnd,
        calculation.feeVnd,
        calculation.netVnd,
        CASHOUT_PROVIDER,
        typedPayoutMethod,
        payoutProvider,
        providerReference,
        calculation.rateVnd,
        calculation.providerFeeVnd,
        calculation.networkFeeVnd,
        calculation.expiresAt,
        calculation.rateSource,
        quoteId,
        calculation.referenceRateVnd,
        calculation.usdcUsdRate,
        calculation.usdVndRate,
        calculation.referenceUpdatedAt,
        calculation.referenceFreshness,
        calculation.spreadBps,
        quotePayloadHash,
        capabilities.settlementWallet,
        reference,
        JSON.stringify({
          network: capabilities.network,
          mint: capabilities.mint,
          bankPayoutMode: capabilities.bankPayoutMode,
          payoutMethod: typedPayoutMethod,
          payoutProvider,
          realPayoutEnabled: capabilities.realPayoutEnabled,
          quote: {
            quoteId,
            referenceRateVnd: calculation.referenceRateVnd,
            referenceFreshness: calculation.referenceFreshness,
            sourceHash: calculation.sourceHash,
          },
        }),
      ),
      env.DB.prepare(
        `INSERT INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json) VALUES (?, ?, ?, 'quote.created', 'quote_ready', ?)`,
      ).bind(
        crypto.randomUUID(),
        id,
        `${id}:quote.created`,
        JSON.stringify({
          quoteId,
          expiresAt: calculation.expiresAt,
          rateSource: calculation.rateSource,
          referenceRateVnd: calculation.referenceRateVnd,
          sourceHash: calculation.sourceHash,
        }),
      ),
      auditStatement(env.DB, {
        actorUserId: user.id,
        action: "cashout.devnet_quote_created",
        targetType: "cashout_session",
        targetId: id,
        metadata: {
          amountUsdc: amount.display,
          providerReference,
          quoteId,
          quoteExpiresAt: calculation.expiresAt,
          payoutMethod: typedPayoutMethod,
          payoutProvider,
          referenceFreshness: calculation.referenceFreshness,
          sandboxBankPayout: true,
        },
      }),
      ...rateStatements,
    ]);
    const row = await env.DB.prepare(
      `${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`,
    )
      .bind(id, user.id)
      .first<CashoutRow>();
    return Response.json(
      {
        session: row ? serializeCashout(row, env.SOLANA_USDC_MINT) : null,
        capabilities,
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
