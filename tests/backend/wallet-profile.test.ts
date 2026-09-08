import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryDatabaseForTests } from "../../backend/database/adapters/d1-adapter.ts";
import { ensureCoreSchema } from "../../backend/database/schema/core-schema.ts";
import {
  DEFAULT_DETAILS,
  validateProfileUpdate,
  readWalletProfile,
  saveWalletProfile,
  type ProfileInput,
} from "../../backend/services/profiles/wallet-profile.ts";

const defaults: ProfileInput = {
  ...DEFAULT_DETAILS,
  displayName: "Student A",
  profileKind: "student",
  headline: "",
  bio: "",
  visibility: "private",
  availability: "available",
};
test("profile update rejects unsafe links, oversized fields and malformed avatars; partial updates preserve choices", () => {
  assert.throws(() =>
    validateProfileUpdate({ website: "javascript:alert(1)" }, defaults),
  );
  assert.throws(() =>
    validateProfileUpdate(
      { website: "https://user:secret@example.com" },
      defaults,
    ),
  );
  assert.throws(() =>
    validateProfileUpdate({ bio: "x".repeat(2001) }, defaults),
  );
  assert.throws(() =>
    validateProfileUpdate(
      { avatar: "data:image/svg+xml;base64,PHN2Zz4=" },
      defaults,
    ),
  );
  assert.throws(() =>
    validateProfileUpdate({ shareAchievements: "true" }, defaults),
  );
  assert.equal(
    validateProfileUpdate(
      { displayName: "New Name" },
      { ...defaults, visibility: "unlisted" },
    ).visibility,
    "unlisted",
  );
  assert.equal(
    validateProfileUpdate({ userId: "other", wallet: "other" }, defaults)
      .displayName,
    "Student A",
  );
});
test("wallet profiles persist, isolate owners, enforce visitor privacy and reflect credential lifecycle", async () => {
  const db = createMemoryDatabaseForTests();
  await ensureCoreSchema(db);
  for (const id of ["a", "b"]) {
    await db
      .prepare("INSERT INTO users(id,display_name) VALUES(?,?)")
      .bind(id, "Student " + id)
      .run();
    await db
      .prepare("INSERT INTO wallets(address,user_id) VALUES(?,?)")
      .bind("wallet-" + id, id)
      .run();
  }
  assert.equal(await readWalletProfile(db, "wallet-a", "b"), null);
  await saveWalletProfile(db, "a", {
    displayName: "Alice",
    headline: "Designer",
    visibility: "unlisted",
    bio: "Hello",
  });
  await saveWalletProfile(db, "b", {
    displayName: "Bob",
    userId: "a",
    bio: "Bob only",
  });
  assert.equal((await readWalletProfile(db, "wallet-a", "a"))?.bio, "Hello");
  assert.equal((await readWalletProfile(db, "wallet-b", "b"))?.bio, "Bob only");
  assert.equal((await readWalletProfile(db, "wallet-a"))?.displayName, "Alice");
  assert.equal(
    (
      await db
        .prepare(
          "SELECT user_id FROM talent_profiles WHERE visibility='public'",
        )
        .all()
    ).results.length,
    0,
  );
  await saveWalletProfile(db, "a", { visibility: "public" });
  assert.equal(
    (
      await db
        .prepare(
          "SELECT user_id FROM talent_profiles WHERE visibility='public'",
        )
        .all()
    ).results.length,
    1,
  );
  await db
    .prepare(
      "INSERT INTO organizations(id,name,slug,kind,created_by_user_id) VALUES('o','Test Org','test-org','business','a')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO memberships(id,organization_id,user_id,role,status) VALUES('m','o','a','business_admin','active')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO challenges(id,organization_id,title,brief,rubric_json,skills_json,created_by_user_id,access_type,reward) VALUES('c','o','Public challenge','Brief','{}','[]','a','public','Badge')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO participations(id,challenge_id,student_user_id) VALUES('p','c','a')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO submissions(id,participation_id,evidence_json) VALUES('s','p','{}')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO assessments(id,submission_id,status,assessment_json,provider,model,schema_version,ai_result_hash) VALUES('as','s','approved','{}','manual','human','1','hash')",
    )
    .run();
  await db
    .prepare(
      `INSERT INTO skill_credentials(id,assessment_id,challenge_id,student_user_id,student_wallet,issuer_organization_id,nonce_address,attestation_address,schema_address,score,evidence_hash,status,expires_at,skills_json) VALUES('proof','as','c','a','wallet-a','o','nonce','att','schema','85','hash','active','2099-01-01','[{"skill":"Design"}]')`,
    )
    .run();
  assert.equal((await readWalletProfile(db, "wallet-a"))?.proofs.length, 0);
  assert.equal(
    (await readWalletProfile(db, "wallet-a"))?.organizations.length,
    0,
  );
  await saveWalletProfile(db, "a", {
    shareAchievements: true,
    shareOrganizations: true,
  });
  const shared = await readWalletProfile(db, "wallet-a");
  assert.equal(shared?.proofs.length, 1);
  assert.deepEqual(shared?.proofs[0].skills, ["Design"]);
  assert.equal(shared?.organizations.length, 1);
  assert.equal("user_id" in shared!, false);
  assert.equal("balance" in shared!, false);
  await db
    .prepare("UPDATE challenges SET access_type='invite_only' WHERE id='c'")
    .run();
  assert.equal((await readWalletProfile(db, "wallet-a"))?.proofs.length, 0);
  await db
    .prepare("UPDATE challenges SET access_type='public' WHERE id='c'")
    .run();
  await db
    .prepare("UPDATE skill_credentials SET status='revoked' WHERE id='proof'")
    .run();
  assert.equal((await readWalletProfile(db, "wallet-a"))?.proofs.length, 0);
  await db
    .prepare(
      "UPDATE skill_credentials SET status='active', expires_at='2000-01-01' WHERE id='proof'",
    )
    .run();
  assert.equal((await readWalletProfile(db, "wallet-a"))?.proofs.length, 0);
  assert.equal(
    (await readWalletProfile(db, "wallet-a", "a"))?.proofs[0].status,
    "expired",
  );
  await saveWalletProfile(db, "a", { visibility: "private" });
  assert.equal(await readWalletProfile(db, "wallet-a"), null);
  assert.equal(await readWalletProfile(db, "wallet-a", "b"), null);
  assert.equal(
    (await readWalletProfile(db, "wallet-a", "a"))?.headline,
    "Designer",
  );
});
