import assert from "node:assert/strict";
import test from "node:test";
import { credentialFixture, insertCredential } from "../helpers/credential-fixture.ts";

test("reproduction: legacy SELECT-count then independent inserts can exceed the last slot despite unique assessment indexes", async () => {
  const db = await credentialFixture();
  const observations = await Promise.all(["a","b"].map(() => db.prepare("SELECT COUNT(*) AS n FROM skill_credentials WHERE challenge_id='challenge' AND status IN ('active','issued')").first<{n:number}>()));
  assert.ok(observations.every(r => r?.n === 0));
  // Controlled interleaving of the pre-journal handler, no chain calls or real data.
  await insertCredential(db,"a").run();
  await insertCredential(db,"b").run();
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM skill_credentials").first<{n:number}>())?.n, 2);
});
