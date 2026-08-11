import { env } from "cloudflare:workers";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../../lib/auth";
import { recordOpportunityAccess } from "../../../../../lib/opportunity-gate";
import { verifyAttestation } from "../../../../../lib/solana-credentials";
import { auditStatement } from "../../../../../lib/audit";
import { consumeRateLimit } from "../../../../../lib/rate-limit";

type Credential = Record<string, unknown> & {
  id: string;
  issuer_organization_id: string;
  status: string;
  score: string;
  schema_address: string;
  attestation_address: string;
  student_wallet: string;
  challenge_id: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "opportunity_verify", user.id, 30, 60 * 60);
    const { id } = await params;
    const body = await request.json() as { credentialId?: string };
    const opportunity = await env.DB.prepare(`
      SELECT * FROM opportunities WHERE id = ? AND status = 'active'
    `).bind(id).first<{
      id: string;
      required_issuer_organization_id: string;
      minimum_score: string;
      policy_address: string;
    }>();
    if (!opportunity?.policy_address) {
      return Response.json({ error: "Cơ hội không tồn tại hoặc policy chưa hoạt động." }, { status: 404 });
    }

    const credential = body.credentialId
      ? await env.DB.prepare("SELECT * FROM skill_credentials WHERE id = ? AND student_user_id = ?")
          .bind(body.credentialId, user.id).first<Credential>()
      : await env.DB.prepare(`
          SELECT * FROM skill_credentials
          WHERE student_user_id = ? AND issuer_organization_id = ? AND status = 'active'
          ORDER BY CAST(score AS INTEGER) DESC, issued_at DESC LIMIT 1
        `).bind(user.id, opportunity.required_issuer_organization_id).first<Credential>();

    let decision = "denied";
    let reason = "NO_MATCHING_CREDENTIAL";
    let verification: unknown = { valid: false, reason };
    let receiptAddress: string | null = null;
    let recordTx: string | null = null;
    let verificationDigest: string | null = null;

    if (credential) {
      if (credential.issuer_organization_id !== opportunity.required_issuer_organization_id) {
        reason = "WRONG_ISSUER";
      } else if (credential.status !== "active") {
        reason = "CREDENTIAL_NOT_ACTIVE";
      } else if (Number(credential.score) < Number(opportunity.minimum_score)) {
        reason = "SCORE_BELOW_THRESHOLD";
      } else {
        verification = await verifyAttestation(env, {
          schemaAddress: credential.schema_address,
          attestationAddress: credential.attestation_address,
          studentWallet: user.walletAddress,
          challengeId: credential.challenge_id,
          minimumScore: Number(opportunity.minimum_score),
        });
        if ((verification as { valid: boolean }).valid) {
          decision = "granted";
          reason = "ACTIVE_ONCHAIN_CREDENTIAL";
          const priorReceipt = await env.DB.prepare(`
            SELECT receipt_address, record_tx, verification_digest FROM access_grants
            WHERE opportunity_id = ? AND credential_id = ? AND user_id = ?
              AND decision = 'granted' AND receipt_address IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
          `).bind(id, credential.id, user.id).first<{
            receipt_address: string;
            record_tx: string;
            verification_digest: string;
          }>();
          if (priorReceipt) {
            receiptAddress = priorReceipt.receipt_address;
            recordTx = priorReceipt.record_tx;
            verificationDigest = priorReceipt.verification_digest;
          } else {
            const verificationPayload = JSON.stringify({
              opportunityId: id,
              policyAddress: opportunity.policy_address,
              credentialId: credential.id,
              attestationAddress: credential.attestation_address,
              subjectWallet: user.walletAddress,
              score: Number(credential.score),
              verification,
            });
            const receipt = await recordOpportunityAccess(env, {
              policyAddress: opportunity.policy_address,
              attestationAddress: credential.attestation_address,
              subjectWallet: user.walletAddress,
              score: Number(credential.score),
              verificationPayload,
            });
            receiptAddress = receipt.receiptAddress;
            recordTx = receipt.signature;
            verificationDigest = receipt.verificationDigest;
          }
        } else {
          reason = (verification as { reason: string }).reason;
        }
      }
    }

    await env.DB.batch([env.DB.prepare(`
      INSERT INTO access_grants
        (id, opportunity_id, credential_id, user_id, wallet_address, decision,
         reason, verification_json, receipt_address, record_tx, verification_digest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      id,
      credential?.id ?? null,
      user.id,
      user.walletAddress,
      decision,
      reason,
      JSON.stringify(verification),
      receiptAddress,
      recordTx,
      verificationDigest,
    ), auditStatement(env.DB, {
      actorUserId: user.id,
      action: "opportunity.access_checked",
      targetType: "opportunity",
      targetId: id,
      metadata: { decision, reason, credentialId: credential?.id ?? null, receiptAddress, recordTx },
    })]);

    return Response.json({
      access: {
        decision,
        reason,
        credentialId: credential?.id ?? null,
        verification,
        receiptAddress,
        recordTx,
      },
    }, { status: decision === "granted" ? 200 : 403 });
  } catch (error) {
    return jsonError(error);
  }
}
