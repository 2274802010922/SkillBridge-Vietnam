import { auditStatement } from "../audit/audit.ts";

export type IssuanceRequest = {
  assessmentId: string; challengeId: string; organizationId: string; studentUserId: string;
  studentWallet: string; credentialAddress: string; schemaAddress: string; score: number;
  evidenceHash: string; resultHash: string; reviewerRole: string; skills: unknown[];
};
export type IssuancePayload = IssuanceRequest & { expiryUnix: number };
export type PreparedIssuance = {
  wire: string; signature: string; nonceAddress: string; attestationAddress: string;
  lastValidBlockHeight: number; signer: string;
};
export type IssuanceTransport = {
  prepare(input: IssuancePayload): Promise<PreparedIssuance>;
  inspect(input: IssuancePayload, prepared: PreparedIssuance): Promise<"absent" | "pending" | "finalized" | "failed" | "expired" | "mismatch">;
  broadcast(prepared: PreparedIssuance): Promise<void>;
};
type Operation = {
  assessment_id: string; fingerprint: string; payload_json: string; status: string;
  prepared_json: string | null; signature: string | null; attestation_address: string | null;
};
export async function issuanceOperation(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM credential_issuance_operations WHERE assessment_id=?").bind(id).first<Operation>();
}
export function publicIssuance(op: Operation) {
  return { id: op.assessment_id, status: op.status, signature: op.signature, attestationAddress: op.attestation_address };
}
async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))), b=>b.toString(16).padStart(2,"0")).join("");
}
export async function reserveIssuance(db: D1Database, input: IssuanceRequest) {
  const fingerprint = await digest(JSON.stringify(input));
  // One conditional write serializes all assessments competing for this challenge.
  await db.prepare(`INSERT OR IGNORE INTO credential_issuance_operations
    (assessment_id,challenge_id,organization_id,student_user_id,fingerprint,payload_json)
    SELECT ?,?,?,?,?,? FROM challenges c WHERE c.id=? AND
    (SELECT COUNT(*) FROM skill_credentials sc WHERE sc.challenge_id=c.id AND sc.status IN ('active','issued')) +
    (SELECT COUNT(*) FROM credential_issuance_operations op WHERE op.challenge_id=c.id AND op.status NOT IN ('completed','failed')) < COALESCE(c.reward_slots,1)
    AND NOT EXISTS(SELECT 1 FROM skill_credentials WHERE assessment_id=?)`)
    .bind(input.assessmentId,input.challengeId,input.organizationId,input.studentUserId,fingerprint,
      JSON.stringify({...input,expiryUnix:Math.floor(Date.now()/1000)+365*86400}),input.challengeId,input.assessmentId).run();
  const op = await issuanceOperation(db,input.assessmentId);
  if (!op) throw new Response("Không còn suất cấp chứng nhận. / No credential capacity remains.",{status:409});
  if (op.fingerprint !== fingerprint) throw new Response("Kết quả đã thay đổi; cần đối soát yêu cầu cũ. / Issuance payload changed.",{status:409});
  return op;
}

