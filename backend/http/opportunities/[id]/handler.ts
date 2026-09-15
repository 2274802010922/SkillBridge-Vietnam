import { env } from "@/backend/config/runtime-env";
import {
  assertSameOrigin,
  requireSessionUser,
  jsonError,
} from "@/backend/auth/auth";
import { requireOrganizationRole } from "@/backend/auth/authorization";
import { initializeOpportunityPolicy } from "@/solana/server/opportunity-gate";
import { loadOpportunity } from "@/backend/services/opportunities/applications";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionUser(request),
      { id } = await params;
    const op = await loadOpportunity(env.DB, id);
    if (!op) return Response.json({ error: "Not found" }, { status: 404 });
    const manager = await env.DB.prepare(
      "SELECT 1 FROM memberships WHERE user_id=? AND organization_id=? AND status='active' AND role IN ('business_admin','challenge_manager')",
    )
      .bind(user.id, op.organization_id)
      .first();
    if (!manager && !["active", "closed"].includes(op.status))
      return Response.json({ error: "Not found" }, { status: 404 });
    const credentials = await env.DB.prepare(
      "SELECT sc.id,sc.score,sc.status,sc.attestation_address,c.title,o.name AS issuer_name FROM skill_credentials sc JOIN challenges c ON c.id=sc.challenge_id JOIN organizations o ON o.id=sc.issuer_organization_id WHERE sc.student_user_id=? AND sc.issuer_organization_id=? ORDER BY sc.issued_at DESC",
    )
      .bind(user.id, op.required_issuer_organization_id)
      .all();
    const application = await env.DB.prepare(
      "SELECT * FROM opportunity_applications WHERE opportunity_id=? AND user_id=?",
    )
      .bind(id, user.id)
      .first();
    return Response.json(
      {
        opportunity: op,
        credentials: credentials.results,
        application,
        canManage: !!manager,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return jsonError(e);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request),
      { id } = await params;
    const op = await loadOpportunity(env.DB, id);
    if (!op) return Response.json({ error: "Not found" }, { status: 404 });
    await requireOrganizationRole(
      user.id,
      op.organization_id,
      ["business_admin", "challenge_manager"],
      "business",
    );
    const body = (await request.json()) as { action?: string };
    if (body.action === "close") {
      await env.DB.prepare(
        "UPDATE opportunities SET status='closed',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('active','draft')",
      )
        .bind(id)
        .run();
      return Response.json({ status: "closed" });
    }
    if (body.action !== "publish" || op.status !== "draft")
      return Response.json(
        { error: "Trạng thái không hợp lệ." },
        { status: 409 },
      );
    if (op.closes_at && Date.parse(op.closes_at) <= Date.now())
      return Response.json({ error: "Hạn ứng tuyển đã qua." }, { status: 409 });
    const issuer = await env.DB.prepare(
      "SELECT credential_address,schema_address FROM credential_issuers WHERE organization_id=? AND status='active'",
    )
      .bind(op.required_issuer_organization_id)
      .first<{ credential_address: string; schema_address: string }>();
    if (!issuer)
      return Response.json({ error: "Issuer unavailable" }, { status: 409 });
    const lock = await env.DB.prepare(
      "UPDATE opportunities SET status='creating' WHERE id=? AND status='draft'",
    )
      .bind(id)
      .run();
    if (!lock.meta.changes)
      return Response.json({ error: "Đang công bố." }, { status: 409 });
    try {
      const policy = await initializeOpportunityPolicy(env, {
        opportunityId: id,
        credentialAddress: issuer.credential_address,
        schemaAddress: issuer.schema_address,
        minimumScore: Number(op.minimum_score),
      });
      await env.DB.prepare(
        "UPDATE opportunities SET status='active',policy_address=?,policy_tx=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
        .bind(policy.policyAddress, policy.signature, id)
        .run();
      return Response.json({ status: "active" });
    } catch (e) {
      await env.DB.prepare(
        "UPDATE opportunities SET status='draft' WHERE id=? AND status='creating'",
      )
        .bind(id)
        .run();
      throw e;
    }
  } catch (e) {
    return jsonError(e);
  }
}
