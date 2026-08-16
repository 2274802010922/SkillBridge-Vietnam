import { env } from "@/lib/runtime-env";
import { writeAuditEvent } from "../../../../lib/audit";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { requireOrganizationRole } from "../../../../lib/authorization";
import { consumeRateLimit } from "../../../../lib/rate-limit";
import { bootstrapIssuer, explorerAddress, explorerTransaction } from "../../../../lib/solana-credentials";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "solana_bootstrap", user.id, 3, 24 * 60 * 60);
    const body = await request.json() as { organizationId?: string };
    if (!body.organizationId) return Response.json({ error: "Thiếu organizationId." }, { status: 400 });
    await requireOrganizationRole(user.id, body.organizationId, ["university_admin"], "university");
    const existing = await env.DB.prepare("SELECT * FROM credential_issuers WHERE organization_id = ?")
      .bind(body.organizationId).first<Record<string, unknown>>();
    if (existing) return Response.json({ issuer: existing });
    if (!env.SOLANA_FEE_PAYER_SECRET || !env.SOLANA_ISSUER_SECRET || !env.SOLANA_AUTHORIZED_SIGNER_SECRET) {
      return Response.json({ error: "Các secret Solana issuer chưa được cấu hình." }, { status: 503 });
    }
    const setup = await bootstrapIssuer(env, body.organizationId);
    await env.DB.prepare(`
      INSERT INTO credential_issuers
        (organization_id, credential_name, credential_address, schema_name,
         schema_address, authorized_signer_address, bootstrap_tx)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.organizationId,
      setup.credentialName,
      setup.credentialAddress,
      setup.schemaName,
      setup.schemaAddress,
      setup.authorizedSignerAddress,
      JSON.stringify([setup.credentialTx, setup.schemaTx]),
    ).run();
    await writeAuditEvent(env.DB, {
      actorUserId: user.id,
      organizationId: body.organizationId,
      action: "solana.issuer_bootstrapped",
      targetType: "credential_issuer",
      targetId: body.organizationId,
      metadata: { credentialAddress:setup.credentialAddress,schemaAddress:setup.schemaAddress,transactions:[setup.credentialTx,setup.schemaTx] },
    });
    return Response.json({
      issuer: {
        ...setup,
        credentialExplorer: explorerAddress(setup.credentialAddress),
        schemaExplorer: explorerAddress(setup.schemaAddress),
        transactions: [explorerTransaction(setup.credentialTx), explorerTransaction(setup.schemaTx)],
      },
    }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