export async function recoverIssuance(db: D1Database, id: string, actorId: string, chain: IssuanceTransport) {
  let op = await issuanceOperation(db,id);
  if (!op) throw new Response("Not found",{status:404});
  const input = JSON.parse(op.payload_json) as IssuancePayload;
  const existing = await db.prepare("SELECT * FROM skill_credentials WHERE assessment_id=?").bind(id).first();
  // Includes revoked records: retries must never revive a closed attestation.
  if (existing) return { credential: existing, operation: {...publicIssuance(op),status:"completed"} };
  if (["completed","failed","needs_review"].includes(op.status)) return { operation:publicIssuance(op) };
  const lease = crypto.randomUUID(), now=Date.now();
  const acquired = await db.prepare("UPDATE credential_issuance_operations SET lease=?,lease_until=? WHERE assessment_id=? AND lease_until<? AND status NOT IN ('completed','failed','needs_review')")
    .bind(lease,now+180000,id,now).run();
  if (!acquired.meta.changes) return { operation:publicIssuance(op) };
  op = (await issuanceOperation(db,id))!;
  const update = async (status: string, prepared: PreparedIssuance | null) => {
    const changed=await db.prepare("UPDATE credential_issuance_operations SET status=?,prepared_json=?,signature=?,attestation_address=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE assessment_id=? AND lease=?")
      .bind(status,prepared?JSON.stringify(prepared):null,prepared?.signature??null,prepared?.attestationAddress??null,id,lease).run();
    if (!changed.meta.changes) throw new Error("ISSUANCE_LEASE_LOST");
  };
  try {
    // Do not issue after the human result has been replaced while still unprepared.
    const result=await db.prepare("SELECT status,final_result_hash FROM assessments WHERE id=?").bind(id).first<{status:string;final_result_hash:string}>();
    if (!op.prepared_json && (result?.status!=="approved" || result.final_result_hash!==input.resultHash)) {
      await update("failed",null);
    } else {
      const prepared = op.prepared_json ? JSON.parse(op.prepared_json) as PreparedIssuance : await chain.prepare(input);
      if (!op.prepared_json) await update("prepared",prepared);
      const observed = await chain.inspect(input,prepared);
      if (observed === "finalized") {
        await update("finalized",prepared);
        // The record and capacity transition are one DB transaction. Failure leaves
        // the durable finalized operation recoverable on the next request.
        await db.batch([
          db.prepare(`INSERT INTO skill_credentials(id,assessment_id,challenge_id,student_user_id,student_wallet,issuer_organization_id,nonce_address,attestation_address,schema_address,score,skills_json,evidence_hash,status,issue_tx,expires_at,issued_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,CURRENT_TIMESTAMP) ON CONFLICT(assessment_id) DO NOTHING`)
            .bind(crypto.randomUUID(),id,input.challengeId,input.studentUserId,input.studentWallet,input.organizationId,
              prepared.nonceAddress,prepared.attestationAddress,input.schemaAddress,String(input.score),JSON.stringify(input.skills),input.evidenceHash,prepared.signature,new Date(input.expiryUnix*1000).toISOString()),
          db.prepare("UPDATE participations SET state='credential_issued',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT participation_id FROM submissions WHERE id=(SELECT submission_id FROM assessments WHERE id=?))").bind(id),
          db.prepare("UPDATE credential_issuance_operations SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE assessment_id=? AND lease=?").bind(id,lease),
          auditStatement(db,{actorUserId:actorId,organizationId:input.organizationId,action:"credential.issued",targetType:"assessment",targetId:id,metadata:{attestationAddress:prepared.attestationAddress,transaction:prepared.signature}}),
        ]);
        return { credential:await db.prepare("SELECT * FROM skill_credentials WHERE assessment_id=?").bind(id).first(),operation:{...publicIssuance(op),status:"completed",signature:prepared.signature,attestationAddress:prepared.attestationAddress} };
      } else if (observed === "mismatch" || op.status === "finalized") {
        await update("needs_review",prepared);
      } else if (observed === "failed") {
        await update("failed",prepared);
      } else if (observed === "expired") {
        // Safe expiry is determined from finalized height + absent signature/account.
        // Keep the frozen payload and capacity; next explicit retry prepares new bytes.
        await update("reserved",null);
      } else if (observed === "absent") {
        await update("broadcast",prepared);
        await chain.broadcast(prepared); // Always the persisted bytes, even after a timeout.
      }
    }
  } catch {
    // Never release capacity or replace a possibly submitted transaction on an RPC error.
    await db.prepare("UPDATE credential_issuance_operations SET last_error='RECONCILE_REQUIRED' WHERE assessment_id=? AND lease=?").bind(id,lease).run();
  } finally {
    await db.prepare("UPDATE credential_issuance_operations SET lease=NULL,lease_until=0 WHERE assessment_id=? AND lease=?").bind(id,lease).run();
  }
  return {operation:publicIssuance((await issuanceOperation(db,id))!)};
}
