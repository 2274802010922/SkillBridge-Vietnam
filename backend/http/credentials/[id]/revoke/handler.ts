import { env } from "@/backend/config/runtime-env";
import { auditStatement } from "../../../../services/audit/audit";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../auth/auth";
import { requireCredentialIssuer } from "../../../../auth/authorization";
import { consumeRateLimit } from "../../../../auth/rate-limit";
import { explorerTransaction, revokeAttestation } from "../../../../../solana/server/solana-credentials";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "credential_revoke", user.id, 20, 24 * 60 * 60);
    const { id } = await params;
    const row = await env.DB.prepare(`
      SELECT sc.*, ci.credential_address FROM skill_credentials sc
      JOIN credential_issuers ci ON ci.organization_id = sc.issuer_organization_id
      WHERE sc.id = ?
    `).bind(id).first<{
      status:string; issuer_organization_id:string;
      credential_address:string; attestation_address:string;
    }>();
    if (!row) return Response.json({ error:"Credential không tồn tại." }, { status:404 });
    await requireCredentialIssuer(user.id, row.issuer_organization_id);
    if (row.status !== "active") return Response.json({ error:"Credential không ở trạng thái active." }, { status:409 });
    const signature = await revokeAttestation(env, row.credential_address, row.attestation_address);
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE skill_credentials SET status = 'revoked', revoke_tx = ?,
          revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(signature, id),
      auditStatement(env.DB, {
        actorUserId:user.id,organizationId:row.issuer_organization_id,
        action:"credential.revoked",targetType:"credential",targetId:id,
        metadata:{attestationAddress:row.attestation_address,transaction:signature},
      }),
    ]);
    return Response.json({ credential:{id,status:"revoked",transaction:signature,explorer:explorerTransaction(signature)} });
  } catch (error) {
    return jsonError(error);
  }
}
