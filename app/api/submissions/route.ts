import { env } from "@/lib/runtime-env";
import { jsonError, requireSessionUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT s.id, s.state, s.reflection, s.evidence_json, s.submitted_at, s.updated_at,
        p.id AS participation_id, p.state AS participation_state,
        c.id AS challenge_id, c.title AS challenge_title, c.reward,
        o.name AS organization_name,
        (SELECT COUNT(*) FROM submission_files f WHERE f.submission_id = s.id) AS file_count,
        a.id AS assessment_id, a.status AS assessment_status, a.assessment_json
      FROM submissions s
      JOIN participations p ON p.id = s.participation_id
      JOIN challenges c ON c.id = p.challenge_id
      JOIN organizations o ON o.id = c.organization_id
      LEFT JOIN assessments a ON a.submission_id = s.id
      WHERE p.student_user_id = ?
      ORDER BY s.updated_at DESC
    `).bind(user.id).all();
    return Response.json({ submissions: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

