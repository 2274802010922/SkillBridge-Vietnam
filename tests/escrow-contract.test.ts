import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryDatabaseForTests } from "../lib/d1-adapter.ts";
import { ensureCoreSchema } from "../lib/core-schema.ts";
import { escrowAddress, submissionAddress } from "../lib/challenge-escrow.ts";
test("escrow addresses isolate challenges and receipt addresses isolate students", async () => {
  const funder = "11111111111111111111111111111111";
  const a = await escrowAddress({ funder, challengeId: "a" }),
    b = await escrowAddress({ funder, challengeId: "b" });
  assert.notEqual(a, b);
  assert.equal(a, await escrowAddress({ funder, challengeId: "a" }));
  assert.notEqual(
    await submissionAddress(a, funder),
    await submissionAddress(b, funder),
  );
});
test("signed evidence is immutable and legacy transfer operations cannot duplicate", async () => {
  const db = createMemoryDatabaseForTests();
  await ensureCoreSchema(db);
  await db.prepare("INSERT INTO users(id) VALUES('u')").run();
  await db
    .prepare(
      "INSERT INTO organizations(id,name,slug,kind,created_by_user_id) VALUES('o','Org','org','business','u')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO challenges(id,organization_id,created_by_user_id,title,brief,rubric_json,reward) VALUES('c','o','u','Challenge','Brief','{}','Reward')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO participations(id,challenge_id,student_user_id) VALUES('p','c','u')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO submissions(id,participation_id,reflection) VALUES('s','p','Original')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO submission_files(id,submission_id,r2_key,original_name,content_type,size_bytes,sha256,uploaded_by_user_id) VALUES('f','s','key','file.txt','text/plain','10','hash','u')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO escrow_submission_locks(submission_id,challenge_id,student_wallet,evidence_hash) VALUES('s','c','wallet','hash')",
    )
    .run();
  await assert.rejects(
    db
      .prepare("UPDATE submissions SET reflection='Mutated' WHERE id='s'")
      .run(),
  );
  await assert.rejects(
    db.prepare("DELETE FROM submission_files WHERE id='f'").run(),
  );
  await assert.rejects(
    db
      .prepare("UPDATE submission_files SET sha256='replacement' WHERE id='f'")
      .run(),
  );
  await db
    .prepare("UPDATE submissions SET state='submitted' WHERE id='s'")
    .run();
  await db
    .prepare(
      "INSERT INTO legacy_vault_operations(operation_key,payload_hash) VALUES('payout:s','payload')",
    )
    .run();
  const retry = await db
    .prepare(
      "INSERT OR IGNORE INTO legacy_vault_operations(operation_key,payload_hash) VALUES('payout:s','payload')",
    )
    .run();
  assert.equal(retry.meta.changes, 0);
});
