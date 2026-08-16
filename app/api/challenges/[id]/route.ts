import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { requireChallengeManager } from "../../../../lib/authorization";
import { writeAuditEvent } from "../../../../lib/audit";
import { isChallengeAccessType, type ChallengeAccessType } from "../../../../lib/challenge-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await env.DB.prepare(`
      SELECT c.*, o.name AS organization_name FROM challenges c
      JOIN organizations o ON o.id = c.organization_id WHERE c.id = ?
    `).bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    if (row.status !== "published") {
      const user = await requireSessionUser(request);
      await requireChallengeManager(user.id, id);
    }
    return Response.json({ challenge: row }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const body = (await request.json()) as { action?: "publish" | "close" | "set_access"; accessType?: ChallengeAccessType };
    if (body.action === "publish") {
      const result = await env.DB.prepare(`
        UPDATE challenges SET status = 'published', published_at = CURRENT_TIMESTAMP,
          version = CAST(CAST(version AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'draft'
      `).bind(id).run();
      if (!result.meta.changes) return Response.json({ error: "Chỉ challenge draft mới có thể publish." }, { status: 409 });
    } else if (body.action === "close") {
      await env.DB.prepare("UPDATE challenges SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'published'").bind(id).run();
    } else if (body.action === "set_access") {
      if (!isChallengeAccessType(body.accessType)) return Response.json({ error: "Chế độ tham gia không hợp lệ." }, { status: 400 });
      const result = await env.DB.prepare(`
        UPDATE challenges SET access_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('draft', 'published')
      `).bind(body.accessType, id).run();
      if (!result.meta.changes) return Response.json({ error: "Không thể đổi chế độ của challenge đã đóng." }, { status: 409 });
    } else return Response.json({ error: "Action không hợp lệ." }, { status: 400 });
    await writeAuditEvent(env.DB,{actorUserId:user.id,organizationId:challenge.organization_id,action:`challenge.${body.action}`,targetType:"challenge",targetId:id,metadata:body.action === "set_access" ? { accessType: body.accessType } : undefined});
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
