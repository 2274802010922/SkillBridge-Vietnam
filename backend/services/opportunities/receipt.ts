import { env } from "../../config/runtime-env";
import { recordOpportunityAccess } from "../../../solana/server/opportunity-gate";
import type { OpportunityRecord, ApplicationCredential } from "./applications";
import type { Eligibility } from "../../../solana/client/opportunity-verification";
export async function applicationReceipt(
  op: OpportunityRecord,
  c: ApplicationCredential,
  user: { id: string; walletAddress: string },
  check: Eligibility,
) {
  const existing = await env.DB.prepare(
    "SELECT receipt_address,record_tx FROM access_grants WHERE opportunity_id=? AND credential_id=? AND user_id=? AND decision='granted' AND receipt_address IS NOT NULL ORDER BY created_at DESC LIMIT 1",
  )
    .bind(op.id, c.id, user.id)
    .first<{ receipt_address: string; record_tx: string }>();
  if (existing)
    return {
      receiptAddress: existing.receipt_address,
      recordTx: existing.record_tx,
    };
  const r = await recordOpportunityAccess(env, {
    policyAddress: op.policy_address!,
    attestationAddress: c.attestation_address,
    subjectWallet: user.walletAddress,
    score: check.score!,
    verificationPayload: JSON.stringify(check),
  });
  await env.DB.prepare(
    "INSERT INTO access_grants(id,opportunity_id,credential_id,user_id,wallet_address,decision,reason,verification_json,receipt_address,record_tx,verification_digest) VALUES(?,?,?,?,?,'granted',?,?,?,?,?)",
  )
    .bind(
      crypto.randomUUID(),
      op.id,
      c.id,
      user.id,
      user.walletAddress,
      check.reason,
      JSON.stringify(check),
      r.receiptAddress,
      r.signature,
      r.verificationDigest,
    )
    .run();
  return { receiptAddress: r.receiptAddress, recordTx: r.signature };
}
