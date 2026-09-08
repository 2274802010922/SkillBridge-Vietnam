import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../../auth/auth";
import { requireChallengeManager } from "../../../../../auth/authorization";
import { auditStatement } from "../../../../../services/audit/audit";
import { explorerTransaction, PaymentVerificationError, verifySolPayment, verifyUsdcPayment } from "../../../../../../solana/server/payments";

type FundRow = {
  id: string;
  challenge_id: string;
  organization_id: string;
  created_by_user_id: string;
  expected_sender_wallet: string | null;
  asset: "usdc" | "sol";
  required_atomic: string;
  vault_wallet: string;
  reference_key: string;
  status: string;
  funding_tx: string | null;
  submitted_tx: string | null;
  verification_state: string | null;
  last_verification_error_code: string | null;
  verification_checked_at: string | null;
};

function serializeFunding(fund: FundRow, extra?: { amountAtomic?: string; referenceMatched?: boolean; reused?: boolean }) {
  return {
    id: fund.id,
    status: fund.status,
    fundingTx: fund.funding_tx,
    submittedTx: fund.submitted_tx,
    verificationState: fund.verification_state ?? "awaiting_signature",
    lastVerificationErrorCode: fund.last_verification_error_code,
    verificationCheckedAt: fund.verification_checked_at,
    amountAtomic: extra?.amountAtomic ?? null,
    referenceMatched: extra?.referenceMatched ?? null,
    explorerUrl: fund.funding_tx ? explorerTransaction(fund.funding_tx) : fund.submitted_tx ? explorerTransaction(fund.submitted_tx) : null,
    ...(extra?.reused ? { reused: true } : {}),
  };
}

async function findFund(challengeId: string) {
  return env.DB.prepare(`
    SELECT f.*, c.organization_id, c.created_by_user_id, w.address AS expected_sender_wallet
    FROM challenge_funds f
    JOIN challenges c ON c.id = f.challenge_id
    LEFT JOIN wallets w ON w.user_id = c.created_by_user_id
    WHERE f.challenge_id = ?
  `).bind(challengeId).first<FundRow>();
}

