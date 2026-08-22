import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../../lib/auth";
import { requireChallengeManager } from "../../../../../lib/authorization";
import { auditStatement } from "../../../../../lib/audit";
import { explorerTransaction } from "../../../../../lib/payments";
import { sendRewardVaultTransfer, type RewardAsset } from "../../../../../lib/reward-vault";

type RefundFund = {
  id: string;
  asset: RewardAsset;
  funded_atomic: string;
  disbursed_atomic: string;
  refunded_atomic: string;
  sender_wallet: string | null;
  status: string;
  challenge_status: string;
};

/** Return the undistributed Devnet reward balance to the wallet that funded the challenge. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const fund = await env.DB.prepare(`
      SELECT f.*, c.status AS challenge_status
      FROM challenge_funds f JOIN challenges c ON c.id = f.challenge_id
      WHERE f.challenge_id = ?
    `).bind(id).first<RefundFund>();
    if (!fund || fund.status !== "funded" || !fund.sender_wallet) return Response.json({ error: "Challenge chưa có quỹ đã nạp để hoàn lại." }, { status: 409 });
    if (fund.sender_wallet !== user.walletAddress) return Response.json({ error: "Chỉ ví đã nạp quỹ mới có thể yêu cầu hoàn quỹ." }, { status: 403 });
    if (!['draft', 'closed'].includes(fund.challenge_status)) return Response.json({ error: "Hãy đóng challenge trước khi hoàn quỹ để bảo vệ người đang tham gia." }, { status: 409 });
    const payout = await env.DB.prepare("SELECT id FROM challenge_payouts WHERE challenge_id = ? AND status = 'paid' LIMIT 1").bind(id).first();
    if (payout) return Response.json({ error: "Không thể hoàn quỹ sau khi đã giải ngân phần thưởng." }, { status: 409 });
    const refundExists = await env.DB.prepare("SELECT id FROM challenge_refunds WHERE challenge_id = ?").bind(id).first();
    if (refundExists) return Response.json({ error: "Challenge này đã có yêu cầu hoàn quỹ." }, { status: 409 });
    const amountAtomic = (BigInt(fund.funded_atomic) - BigInt(fund.disbursed_atomic) - BigInt(fund.refunded_atomic)).toString();
    if (BigInt(amountAtomic) <= BigInt(0)) return Response.json({ error: "Không còn số dư để hoàn." }, { status: 409 });
    const signature = String(await sendRewardVaultTransfer(env, { recipientWallet: fund.sender_wallet, asset: fund.asset, amountAtomic }));
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO challenge_refunds
          (id, challenge_id, challenge_fund_id, recipient_wallet, asset, amount_atomic, status, payment_tx, requested_by_user_id, refunded_at)
        VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
      `).bind(crypto.randomUUID(), id, fund.id, fund.sender_wallet, fund.asset, amountAtomic, signature, user.id, now),
      env.DB.prepare("UPDATE challenge_funds SET refunded_atomic = ?, status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(amountAtomic, fund.id),
      env.DB.prepare("UPDATE challenges SET funding_status = 'refunded', status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(id),
      auditStatement(env.DB, {
        actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.fund_refunded",
        targetType: "challenge", targetId: id,
        metadata: { fundId: fund.id, signature, asset: fund.asset, amountAtomic, recipientWallet: fund.sender_wallet },
      }),
    ]);
    return Response.json({ refund: { status: "paid", paymentTx: signature, explorerUrl: explorerTransaction(signature) } });
  } catch (error) { return jsonError(error); }
}
