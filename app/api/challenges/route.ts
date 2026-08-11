import { env } from "cloudflare:workers";
import { RUBRIC } from "../../../lib/assessment-contract";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/authorization";
import { auditStatement } from "../../../lib/audit";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT DISTINCT c.id, c.organization_id, o.name AS organization_name,
        c.title, c.brief, c.skills_json, c.rubric_json, c.reward, c.status,
        c.version, c.published_at, c.closes_at, c.created_at,
        CASE WHEN owner.user_id IS NOT NULL THEN 1 ELSE 0 END AS can_manage,
        p.id AS participation_id, p.state AS participation_state
      FROM challenges c
      JOIN organizations o ON o.id = c.organization_id
      LEFT JOIN memberships owner ON owner.organization_id = c.organization_id
        AND owner.user_id = ? AND owner.status = 'active'
        AND owner.role IN ('business_admin', 'challenge_manager')
      LEFT JOIN participations p ON p.challenge_id = c.id AND p.student_user_id = ?
      WHERE c.status = 'published' OR owner.user_id IS NOT NULL OR p.id IS NOT NULL
      ORDER BY c.created_at DESC
    `).bind(user.id, user.id).all();
    return Response.json({ challenges: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as {
      organizationId?: string; reviewerOrganizationId?: string; title?: string; brief?: string; skills?: string[];
      reward?: string; closesAt?: string | null;
    };
    if (!body.organizationId) return Response.json({ error: "Thiếu tổ chức." }, { status: 400 });
    await requireOrganizationRole(user.id, body.organizationId, ["business_admin", "challenge_manager"], "business");
    if (!body.reviewerOrganizationId) return Response.json({ error: "Chọn một nhà trường chịu trách nhiệm review." }, { status: 400 });
    const reviewerOrganization = await env.DB.prepare("SELECT id FROM organizations WHERE id = ? AND kind = 'university'").bind(body.reviewerOrganizationId).first();
    if (!reviewerOrganization) return Response.json({ error: "Nhà trường review không hợp lệ." }, { status: 400 });
    const title = body.title?.trim() ?? "";
    const brief = body.brief?.trim() ?? "";
    const reward = body.reward?.trim() ?? "";
    const skills = (body.skills ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8);
    if (title.length < 5 || title.length > 140 || brief.length < 40 || brief.length > 6000 || reward.length < 3 || skills.length < 1) {
      return Response.json({ error: "Challenge cần title, brief tối thiểu 40 ký tự, ít nhất một skill và reward." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await env.DB.batch([env.DB.prepare(`
      INSERT INTO challenges
        (id, organization_id, reviewer_organization_id, created_by_user_id, title, brief, skills_json, rubric_json, reward, closes_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, body.organizationId, body.reviewerOrganizationId, user.id, title, brief, JSON.stringify(skills), JSON.stringify(RUBRIC), reward, body.closesAt || null),auditStatement(env.DB,{actorUserId:user.id,organizationId:body.organizationId,action:"challenge.created",targetType:"challenge",targetId:id,metadata:{title,reviewerOrganizationId:body.reviewerOrganizationId}})]);
    return Response.json({ challenge: { id, organizationId: body.organizationId, reviewerOrganizationId: body.reviewerOrganizationId, title, brief, skills, rubric: RUBRIC, reward, status: "draft" } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
