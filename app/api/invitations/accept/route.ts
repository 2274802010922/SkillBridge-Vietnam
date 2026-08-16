import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../../lib/auth";

type InvitationRow = {
  id: string;
  organization_id: string;
  organization_name: string;
  role: string;
  target_wallet: string | null;
  expires_at: string;
  accepted_at: string | null;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as { token?: string };
    if (!body.token) return Response.json({ error: "Thiếu mã mời." }, { status: 400 });
    const tokenHash = await sha256(body.token);
    const invitation = await env.DB.prepare(`
      SELECT i.id, i.organization_id, o.name AS organization_name, i.role,
        i.target_wallet, i.expires_at, i.accepted_at
      FROM invitations i JOIN organizations o ON o.id = i.organization_id
      WHERE i.token_hash = ?
    `).bind(tokenHash).first<InvitationRow>();
    if (!invitation || invitation.accepted_at || invitation.expires_at <= new Date().toISOString()) {
      return Response.json({ error: "Lời mời không tồn tại, đã hết hạn hoặc đã được dùng." }, { status: 410 });
    }
    if (invitation.target_wallet && invitation.target_wallet !== user.walletAddress) {
      return Response.json({ error: "Lời mời này được khóa cho một ví khác." }, { status: 403 });
    }

    const accepted = await env.DB.prepare(`
      UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP, accepted_by_user_id = ?
      WHERE id = ? AND accepted_at IS NULL AND expires_at > ?
    `).bind(user.id, invitation.id, new Date().toISOString()).run();
    if (!accepted.meta.changes) return Response.json({ error: "Lời mời vừa được sử dụng." }, { status: 409 });
    await env.DB.prepare(`
      INSERT INTO memberships (id, organization_id, user_id, role)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(organization_id, user_id, role) DO UPDATE SET status = 'active'
    `).bind(crypto.randomUUID(), invitation.organization_id, user.id, invitation.role).run();
    return Response.json({ membership: { organizationId: invitation.organization_id, organizationName: invitation.organization_name, role: invitation.role } });
  } catch (error) {
    return jsonError(error);
  }
}
