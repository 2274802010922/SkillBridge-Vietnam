import { createMemoryDatabaseForTests } from "../../backend/database/adapters/d1-adapter.ts";
import { ensureCoreSchema } from "../../backend/database/schema/core-schema.ts";

export async function credentialFixture(slots = 1) {
  const db = createMemoryDatabaseForTests();
  await ensureCoreSchema(db);
  await db.prepare("INSERT INTO users(id) VALUES('owner'),('student'),('student-b')").run();
  await db.prepare("INSERT INTO organizations(id,name,slug,kind,created_by_user_id) VALUES('org','QA','qa','business','owner')").run();
  await db.prepare("INSERT INTO challenges(id,organization_id,created_by_user_id,title,brief,rubric_json,reward,reward_slots) VALUES('challenge','org','owner','QA','Brief','{}','Reward',?)").bind(slots).run();
  for (const id of ["a", "b"]) {
    await db.prepare("INSERT INTO participations(id,challenge_id,student_user_id) VALUES(?, 'challenge',?)").bind(id,id === "a" ? "student" : "student-b").run();
    await db.prepare("INSERT INTO submissions(id,participation_id) VALUES(?,?)").bind(id,id).run();
    await db.prepare("INSERT INTO assessments(id,submission_id,provider,model,schema_version,assessment_json,ai_result_hash,final_result_hash,status) VALUES(?,?,'manual','human','1','{}','hash','final','approved')").bind(id,id).run();
  }
  return db;
}

export function insertCredential(db: D1Database, id: string) {
  return db.prepare("INSERT INTO skill_credentials(id,assessment_id,challenge_id,student_user_id,student_wallet,issuer_organization_id,nonce_address,attestation_address,schema_address,score,evidence_hash,status,expires_at) VALUES(?,?,'challenge','student','wallet','org',?,?,'schema','90','hash','active','2099-01-01')").bind(id,id,id,id);
}
