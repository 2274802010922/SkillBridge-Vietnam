import { env } from "cloudflare:workers";

export type OrganizationKind = "business" | "university";

export async function requireOrganizationRole(
  userId: string,
  organizationId: string,
  roles: readonly string[],
  expectedKind?: OrganizationKind,
) {
  const placeholders = roles.map(() => "?").join(", ");
  const row = await env.DB.prepare(`
    SELECT m.role, o.kind, o.name, o.verification_status
    FROM memberships m JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ? AND m.organization_id = ? AND m.status = 'active'
      AND m.role IN (${placeholders})
    LIMIT 1
  `).bind(userId, organizationId, ...roles).first<{
    role: string;
    kind: OrganizationKind;
    name: string;
    verification_status: string;
  }>();
  if (!row || (expectedKind && row.kind !== expectedKind)) {
    throw new Response("Bạn không có quyền thực hiện thao tác này.", { status: 403 });
  }
  return row;
}

export async function requireChallengeManager(userId: string, challengeId: string) {
  const challenge = await env.DB.prepare("SELECT organization_id FROM challenges WHERE id = ?")
    .bind(challengeId).first<{ organization_id: string }>();
  if (!challenge) throw new Response("Challenge không tồn tại.", { status: 404 });
  await requireOrganizationRole(userId, challenge.organization_id, ["business_admin", "challenge_manager"], "business");
  return challenge;
}

export async function requireUniversityReviewer(userId: string, organizationId: string) {
  return requireOrganizationRole(userId, organizationId, ["university_admin", "reviewer"], "university");
}

export async function requireCredentialIssuer(userId: string, organizationId: string) {
  return requireOrganizationRole(userId, organizationId, ["university_admin", "credential_issuer"], "university");
}
