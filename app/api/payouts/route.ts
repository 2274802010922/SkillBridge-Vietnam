import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/authorization";
import { auditStatement } from "../../../lib/audit";
import { explorerTransaction, formatUsdcAtomic, verifyUsdcPayment } from "../../../lib/payments";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT c.id AS challenge_id, c.title AS challenge_title, o.name AS organization_name,
        c.reward_amount_usdc, c.reward_amount_atomic, c.reward_mint,
        s.id AS submission_id, s.state AS submission_state, s.submitted_at,
        p.student_user_id, w.address AS recipient_wallet, u.display_name AS student_name,
        a.status AS assessment_status, cp.id AS payout_id, cp.status AS payout_status,
        cp.payment_tx, cp.paid_at
      FROM challenges c
      JOIN organizations o ON o.id = c.organization_id
      JOIN memberships m ON m.organization_id = c.organization_id AND m.user_id = ? AND m.status = 'active' AND m.role IN ('business_admin','challenge_manager')
      JOIN participations p ON p.challenge_id = c.id
      JOIN submissions s ON s.participation_id = p.id
      JOIN wallets w ON w.user_id = p.student_user_id
      JOIN users u ON u.id = p.student_user_id
      JOIN assessments a ON a.submission_id = s.id AND a.status = 'approved'
      LEFT JOIN challenge_payouts cp ON cp.submission_id = s.id
      WHERE c.reward_amount_atomic IS NOT NULL
      ORDER BY s.submitted_at DESC
    `).bind(user.id).all();
    return Response.json({ payouts: rows.results }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { submissionId?: string; signature?: string };
    const submissionId = body.submissionId?.trim() ?? "";
    const signature = body.signature?.trim() ?? "";
    if (!submissionId || !signature) return Response.json({ error: "Cần submission và transaction signature." }, { status: 400 });
    const row = await env.DB.prepare(`
      SELECT c.id AS challenge_id, c.organization_id, c.title, c.reward_amount_usdc, c.reward_amount_atomic, c.reward_mint,
        p.student_user_id, w.address AS recipient_wallet, a.status AS assessment_status, cp.status AS payout_status
      FROM submissions s
      JOIN participations p ON p.id = s.participation_id
      JOIN challenges c ON c.id = p.challenge_id
      JOIN wallets w ON w.user_id = p.student_user_id
      JOIN assessments a ON a.submission_id = s.id
      LEFT JOIN challenge_payouts cp ON cp.submission_id = s.id
      WHERE s.id = ?
    `).bind(submissionId).first<{ challenge_id: string; organization_id: string; title: string; reward_amount_usdc: string | null; reward_amount_atomic: string | null; reward_mint: string | null; student_user_id: string; recipient_wallet: string; assessment_status: string; payout_status: string | null }>();
    if (!row) return Response.json({ error: "Bài nộp không tồn tại." }, { status: 404 });
    await requireOrganizationRole(user.id, row.organization_id, ["business_admin", "challenge_manager"], "business");
    if (row.assessment_status !== "approved") return Response.json({ error: "Chỉ có thể payout bài đã được reviewer phê duyệt." }, { status: 409 });
    if (!row.reward_amount_atomic || !row.reward_amount_usdc) return Response.json({ error: "Challenge chưa cấu hình số tiền USDC." }, { status: 409 });
    if (row.payout_status === "paid") return Response.json({ error: "Bài nộp này đã được payout." }, { status: 409 });
    const duplicate = await env.DB.prepare("SELECT id FROM challenge_payouts WHERE payment_tx = ?").bind(signature).first();
    if (duplicate) return Response.json({ error: "Transaction này đã được ghi nhận." }, { status: 409 });
    const payment = await verifyUsdcPayment({ signature, recipientWallet: row.recipient_wallet, expectedAtomic: row.reward_amount_atomic, rpcUrl: env.SOLANA_RPC_URL, mint: row.reward_mint || env.SOLANA_USDC_MINT });
    const payoutId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO challenge_payouts (id, challenge_id, submission_id, recipient_user_id, recipient_wallet, amount_usdc, amount_atomic, status, payment_tx, paid_at, verified_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)`)
        .bind(payoutId, row.challenge_id, submissionId, row.student_user_id, row.recipient_wallet, row.reward_amount_usdc, row.reward_amount_atomic, signature, payment.observedAt, user.id),
      auditStatement(env.DB, { actorUserId: user.id, organizationId: row.organization_id, action: "challenge.payout_verified", targetType: "submission", targetId: submissionId, metadata: { challengeId: row.challenge_id, signature, recipientWallet: row.recipient_wallet, amountUsdc: formatUsdcAtomic(payment.amountAtomic) } }),
    ]);
    return Response.json({ payout: { id: payoutId, challengeId: row.challenge_id, submissionId, recipientWallet: row.recipient_wallet, amountUsdc: row.reward_amount_usdc, status: "paid", paymentTx: signature, explorerUrl: explorerTransaction(signature) } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
