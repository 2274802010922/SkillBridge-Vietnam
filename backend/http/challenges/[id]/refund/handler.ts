import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../auth/auth";
import { requireChallengeManager } from "../../../../auth/authorization";
import { auditStatement } from "../../../../services/audit/audit";
import { explorerTransaction } from "../../../../../solana/server/payments";
import { type RewardAsset } from "../../../../../solana/server/reward-vault";
import { journaledVaultTransfer } from "../../../../../solana/server/legacy-vault-journal";

type RefundFund = {
  id: string;
  asset: RewardAsset;
  funded_atomic: string;
  disbursed_atomic: string;
  refunded_atomic: string;
  sender_wallet: string | null;
  status: string;
  challenge_status: string;
  locked_at: string | null;
  refund_policy_state: string | null;
};

/** Return the undistributed Devnet reward balance to the wallet that funded the challenge. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    if (await env.DB.prepare("SELECT challenge_id FROM challenge_escrows WHERE challenge_id=?").bind(id).first()) return Response.json({error:"Hoàn quỹ theo điều kiện on-chain trong mục Quỹ thưởng."},{status:409});
    const fund = await env.DB.prepare(`
      SELECT f.*, c.status AS challenge_status
      FROM challenge_funds f JOIN challenges c ON c.id = f.challenge_id
      WHERE f.challenge_id = ?
    `).bind(id).first<RefundFund>();
    if (!fund || fund.status !== "funded" || !fund.sender_wallet) return Response.json({ error: "Challenge chưa có quỹ đã nạp để hoàn lại." }, { status: 409 });
    if (fund.sender_wallet !== user.walletAddress) return Response.json({ error: "Chỉ ví đã nạp quỹ mới có thể yêu cầu hoàn quỹ." }, { status: 403 });
    if (fund.challenge_status === "published" || (fund.locked_at && fund.challenge_status !== "closed")) return Response.json({ error: "Quỹ đã bị khóa khi challenge công bố và không thể hoàn đơn phương." }, { status: 409 });
    if (!['draft', 'closed'].includes(fund.challenge_status)) return Response.json({ error: "Hãy đóng challenge trước khi hoàn quỹ để bảo vệ người đang tham gia." }, { status: 409 });
    if (fund.challenge_status === "closed") {
      const unresolved = await env.DB.prepare(`
        SELECT COUNT(*) AS count FROM submissions s
        JOIN participations p ON p.id = s.participation_id
        WHERE p.challenge_id = ? AND p.state IN ('submitted', 'in_review', 'changes_requested')
      `).bind(id).first<{ count: number }>();
      if (Number(unresolved?.count ?? 0) > 0) return Response.json({ error: "Chưa thể hoàn quỹ: vẫn còn bài nộp đang chờ review hoặc chỉnh sửa." }, { status: 409 });
      const unpaidApproved = await env.DB.prepare(`
        SELECT COUNT(*) AS count FROM submissions s
        JOIN participations p ON p.id = s.participation_id
        LEFT JOIN challenge_payouts cp ON cp.submission_id = s.id AND cp.status = 'paid'
        WHERE p.challenge_id = ? AND p.state = 'approved' AND cp.id IS NULL
      `).bind(id).first<{ count: number }>();
      if (Number(unpaidApproved?.count ?? 0) > 0) return Response.json({ error: "Chưa thể hoàn quỹ: bài đã được phê duyệt cần được giải ngân trước." }, { status: 409 });
    }
    const refundExists = await env.DB.prepare("SELECT id FROM challenge_refunds WHERE challenge_id = ?").bind(id).first();
    if (refundExists) return Response.json({ error: "Challenge này đã có yêu cầu hoàn quỹ." }, { status: 409 });
    const amountAtomic = (BigInt(fund.funded_atomic) - BigInt(fund.disbursed_atomic) - BigInt(fund.refunded_atomic)).toString();
    if (BigInt(amountAtomic) <= BigInt(0)) return Response.json({ error: "Không còn số dư để hoàn." }, { status: 409 });
    const signature = String(await journaledVaultTransfer(env, fund.id, "refund:"+id, { recipientWallet: fund.sender_wallet, asset: fund.asset, amountAtomic }));
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM legacy_fund_locks WHERE fund_id=? AND operation_key=?").bind(fund.id, "refund:"+id),
      env.DB.prepare(`
        INSERT INTO challenge_refunds
          (id, challenge_id, challenge_fund_id, recipient_wallet, asset, amount_atomic, status, payment_tx, requested_by_user_id, refunded_at)
        VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
      `).bind(crypto.randomUUID(), id, fund.id, fund.sender_wallet, fund.asset, amountAtomic, signature, user.id, now),
      env.DB.prepare("UPDATE challenge_funds SET refunded_atomic = ?, status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(amountAtomic, fund.id),
      env.DB.prepare("UPDATE challenges SET funding_status = 'refunded', status = CASE WHEN status = 'draft' THEN 'draft' ELSE 'closed' END, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
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
