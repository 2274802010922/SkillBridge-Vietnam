import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryDatabaseForTests } from "../../backend/database/adapters/d1-adapter.ts";
import { ensureCoreSchema } from "../../backend/database/schema/core-schema.ts";

test("D1 compatibility adapter preserves prepared statements and atomic batches", async () => {
  const db = createMemoryDatabaseForTests();
  await db
    .prepare("CREATE TABLE records (id TEXT PRIMARY KEY, value TEXT NOT NULL)")
    .run();
  await db.batch([
    db
      .prepare("INSERT INTO records (id, value) VALUES (?, ?)")
      .bind("one", "first"),
    db
      .prepare("INSERT INTO records (id, value) VALUES (?, ?)")
      .bind("two", "second"),
  ]);

  const row = await db
    .prepare("SELECT value FROM records WHERE id = ?")
    .bind("two")
    .first<{ value: string }>();
  assert.deepEqual(row, { value: "second" });
  const updated = await db
    .prepare("UPDATE records SET value = ? WHERE id = ?")
    .bind("changed", "one")
    .run();
  assert.equal(updated.meta.changes, 1);
  const all = await db
    .prepare("SELECT id, value FROM records ORDER BY id")
    .all<{ id: string; value: string }>();
  assert.deepEqual(all.results, [
    { id: "one", value: "changed" },
    { id: "two", value: "second" },
  ]);
});

test("core schema migrates existing challenges to invite-only access", async () => {
  const db = createMemoryDatabaseForTests();
  await db
    .prepare(
      `
    CREATE TABLE challenges (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      closes_at TEXT
    )
  `,
    )
    .run();
  await db
    .prepare(
      "INSERT INTO challenges (id, organization_id, status) VALUES ('legacy', 'org', 'published')",
    )
    .run();

  await ensureCoreSchema(db);

  const columns = await db
    .prepare("PRAGMA table_info(challenges)")
    .all<{ name: string }>();
  assert.equal(
    columns.results.some((column) => column.name === "access_type"),
    true,
  );
  assert.equal(
    columns.results.some((column) => column.name === "content_json"),
    true,
  );
  assert.equal(
    columns.results.some((column) => column.name === "deleted_at"),
    true,
  );
  assert.equal(
    columns.results.some((column) => column.name === "deleted_by_user_id"),
    true,
  );
  const legacy = await db
    .prepare("SELECT access_type FROM challenges WHERE id = 'legacy'")
    .first<{ access_type: string }>();
  assert.deepEqual(legacy, { access_type: "invite_only" });
  const legacyContent = await db
    .prepare("SELECT content_json FROM challenges WHERE id = 'legacy'")
    .first<{ content_json: string }>();
  assert.deepEqual(legacyContent, { content_json: "{}" });

  const beneficiaryColumns = await db
    .prepare("PRAGMA table_info(cashout_beneficiaries)")
    .all<{ name: string }>();
  assert.equal(
    beneficiaryColumns.results.some((column) => column.name === "bank_bin"),
    true,
  );
  assert.equal(
    beneficiaryColumns.results.some(
      (column) => column.name === "verification_provider",
    ),
    true,
  );
  const cashoutColumns = await db
    .prepare("PRAGMA table_info(cashout_sessions)")
    .all<{ name: string }>();
  assert.equal(
    cashoutColumns.results.some(
      (column) => column.name === "reference_rate_vnd",
    ),
    true,
  );
  assert.equal(
    cashoutColumns.results.some(
      (column) => column.name === "quote_payload_hash",
    ),
    true,
  );
  const snapshotTable = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fx_rate_snapshots'",
    )
    .first<{ name: string }>();
  assert.deepEqual(snapshotTable, { name: "fx_rate_snapshots" });
});
