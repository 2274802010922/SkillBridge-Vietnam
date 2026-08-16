import { env } from "@/lib/runtime-env";
import { jsonError, requireSessionUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT s.id AS submission_id, s.state AS submission_state, s.reflection,
        s.evidence_json, s.submitted_at, p.student_user_id,
        u.display_name AS student_name, w.address AS student_wallet,
        c.id AS challenge_id, c.title AS challenge_title, c.brief AS challenge_brief,
        c.rubric_json, o.name AS business_name,
        reviewer.name AS reviewer_organization_name, c.reviewer_organization_id,
        a.id AS assessment_id, a.status AS assessment_status, a.assessment_json,
        a.provider, a.model, a.ai_result_hash, a.final_result_hash,
        sc.id AS credential_id, sc.status AS credential_status, sc.attestation_address,
        (SELECT COUNT(*) FROM submission_files f WHERE f.submission_id = s.id) AS file_count
      FROM submissions s
      JOIN participations p ON p.id = s.participation_id
      JOIN users u ON u.id = p.student_user_id
      JOIN wallets w ON w.user_id = u.id
      JOIN challenges c ON c.id = p.challenge_id
      JOIN organizations o ON o.id = c.organization_id
      JOIN organizations reviewer ON reviewer.id = c.reviewer_organization_id
      JOIN memberships m ON m.organization_id = c.reviewer_organization_id
        AND m.user_id = ? AND m.status = 'active'
        AND m.role IN ('university_admin','reviewer')
      LEFT JOIN assessments a ON a.submission_id = s.id
      LEFT JOIN skill_credentials sc ON sc.assessment_id = a.id
      WHERE s.state IN ('submitted','in_review','changes_requested','approved','rejected')
      ORDER BY COALESCE(s.submitted_at,s.updated_at) DESC
    `).bind(user.id).all();
    return Response.json({ reviews: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}
