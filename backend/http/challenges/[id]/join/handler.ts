import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../auth/auth";
import { auditStatement } from "../../../../services/audit/audit";
import { canJoinPublicChallenge } from "../../../../../shared/validation/challenge-access";

type ChallengeRow = {
  id: string;
  organization_id: string;
  status: string;
  access_type: string;
  closes_at: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await env.DB.prepare(`
      SELECT id, organization_id, status, access_type, closes_at
      FROM challenges WHERE id = ?
    `).bind(id).first<ChallengeRow>();
    if (!challenge) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    if (!canJoinPublicChallenge({
      status: challenge.status,
      accessType: challenge.access_type,
      closesAt: challenge.closes_at,
    })) {
      return Response.json({ error: challenge.access_type === "invite_only"
        ? "Challenge này yêu cầu link mời hợp lệ."
        : "Challenge chưa mở hoặc đã đóng." }, { status: 403 });
    }

    const participationId = crypto.randomUUID();
    const submissionId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO participations (id, challenge_id, student_user_id)
        VALUES (?, ?, ?) ON CONFLICT(challenge_id, student_user_id) DO NOTHING
      `).bind(participationId, id, user.id),
      env.DB.prepare(`
        INSERT INTO submissions (id, participation_id)
        SELECT ?, id FROM participations WHERE challenge_id = ? AND student_user_id = ?
        ON CONFLICT(participation_id) DO NOTHING
      `).bind(submissionId, id, user.id),
      auditStatement(env.DB, {
        actorUserId: user.id,
        organizationId: challenge.organization_id,
        action: "challenge.public_joined",
        targetType: "challenge",
        targetId: id,
        metadata: { accessType: "public" },
      }),
    ]);
    return Response.json({ participation: { challengeId: id, state: "accepted" } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
