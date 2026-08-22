import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { auditStatement } from "../../../../lib/audit";

/** Advance only a local sandbox state; no banking provider is contacted. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const body = await request.json() as { action?: "complete_sandbox" };
    if (body.action !== "complete_sandbox") return Response.json({ error: "Action sandbox không hợp lệ." }, { status: 400 });
    const session = await env.DB.prepare("SELECT id, status FROM cashout_sessions WHERE id = ? AND user_id = ?").bind(id, user.id).first<{ id: string; status: string }>();
    if (!session) return Response.json({ error: "Không tìm thấy phiên cash-out sandbox." }, { status: 404 });
    if (session.status === "sandbox_complete") return Response.json({ ok: true, status: session.status, reused: true });
    const changed = await env.DB.prepare("UPDATE cashout_sessions SET status = 'sandbox_complete', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'quote_ready'").bind(id, user.id).run();
    if (!changed.meta.changes) return Response.json({ error: "Phiên sandbox không thể hoàn tất ở trạng thái này." }, { status: 409 });
    await auditStatement(env.DB, { actorUserId: user.id, action: "cashout.sandbox_completed", targetType: "cashout_session", targetId: id }).run();
    return Response.json({ ok: true, status: "sandbox_complete" });
  } catch (error) { return jsonError(error); }
}
