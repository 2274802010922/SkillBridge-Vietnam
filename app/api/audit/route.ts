import { env } from "@/lib/runtime-env";
import { jsonError, requireSessionUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT ae.*, o.name AS organization_name
      FROM audit_events ae
      LEFT JOIN organizations o ON o.id = ae.organization_id
      WHERE ae.actor_user_id = ? OR ae.organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = ? AND status = 'active'
          AND role IN ('business_admin', 'university_admin')
      )
      ORDER BY ae.created_at DESC LIMIT 200
    `).bind(user.id, user.id).all();
    return Response.json({ events: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

