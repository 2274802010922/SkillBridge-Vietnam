import { CASHOUT_PAYOUT_METHODS, cashoutCapabilities, CASHOUT_PROVIDER, createCashoutReference, payoutProviderForMethod, type CashoutPayoutMethod, type CashoutEnvironment } from "./cashout.ts";
import { SELECT_CASHOUT, serializeCashout, type CashoutRow } from "./cashout-record.ts";
import { getFxReference } from "./fx-rates.ts";
import { configuredProvider } from "./providers/registry.ts";
import { payloadHash } from "./offramp-snapshot.ts";
import { OfframpError, type FundingSnapshot } from "./providers/types.ts";
import { auditStatement } from "../audit/audit.ts";
import { parseUsdcAmount } from "../../../solana/server/payments.ts";

export type CreateCashoutInput = { amountUsdc?: string; beneficiaryId?: string; payoutMethod?: string };
/** Caller authenticates user; browser cannot choose the funding recipient or provider. */
export async function createCashoutOrder(db: D1Database, environment: CashoutEnvironment,
  user: { id: string; walletAddress: string }, body: CreateCashoutInput) {
    const amount = parseUsdcAmount(body.amountUsdc || "");
    if (!amount || BigInt(amount.atomic) > BigInt("1000000000000"))
      throw new OfframpError("Nhập số USDC hợp lệ, tối đa 1.000.000 USDC Devnet.", "INPUT_INVALID", 400);
    const payoutMethod = body.payoutMethod?.trim().toLowerCase() || "bank";
    if (!(CASHOUT_PAYOUT_METHODS as readonly string[]).includes(payoutMethod))
      throw new OfframpError("Phương thức nhận thưởng không hợp lệ.", "INPUT_INVALID", 400);
    const typedPayoutMethod = payoutMethod as CashoutPayoutMethod;
    const beneficiary = await db.prepare(
      `
      SELECT id, payout_method, payout_provider FROM cashout_beneficiaries
      WHERE id = ? AND user_id = ? AND status = 'sandbox_verified'
    `,
    )
      .bind(body.beneficiaryId?.trim() || "", user.id)
      .first<{ id: string; payout_method: string; payout_provider: string }>();
    if (!beneficiary || beneficiary.payout_method !== typedPayoutMethod) {
      throw new OfframpError("Hãy thêm hoặc chọn đúng nơi nhận thử nghiệm trước.", "INPUT_INVALID", 400);
    }
    const capabilities = await cashoutCapabilities(environment);
    if (!capabilities.devnetTransferEnabled || !capabilities.settlementWallet) {
      throw new OfframpError(capabilities.configurationError || "Off-ramp Devnet chưa được cấu hình.", "PROVIDER_UNAVAILABLE", 503);
    }
    const marketReference = await getFxReference(environment);
    if (marketReference.warning) {
      throw new OfframpError("Các nguồn tỷ giá đang chênh lệch vượt ngưỡng an toàn. Hãy thử lại sau, không gửi USDC theo báo giá chưa ổn định.", "FX_SOURCES_DIVERGE", 503);
    }
    const provider = configuredProvider(environment);
    const calculation = provider.getQuote(environment, amount, marketReference);
    if (BigInt(calculation.netVnd) <= BigInt(0))
      throw new OfframpError("Số tiền quá nhỏ sau phí thử nghiệm.", "INPUT_INVALID", 400);
    const id = crypto.randomUUID();
    const reference = createCashoutReference();
    const quoteId = `fxq_${crypto.randomUUID().replaceAll("-", "")}`;
    const providerReference = `SB-DEVNET-${id.slice(0, 8).toUpperCase()}`;
    const payoutProvider = payoutProviderForMethod(typedPayoutMethod, environment);
    const snapshot: FundingSnapshot = {
      provider: provider.id, mode: "devnet_sandbox", adapterVersion: "2", termsVersion: "sandbox-v2",
      orderId: id, providerOrderId: `sandbox:${id}`, userId: user.id, wallet: user.walletAddress,
      beneficiaryId: beneficiary.id, method: typedPayoutMethod,
      network: "solana:devnet", mint: capabilities.mint, recipient: capabilities.settlementWallet,
      reference, amountAtomic: amount.atomic, netVnd: calculation.netVnd, currency: "VND", country: "VN",
      quoteId, quoteCreatedAt: new Date().toISOString(), quoteExpiresAt: calculation.expiresAt,
      fundingDeadline: new Date(Date.parse(calculation.expiresAt) + 10 * 60 * 1000).toISOString(),
      quoteKind: "test", calculation,
    };
    provider.getFundingInstructions(snapshot);
    const quotePayload = {
      quoteId,
      marketReference,
      rateVnd: calculation.rateVnd,
      netVnd: calculation.netVnd,
      providerFeeVnd: calculation.providerFeeVnd,
      networkFeeVnd: calculation.networkFeeVnd,
      expiresAt: calculation.expiresAt,
    };
    const quotePayloadHash = payloadHash(JSON.stringify(quotePayload));
    const rateStatements = marketReference.sources
      .filter((source) => source.rate)
      .map((source) =>
        db.prepare(
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
    await db.batch([
      db.prepare(
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
          offramp: snapshot,
          offrampHash: payloadHash(JSON.stringify(snapshot)),
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
      db.prepare(
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
      auditStatement(db, {
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
    const row = await db.prepare(
      `${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`,
    )
      .bind(id, user.id)
      .first<CashoutRow>();
    return { session: row ? serializeCashout(row, environment.SOLANA_USDC_MINT || "") : null, capabilities };
}
