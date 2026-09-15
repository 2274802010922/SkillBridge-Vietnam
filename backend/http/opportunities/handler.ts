import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../auth/auth";
import { requireOrganizationRole } from "../../auth/authorization";
import { initializeOpportunityPolicy } from "../../../solana/server/opportunity-gate";
import { writeAuditEvent } from "../../services/audit/audit";
import { consumeRateLimit } from "../../auth/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT op.*, d.requirements, d.closes_at, o.name AS organization_name,
        issuer.name AS required_issuer_name,
        CASE WHEN m.user_id IS NULL THEN 0 ELSE 1 END AS can_manage,
        (SELECT decision FROM access_grants ag
          WHERE ag.opportunity_id = op.id AND ag.user_id = ?
          ORDER BY ag.created_at DESC LIMIT 1) AS latest_decision
      FROM opportunities op
      LEFT JOIN opportunity_details d ON d.opportunity_id=op.id
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
    await consumeRateLimit(env.DB,"opportunity_create",user.id,10,3600);
    const body = await request.json() as {
      organizationId?: string;
      title?: string;
      description?: string;
      requiredIssuerOrganizationId?: string;
      minimumScore?: number;
      requirements?: string;
      closesAt?: string;
      draft?: boolean;
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
      WHERE o.id = ? AND o.kind IN ('university','business')
    `).bind(body.requiredIssuerOrganizationId).first<{
      credential_address: string;
      schema_address: string;
    }>();
    if (!issuer) {
      return Response.json({ error: "Đơn vị phát hành chưa khởi tạo chứng nhận trên Devnet." }, { status: 400 });
    }

    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const minimumScore=Number(body.minimumScore ?? 0);
    if(!Number.isInteger(minimumScore)||minimumScore<0||minimumScore>100||title.length>200||description.length>8000||(body.requirements?.length??0)>8000)return Response.json({error:"Nội dung hoặc điểm không hợp lệ."},{status:400});
    const closesAt=body.closesAt?new Date(body.closesAt):null;
    if(closesAt&&(!Number.isFinite(closesAt.getTime())||closesAt.getTime()<=Date.now()))return Response.json({error:"Hạn ứng tuyển phải ở tương lai."},{status:400});
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

    await env.DB.prepare("INSERT INTO opportunity_details(opportunity_id,requirements,closes_at) VALUES(?,?,?)").bind(opportunityId,body.requirements?.trim()||"",closesAt?.toISOString()||null).run();
    if(body.draft){await env.DB.prepare("UPDATE opportunities SET status='draft' WHERE id=?").bind(opportunityId).run();return Response.json({opportunity:{id:opportunityId,status:"draft"}},{status:201});}
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
