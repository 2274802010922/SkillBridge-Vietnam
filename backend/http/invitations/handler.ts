import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, randomToken, requireSessionUser, sha256, validSolanaAddress } from "../../auth/auth";
import { auditStatement } from "../../services/audit/audit";

const allowedRoles = {
  business: new Set(["business_admin", "challenge_manager", "reviewer", "credential_issuer"]),
  university: new Set(["university_admin", "reviewer", "credential_issuer"]),
};

type AdminRow = { kind: "business" | "university"; role: string };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as { organizationId?: string; role?: string; targetWallet?: string };
    if (!body.organizationId || !body.role) {
      return Response.json({ error: "Thiếu tổ chức hoặc role." }, { status: 400 });
    }
    const membership = await env.DB.prepare(`
      SELECT o.kind, m.role FROM memberships m
      JOIN organizations o ON o.id = m.organization_id
      WHERE m.organization_id = ? AND m.user_id = ? AND m.status = 'active'
        AND m.role IN ('business_admin', 'university_admin')
      LIMIT 1
    `).bind(body.organizationId, user.id).first<AdminRow>();
    if (!membership) return Response.json({ error: "Bạn không có quyền mời thành viên cho tổ chức này." }, { status: 403 });
    const rolesForOrganization = allowedRoles[membership.kind];
    if (!rolesForOrganization.has(body.role)) {
      return Response.json({ error: "Role không phù hợp loại tổ chức." }, { status: 400 });
    }
    const targetWallet = body.targetWallet?.trim() || null;
    if (targetWallet && !validSolanaAddress(targetWallet)) {
      return Response.json({ error: "Ví nhận lời mời không hợp lệ." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.batch([env.DB.prepare(`
      INSERT INTO invitations
        (id, organization_id, role, token_hash, target_wallet, created_by_user_id, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, body.organizationId, body.role, await sha256(token), targetWallet, user.id, expiresAt),auditStatement(env.DB,{actorUserId:user.id,organizationId:body.organizationId,action:"membership.invited",targetType:"invitation",targetId:id,metadata:{role:body.role,targeted:Boolean(targetWallet),expiresAt}})]);
    const joinUrl = `${new URL(request.url).origin}/join/${token}`;
    return Response.json({ invitation: { id, role: body.role, targetWallet, expiresAt, joinUrl } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
