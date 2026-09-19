import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../auth/auth";
import { requireOrganizationRole } from "../../auth/authorization";
import { auditStatement } from "../../services/audit/audit";
import { explorerTransaction, formatSolAtomic, formatUsdcAtomic } from "../../../solana/server/payments";
import { type RewardAsset } from "../../../solana/server/reward-vault";
import { journaledVaultTransfer } from "../../../solana/server/legacy-vault-journal";

type PayoutRow = {
  challenge_id: string;
  challenge_title: string;
  organization_id: string;
  organization_name: string;
  reward_type: string;
  reward_asset: RewardAsset | null;
  reward_amount_usdc: string | null;
  reward_amount_atomic: string | null;
  fund_id: string | null;
  fund_status: string | null;
  required_atomic: string | null;
  funded_atomic: string | null;
  disbursed_atomic: string | null;
  refunded_atomic: string | null;
  submission_id: string;
  submission_state: string;
  submitted_at: string | null;
  student_user_id: string;
  recipient_wallet: string;
  student_name: string | null;
  assessment_status: string;
  payout_id: string | null;
  payout_status: string | null;
  payment_tx: string | null;
  paid_at: string | null;
  escrow_id?: string | null;
};

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT c.id AS challenge_id, c.title AS challenge_title, c.organization_id,
        o.name AS organization_name, c.reward_type, c.reward_asset,
        c.reward_amount_usdc, c.reward_amount_atomic,
        f.id AS fund_id, f.status AS fund_status, f.required_atomic, f.funded_atomic,
        f.disbursed_atomic, f.refunded_atomic,
        e.id AS escrow_id,
        s.id AS submission_id, s.state AS submission_state, s.submitted_at,
        p.student_user_id, w.address AS recipient_wallet, u.display_name AS student_name,
        a.status AS assessment_status, cp.id AS payout_id, cp.status AS payout_status,
        cp.payment_tx, cp.paid_at
      FROM challenges c
      JOIN organizations o ON o.id = c.organization_id
      JOIN memberships m ON m.organization_id = c.organization_id AND m.user_id = ?
        AND m.status = 'active' AND m.role IN ('business_admin','challenge_manager')
      JOIN participations p ON p.challenge_id = c.id
      JOIN submissions s ON s.participation_id = p.id
      JOIN wallets w ON w.user_id = p.student_user_id
      JOIN users u ON u.id = p.student_user_id
      JOIN assessments a ON a.submission_id = s.id AND a.status = 'approved'
      LEFT JOIN challenge_funds f ON f.challenge_id = c.id
      LEFT JOIN challenge_escrows e ON e.challenge_id = c.id
      LEFT JOIN challenge_payouts cp ON cp.submission_id = s.id
      WHERE c.reward_type IN ('usdc', 'sol') AND c.reward_amount_atomic IS NOT NULL
      ORDER BY s.submitted_at DESC
    `).bind(user.id).all<PayoutRow>();
    return Response.json({ payouts: rows.results }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

/** A business reviewer approves a payout; SkillBridge signs from the funded Devnet vault. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { submissionId?: string };
    const submissionId = body.submissionId?.trim() ?? "";
    if (!submissionId) return Response.json({ error: "Cần chọn bài nộp để giải ngân." }, { status: 400 });
    const row = await env.DB.prepare(`
      SELECT c.id AS challenge_id, c.organization_id, c.title AS challenge_title,
        c.reward_type, c.reward_asset, c.reward_amount_usdc, c.reward_amount_atomic,
        p.student_user_id, w.address AS recipient_wallet, a.status AS assessment_status,
        cp.status AS payout_status, f.id AS fund_id, f.status AS fund_status,
        f.asset AS fund_asset, f.funded_atomic, f.disbursed_atomic, f.refunded_atomic
        , e.id AS escrow_id
      FROM submissions s
      JOIN participations p ON p.id = s.participation_id
      JOIN challenges c ON c.id = p.challenge_id
      JOIN wallets w ON w.user_id = p.student_user_id
      JOIN assessments a ON a.submission_id = s.id
      LEFT JOIN challenge_payouts cp ON cp.submission_id = s.id
      LEFT JOIN challenge_funds f ON f.challenge_id = c.id
      LEFT JOIN challenge_escrows e ON e.challenge_id = c.id
      WHERE s.id = ?
    `).bind(submissionId).first<PayoutRow & { fund_asset: RewardAsset | null }>();
    if (!row) return Response.json({ error: "Bài nộp không tồn tại." }, { status: 404 });
    if (await env.DB.prepare("SELECT challenge_id FROM challenge_escrows WHERE challenge_id=?").bind(row.challenge_id).first()) return Response.json({error:"Phần thưởng được quản lý bởi program. Mở mục Quỹ thưởng để nhận.",escrowUrl:"/app/escrow?challenge="+row.challenge_id},{status:409});
    await requireOrganizationRole(user.id, row.organization_id, ["business_admin", "challenge_manager"], "business");
    if (row.assessment_status !== "approved") return Response.json({ error: "Chỉ có thể giải ngân bài đã được reviewer phê duyệt." }, { status: 409 });
    if (!row.reward_amount_atomic || !row.reward_amount_usdc || !row.fund_id || row.fund_status !== "funded" || !row.fund_asset) return Response.json({ error: "Challenge chưa có quỹ thưởng Devnet đã xác minh." }, { status: 409 });
    if (row.payout_status === "paid") return Response.json({ error: "Bài nộp này đã được giải ngân." }, { status: 409 });
    const available = BigInt(row.funded_atomic ?? "0") - BigInt(row.disbursed_atomic ?? "0") - BigInt(row.refunded_atomic ?? "0");
    const amount = BigInt(row.reward_amount_atomic);
    if (available < amount) return Response.json({ error: "Quỹ còn lại không đủ để giải ngân phần thưởng này." }, { status: 409 });

    const signature = String(await journaledVaultTransfer(env, row.fund_id!, "payout:"+submissionId, {
      recipientWallet: row.recipient_wallet, asset: row.fund_asset, amountAtomic: row.reward_amount_atomic,
    }));
    const payoutId = crypto.randomUUID();
    const paidAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM legacy_fund_locks WHERE fund_id=? AND operation_key=?").bind(row.fund_id, "payout:"+submissionId),
      env.DB.prepare(`
        INSERT INTO challenge_payouts
          (id, challenge_id, submission_id, recipient_user_id, recipient_wallet, amount_usdc, amount_atomic, asset, status, payment_tx, paid_at, verified_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)
      `).bind(payoutId, row.challenge_id, submissionId, row.student_user_id, row.recipient_wallet, row.reward_amount_usdc, row.reward_amount_atomic, row.fund_asset, signature, paidAt, user.id),
      env.DB.prepare("UPDATE challenge_funds SET disbursed_atomic = CAST(CAST(disbursed_atomic AS INTEGER) + CAST(? AS INTEGER) AS TEXT), updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(row.reward_amount_atomic, row.fund_id),
      auditStatement(env.DB, {
        actorUserId: user.id, organizationId: row.organization_id, action: "challenge.payout_sent_from_vault",
        targetType: "submission", targetId: submissionId,
        metadata: { challengeId: row.challenge_id, signature, recipientWallet: row.recipient_wallet, asset: row.fund_asset, amount: row.reward_amount_usdc },
      }),
    ]);
    const display = row.fund_asset === "sol" ? formatSolAtomic(row.reward_amount_atomic) : formatUsdcAtomic(row.reward_amount_atomic);
    return Response.json({ payout: { id: payoutId, challengeId: row.challenge_id, submissionId, recipientWallet: row.recipient_wallet, amount: display, asset: row.fund_asset, status: "paid", paymentTx: signature, explorerUrl: explorerTransaction(signature) } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
