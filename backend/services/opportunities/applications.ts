import {
  opportunityAccepting,
  applicationProfile,
} from "../../../shared/validation/job-application.ts";
import {
  checkOpportunityCredential,
  type Eligibility,
} from "../../../solana/client/opportunity-verification.ts";
export type OpportunityRecord = {
  id: string;
  organization_id: string;
  required_issuer_organization_id: string;
  minimum_score: string;
  policy_address: string | null;
  status: string;
  closes_at: string | null;
  title: string;
};
export type ApplicationCredential = {
  id: string;
  student_user_id: string;
  student_wallet: string;
  issuer_organization_id: string;
  attestation_address: string;
  score: string;
  status: string;
};
export async function loadOpportunity(db: D1Database, id: string) {
  return db
    .prepare(
      "SELECT op.*,d.closes_at,d.requirements FROM opportunities op LEFT JOIN opportunity_details d ON d.opportunity_id=op.id WHERE op.id=?",
    )
    .bind(id)
    .first<OpportunityRecord>();
}
export async function checkApplication(
  db: D1Database,
  rpc: string,
  op: OpportunityRecord,
  user: { id: string; walletAddress: string },
  credentialId?: string,
  allowClosed = false,
  checker = checkOpportunityCredential,
) {
  if (!op.policy_address)
    throw new Response("Cơ hội chưa có điều kiện on-chain.", { status: 409 });
  if (!allowClosed && !opportunityAccepting(op.status, op.closes_at))
    throw new Response("Cơ hội đã đóng hoặc hết hạn.", { status: 409 });
  const rows = credentialId
    ? await db
        .prepare(
          "SELECT * FROM skill_credentials WHERE id=? AND student_user_id=?",
        )
        .bind(credentialId, user.id)
        .all<ApplicationCredential>()
    : await db
        .prepare(
          "SELECT * FROM skill_credentials WHERE student_user_id=? AND issuer_organization_id=? ORDER BY CAST(score AS INTEGER) DESC,issued_at DESC LIMIT 20",
        )
        .bind(user.id, op.required_issuer_organization_id)
        .all<ApplicationCredential>();
  let checked: Eligibility | null = null,
    selected: ApplicationCredential | null = null;
  for (const c of rows.results) {
    selected = c;
    checked = await checker(
      rpc,
      op.policy_address,
      op.id,
      user.walletAddress,
      c.attestation_address,
    );
    if (
      c.issuer_organization_id !== op.required_issuer_organization_id ||
      c.student_wallet !== user.walletAddress ||
      c.status !== "active"
    )
      checked = {
        ...checked,
        valid: false,
        reason:
          c.status !== "active" ? "CREDENTIAL_NOT_ACTIVE" : "WRONG_ISSUER",
      };
    if (checked.valid) break;
  }
  if (!checked)
    checked = await checker(
      rpc,
      op.policy_address,
      op.id,
      user.walletAddress,
      null,
    );
  return { credential: selected, eligibility: checked };
}
export async function saveApplication(
  db: D1Database,
  op: OpportunityRecord,
  user: { id: string; walletAddress: string },
  credential: ApplicationCredential,
  eligibility: Eligibility,
  profile: unknown,
  receipt: { receiptAddress: string | null; recordTx: string | null },
) {
  if (
    !eligibility.valid ||
    credential.student_user_id !== user.id ||
    credential.student_wallet !== user.walletAddress ||
    eligibility.attestation !== credential.attestation_address ||
    eligibility.policyAddress !== op.policy_address
  )
    throw new Error("APPLICATION_NOT_ELIGIBLE");
  const safe = applicationProfile(profile);
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT OR IGNORE INTO opportunity_applications(id,opportunity_id,user_id,credential_id,wallet_address,profile_json,verification_json,receipt_address,record_tx) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM opportunities o LEFT JOIN opportunity_details d ON d.opportunity_id=o.id WHERE o.id=? AND o.status='active' AND (d.closes_at IS NULL OR julianday(d.closes_at)>julianday('now')))`,
    )
    .bind(
      id,
      op.id,
      user.id,
      credential.id,
      user.walletAddress,
      JSON.stringify(safe),
      JSON.stringify(eligibility),
      receipt.receiptAddress,
      receipt.recordTx,
      op.id,
    )
    .run();
  const row = await db
    .prepare(
      "SELECT * FROM opportunity_applications WHERE opportunity_id=? AND user_id=?",
    )
    .bind(op.id, user.id)
    .first();
  if (!row)
    throw new Response("Cơ hội đã đóng trong lúc xác minh.", { status: 409 });
  return row;
}