async function markVerification(fund: FundRow, signature: string, state: string, errorCode: string | null) {
  await env.DB.prepare(`
    UPDATE challenge_funds
    SET submitted_tx = ?, verification_state = ?, last_verification_error_code = ?,
      verification_checked_at = CURRENT_TIMESTAMP, verification_attempts = verification_attempts + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'awaiting_payment'
  `).bind(signature, state, errorCode, fund.id).run();
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const body = await request.json() as { signature?: string; mode?: "automatic" | "manual" };
    const signature = body.signature?.trim();
    const mode = body.mode === "manual" ? "manual" : "automatic";
    if (!signature) return Response.json({ error: "Cần transaction signature để xác minh quỹ.", code: "TX_INVALID" }, { status: 400 });
    const fund = await findFund(id);
    if (!fund) return Response.json({ error: "Hãy chuẩn bị nạp quỹ trước.", code: "FUNDING_NOT_PREPARED" }, { status: 404 });

    if (fund.status === "funded") {
      if (signature === fund.funding_tx) return Response.json({ funding: serializeFunding(fund, { reused: true }) });
      return Response.json({ error: "Challenge đã có một transaction funding hợp lệ khác.", code: "FUND_ALREADY_FUNDED", funding: serializeFunding(fund) }, { status: 409 });
    }
    if (fund.status !== "awaiting_payment") return Response.json({ error: "Trạng thái quỹ hiện không thể xác minh.", code: "FUNDING_NOT_PENDING" }, { status: 409 });
    if (fund.verification_state === "pending_finalization" && fund.submitted_tx && fund.submitted_tx !== signature) {
      return Response.json({ error: "Một transaction khác đang chờ finalized. Hãy xác minh lại signature đó, không nạp thêm.", code: "PENDING_SIGNATURE_EXISTS", retryable: true, funding: serializeFunding(fund) }, { status: 409 });
    }

    await markVerification(fund, signature, "checking", null);
    try {
      const payment = fund.asset === "sol"
        ? await verifySolPayment({ signature, recipientWallet: fund.vault_wallet, expectedAtomic: fund.required_atomic, rpcUrl: env.SOLANA_RPC_URL, expectedReference: fund.reference_key, expectedSenderWallet: fund.expected_sender_wallet ?? undefined, requireFinalized: true, allowMissingReference: mode === "manual" })
        : await verifyUsdcPayment({ signature, recipientWallet: fund.vault_wallet, expectedAtomic: fund.required_atomic, rpcUrl: env.SOLANA_RPC_URL, mint: env.SOLANA_USDC_MINT, expectedReference: fund.reference_key, expectedSenderWallet: fund.expected_sender_wallet ?? undefined, requireFinalized: true, allowMissingReference: mode === "manual" });

      const duplicate = await env.DB.prepare("SELECT challenge_fund_id FROM challenge_funding_events WHERE signature = ?").bind(signature).first<{ challenge_fund_id: string }>();
      if (duplicate && duplicate.challenge_fund_id !== fund.id) {
        await markVerification(fund, signature, "failed", "TX_ALREADY_USED");
        return Response.json({ error: "Transaction này đã được dùng cho challenge khác.", code: "TX_ALREADY_USED", retryable: false }, { status: 409 });
      }
      if (duplicate?.challenge_fund_id === fund.id) {
        return Response.json({ funding: serializeFunding({ ...fund, status: "funded", funding_tx: signature, submitted_tx: signature, verification_state: "verified" }, { amountAtomic: payment.amountAtomic, referenceMatched: payment.referenceMatched, reused: true }) });
      }

      const now = payment.observedAt;
      try {
        await env.DB.batch([
          env.DB.prepare(`
            UPDATE challenge_funds SET status = 'funded', funded_atomic = ?, sender_wallet = ?,
              funding_tx = ?, submitted_tx = ?, verification_state = 'verified', last_verification_error_code = NULL,
              verification_checked_at = CURRENT_TIMESTAMP, funded_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'awaiting_payment'
          `).bind(payment.amountAtomic, payment.senderWallet, signature, signature, now, fund.id),
          env.DB.prepare(`
            INSERT INTO challenge_funding_events
              (id, challenge_fund_id, signature, sender_wallet, recipient_wallet, amount_atomic, asset, observed_at, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(crypto.randomUUID(), fund.id, signature, payment.senderWallet, fund.vault_wallet, payment.amountAtomic, fund.asset, payment.observedAt, JSON.stringify({ reference: fund.reference_key, referenceMatched: payment.referenceMatched, mode })),
          env.DB.prepare("UPDATE challenges SET funding_status = 'funded', funded_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(now, id),
          auditStatement(env.DB, {
            actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.funding_verified",
            targetType: "challenge", targetId: id,
            metadata: { fundId: fund.id, asset: fund.asset, signature, amountAtomic: payment.amountAtomic, vaultWallet: fund.vault_wallet, mode, referenceMatched: payment.referenceMatched },
          }),
        ]);
      } catch (error) {
        const raced = await env.DB.prepare("SELECT challenge_fund_id FROM challenge_funding_events WHERE signature = ?").bind(signature).first<{ challenge_fund_id: string }>();
        if (raced?.challenge_fund_id === fund.id) {
          return Response.json({ funding: { id: fund.id, status: "funded", fundingTx: signature, submittedTx: signature, verificationState: "verified", amountAtomic: payment.amountAtomic, referenceMatched: payment.referenceMatched, explorerUrl: explorerTransaction(signature) }, reused: true });
        }
        if (raced) return Response.json({ error: "Transaction này đã được dùng cho challenge khác.", code: "TX_ALREADY_USED", retryable: false }, { status: 409 });
        throw error;
      }
      return Response.json({ funding: { id: fund.id, status: "funded", fundingTx: signature, submittedTx: signature, verificationState: "verified", amountAtomic: payment.amountAtomic, referenceMatched: payment.referenceMatched, explorerUrl: explorerTransaction(signature) } });
    } catch (error) {
      if (error instanceof PaymentVerificationError) {
        const pending = error.code === "NOT_FINALIZED";
        await markVerification(fund, signature, pending ? "pending_finalization" : "failed", error.code);
        return Response.json({ error: error.message, code: error.code, retryable: error.retryable, funding: serializeFunding({ ...fund, submitted_tx: signature, verification_state: pending ? "pending_finalization" : "failed", last_verification_error_code: error.code }) }, { status: error.status });
      }
      throw error;
    }
  } catch (error) { return jsonError(error); }
}
