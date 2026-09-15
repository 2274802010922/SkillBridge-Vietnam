import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryDatabaseForTests } from "../../backend/database/adapters/d1-adapter.ts";
import { ensureCoreSchema } from "../../backend/database/schema/core-schema.ts";
import {
  saveApplication,
  checkApplication,
  type OpportunityRecord,
  type ApplicationCredential,
} from "../../backend/services/opportunities/applications.ts";
import {
  applicationProfile,
  opportunityAccepting,
} from "../../shared/validation/job-application.ts";
import type { Eligibility } from "../../solana/client/opportunity-verification.ts";
async function setup() {
  const db = createMemoryDatabaseForTests();
  await ensureCoreSchema(db);
  await db
    .prepare("INSERT INTO users(id) VALUES('student'),('business')")
    .run();
  await db
    .prepare(
      "INSERT INTO organizations(id,name,slug,kind,created_by_user_id) VALUES('issuer','Issuer','issuer','business','business'),('employer','Employer','employer','business','business')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO challenges(id,organization_id,created_by_user_id,title,brief,rubric_json,reward) VALUES('challenge','issuer','business','Title','Brief','[]','Badge')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO participations(id,challenge_id,student_user_id) VALUES('p','challenge','student')",
    )
    .run();
  await db
    .prepare("INSERT INTO submissions(id,participation_id) VALUES('s','p')")
    .run();
  await db
    .prepare(
      "INSERT INTO assessments(id,submission_id,provider,model,schema_version,assessment_json,ai_result_hash) VALUES('a','s','human','manual','1','{}','hash')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO skill_credentials(id,assessment_id,challenge_id,student_user_id,student_wallet,issuer_organization_id,nonce_address,attestation_address,schema_address,score,evidence_hash,status,expires_at) VALUES('c','a','challenge','student','wallet','issuer','nonce','attestation','schema','85','hash','active','2099-01-01')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO opportunities(id,organization_id,created_by_user_id,title,description,required_issuer_organization_id,minimum_score,policy_address,status) VALUES('op','employer','business','Role','Description','issuer','80','policy','active')",
    )
    .run();
  const op = await db
    .prepare("SELECT *,NULL AS closes_at FROM opportunities WHERE id='op'")
    .first<OpportunityRecord>();
  const c = await db
    .prepare("SELECT * FROM skill_credentials WHERE id='c'")
    .first<ApplicationCredential>();
  return { db, op: op!, c: c! };
}
const user = { id: "student", walletAddress: "wallet" };
const eligibility: Eligibility = {
  valid: true,
  reason: "ACTIVE_ONCHAIN_CREDENTIAL",
  score: 85,
  checkedAt: new Date().toISOString(),
  policyAddress: "policy",
  attestation: "attestation",
  checks: {
    wallet: true,
    issuer: true,
    active: true,
    score: true,
    approved: true,
  },
};
const profile = {
  displayName: "Student",
  introduction: "A thoughtful application with relevant evidence.",
  portfolio: "https://example.com/portfolio",
};
test("application snapshot is consent-scoped and concurrent retries create one row", async () => {
  const { db, op, c } = await setup();
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      saveApplication(
        db,
        op,
        user,
        c,
        eligibility,
        { ...profile, privateBank: "never share" },
        { receiptAddress: "receipt", recordTx: "tx" },
      ),
    ),
  );
  assert.ok(results.every((r) => r.id === results[0].id));
  const rows = await db
    .prepare("SELECT profile_json FROM opportunity_applications")
    .all<{ profile_json: string }>();
  assert.equal(rows.results.length, 1);
  assert.deepEqual(JSON.parse(rows.results[0].profile_json), profile);
});
test("closure during verification prevents application insertion", async () => {
  const { db, op, c } = await setup();
  await db.prepare("UPDATE opportunities SET status='closed'").run();
  await assert.rejects(() =>
    saveApplication(db, op, user, c, eligibility, profile, {
      receiptAddress: null,
      recordTx: null,
    }),
  );
});
test("rechecks deny revoked credentials even after a prior grant", async () => {
  const { db, op } = await setup();
  const checker = async () => ({
    ...eligibility,
    valid: false,
    reason: "CREDENTIAL_REVOKED",
    checks: { ...eligibility.checks, active: false },
  });
  const result = await checkApplication(
    db,
    "rpc",
    op,
    user,
    "c",
    false,
    checker,
  );
  assert.equal(result.eligibility.valid, false);
  assert.equal(result.eligibility.reason, "CREDENTIAL_REVOKED");
});
test("profile rejects executable links; deadline and eligibility guards fail closed", async () => {
  assert.throws(() =>
    applicationProfile({ ...profile, portfolio: "javascript:alert(1)" }),
  );
  assert.equal(opportunityAccepting("active", "invalid"), false);
  assert.equal(opportunityAccepting("draft", null), false);
  const { db, op, c } = await setup();
  await assert.rejects(() =>
    saveApplication(
      db,
      op,
      user,
      c,
      { ...eligibility, valid: false },
      profile,
      { receiptAddress: null, recordTx: null },
    ),
  );
  await assert.rejects(() =>
    saveApplication(
      db,
      op,
      { ...user, walletAddress: "other" },
      c,
      eligibility,
      profile,
      { receiptAddress: null, recordTx: null },
    ),
  );
});
