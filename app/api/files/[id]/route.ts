import { env } from "@/lib/runtime-env";
import { jsonError, requireSessionUser } from "../../../../lib/auth";
import { getEvidence } from "../../../../lib/evidence-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    const row = await env.DB.prepare(`
      SELECT f.r2_key, f.original_name, f.content_type,
        p.student_user_id, c.organization_id, c.reviewer_organization_id
      FROM submission_files f
      JOIN submissions s ON s.id = f.submission_id
      JOIN participations p ON p.id = s.participation_id
      JOIN challenges c ON c.id = p.challenge_id
      WHERE f.id = ?
    `).bind(id).first<{ r2_key: string; original_name: string; content_type: string; student_user_id: string; organization_id: string; reviewer_organization_id: string | null }>();
    if (!row) return Response.json({ error: "File không tồn tại." }, { status: 404 });
    if (row.student_user_id !== user.id) {
      const allowed = await env.DB.prepare(`SELECT 1 AS allowed FROM memberships WHERE user_id = ? AND organization_id = ? AND status = 'active' AND role IN ('university_admin','reviewer') LIMIT 1`).bind(user.id, row.reviewer_organization_id).first();
      if (!allowed) return Response.json({ error: "Bạn không có quyền xem file này." }, { status: 403 });
    }
    const object = await getEvidence(row.r2_key);
    if (!object) return Response.json({ error: "File không còn trong kho lưu trữ." }, { status: 404 });
    return new Response(object.body, { headers: { "content-type": row.content_type, "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`, "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
