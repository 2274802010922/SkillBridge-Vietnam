import { env } from "cloudflare:workers";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/authorization";
import { initializeOpportunityPolicy } from "../../../lib/opportunity-gate";
import { writeAuditEvent } from "../../../lib/audit";
import { consumeRateLimit } from "../../../lib/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "opportunity_create", user.id, 10, 60 * 60);
    const rows = await env.DB.prepare(`
      SELECT op.*, o.name AS organization_name,
        issuer.name AS required_issuer_name,
        CASE WHEN m.user_id IS NULL THEN 0 ELSE 1 END AS can_manage,
        (SELECT decision FROM access_grants ag
          WHERE ag.opportunity_id = op.id AND ag.user_id = ?
          ORDER BY ag.created_at DESC LIMIT 1) AS latest_decision
      FROM opportunities op
      JOIN organizations o ON o.id = op.organization_id
      JOIN organizations issuer ON issuer.id = op.required_issuer_organization_id
      LEFT JOIN memberships m ON m.organization_id = op.organization_id
        AND m.user_id = ? AND m.status = 'active'
        AND m.role IN ('business_admin', 'challenge_manager')
      WHERE op.status = 'active' OR m.user_id IS NOT NULL
      ORDER BY op.created_at DESC
    `).bind(user.id, user.id).all();
    return Response.json({ opportunities: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  let opportunityId: string | null = null;
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as {
      organizationId?: string;
      title?: string;
      description?: string;
      requiredIssuerOrganizationId?: string;
      minimumScore?: number;
    };
    if (!body.organizationId || !body.requiredIssuerOrganizationId) {
      return Response.json({ error: "Thiếu tổ chức sở hữu hoặc issuer yêu cầu." }, { status: 400 });
    }
    await requireOrganizationRole(
      user.id,
      body.organizationId,
      ["business_admin", "challenge_manager"],
      "business",
    );
    const issuer = await env.DB.prepare(`
      SELECT ci.credential_address, ci.schema_address
      FROM organizations o
      JOIN credential_issuers ci ON ci.organization_id = o.id AND ci.status = 'active'
      WHERE o.id = ? AND o.kind = 'university'
    `).bind(body.requiredIssuerOrganizationId).first<{
      credential_address: string;
      schema_address: string;
    }>();
    if (!issuer) {
      return Response.json({ error: "Trường phát hành chưa bootstrap issuer trên Devnet." }, { status: 400 });
    }

    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const minimumScore = Math.max(0, Math.min(100, Math.round(Number(body.minimumScore ?? 0))));
    if (title.length < 4 || description.length < 20) {
      return Response.json({ error: "Cơ hội cần tên và mô tả tối thiểu 20 ký tự." }, { status: 400 });
    }

    opportunityId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO opportunities
        (id, organization_id, created_by_user_id, title, description,
         required_issuer_organization_id, minimum_score, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'creating')
    `).bind(
      opportunityId,
      body.organizationId,
      user.id,
      title,
      description,
      body.requiredIssuerOrganizationId,
      String(minimumScore),
    ).run();

    const policy = await initializeOpportunityPolicy(env, {
      opportunityId,
      credentialAddress: issuer.credential_address,
      schemaAddress: issuer.schema_address,
      minimumScore,
    });
    await env.DB.prepare(`
      UPDATE opportunities SET policy_address = ?, policy_tx = ?, status = 'active',
        updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(policy.policyAddress, policy.signature, opportunityId).run();
    await writeAuditEvent(env.DB, {
      actorUserId: user.id,
      organizationId: body.organizationId,
      action: "opportunity.policy_created",
      targetType: "opportunity",
      targetId: opportunityId,
      metadata: { policyAddress: policy.policyAddress, transaction: policy.signature, minimumScore },
    });

    return Response.json({
      opportunity: {
        id: opportunityId,
        title,
        description,
        minimumScore,
        status: "active",
        policyAddress: policy.policyAddress,
        policyTx: policy.signature,
      },
    }, { status: 201 });
  } catch (error) {
    if (opportunityId) {
      await env.DB.prepare("UPDATE opportunities SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(opportunityId).run().catch(() => undefined);
    }
    return jsonError(error);
  }
}
