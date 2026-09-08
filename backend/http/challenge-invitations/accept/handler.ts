import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../auth/auth";

type Row = { id: string; challenge_id: string; target_wallet: string | null; status: string; expires_at: string };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as { token?: string };
    if (!body.token) return Response.json({ error: "Thiếu mã mời." }, { status: 400 });
    const row = await env.DB.prepare(`
      SELECT id, challenge_id, target_wallet, status, expires_at
      FROM challenge_invitations WHERE token_hash = ?
    `).bind(await sha256(body.token)).first<Row>();
    if (!row || row.status !== "active" || row.expires_at <= new Date().toISOString()) return Response.json({ error: "Lời mời không còn hiệu lực." }, { status: 410 });
    if (row.target_wallet && row.target_wallet !== user.walletAddress) return Response.json({ error: "Lời mời được khóa cho ví khác." }, { status: 403 });
    const consumed = await env.DB.prepare(`UPDATE challenge_invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, accepted_by_user_id = ? WHERE id = ? AND status = 'active'`).bind(user.id, row.id).run();
    if (!consumed.meta.changes) return Response.json({ error: "Lời mời vừa được sử dụng." }, { status: 409 });
    const participationId = crypto.randomUUID();
    const submissionId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO participations (id, challenge_id, student_user_id) VALUES (?, ?, ?) ON CONFLICT(challenge_id, student_user_id) DO UPDATE SET state = 'accepted', updated_at = CURRENT_TIMESTAMP`).bind(participationId, row.challenge_id, user.id),
      env.DB.prepare(`INSERT INTO submissions (id, participation_id) SELECT ?, id FROM participations WHERE challenge_id = ? AND student_user_id = ? ON CONFLICT(participation_id) DO NOTHING`).bind(submissionId, row.challenge_id, user.id),
    ]);
    return Response.json({ participation: { challengeId: row.challenge_id, state: "accepted" } });
  } catch (error) { return jsonError(error); }
}
