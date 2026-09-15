import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { competitionFixture } from "../helpers/competition-fixture.ts";
let fixture: Awaited<ReturnType<typeof competitionFixture>>,
  server: ChildProcess;
const base = "http://127.0.0.1:3238";
before(async () => {
  fixture = await competitionFixture();
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      "3238",
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        TURSO_DATABASE_URL: fixture.dbUrl,
        TURSO_AUTH_TOKEN: "",
        SOLANA_RPC_URL: fixture.rpc,
        BLOB_STORE_ID: "",
        BLOB_READ_WRITE_TOKEN: "",
        SPONSORED_CLAIMS_ENABLED: "false",
      },
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch { /* Next.js may still be starting. */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw Error("QA server failed to start");
});
after(async () => {
  if (server?.exitCode === null) {
    server.kill();
    await new Promise((r) => server.once("exit", r));
  }
  await fixture?.stop();
});
async function api(
  role: string,
  url: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) {
  return fetch(base + url, {
    method,
    headers: {
      cookie: fixture.cookies[role] || "",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("review evidence, human approval, credential application and revocation flow", async () => {
  const citation = fixture.draft.rubric[0].citations[0];
  const query = `?sourceId=${citation.sourceId}&quote=${encodeURIComponent(citation.quote)}`;
  assert.equal(
    (await api("employer", "/api/assessments/qa-assessment/citation" + query))
      .status,
    403,
  );
  const evidence = await api(
    "reviewer",
    "/api/assessments/qa-assessment/citation" + query,
  );
  assert.equal(evidence.status, 200);
  const content = (await evidence.json()) as {
    file: { id: string };
    content: string;
    quote: string;
  };
  assert.equal(content.file.id, "qa-file");
  assert.ok(content.content.includes(content.quote));
  const revised = structuredClone(fixture.draft);
  revised.rubric[0].score -= 1;
  revised.totalScore -= 1;
  assert.equal(
    (
      await api("reviewer", "/api/assessments/qa-assessment/review", {
        decision: "approved",
        finalDraft: revised,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await api("reviewer", "/api/assessments/qa-assessment/review", {
        decision: "approved",
        finalDraft: revised,
        note: "Điều chỉnh theo chất lượng bằng chứng.",
      })
    ).status,
    200,
  );
  const progress = await api(
    "student",
    "/api/submissions/qa-submission/progress",
  );
  assert.equal(progress.status, 200);
  assert.equal(
    ((await progress.json()) as { assessment: { status: string } }).assessment
      .status,
    "approved",
  );
  assert.equal(
    (await api("outsider", "/api/submissions/qa-submission/progress")).status,
    403,
  );
  await fixture.addCredential();
  const checked = await api(
    "student",
    "/api/opportunities/qa-opportunity/verify",
    { credentialId: "qa-credential" },
  );
  assert.equal(checked.status, 200);
  assert.equal(
    ((await checked.json()) as { eligibility: { valid: boolean } }).eligibility
      .valid,
    true,
  );
  const body = {
    credentialId: "qa-credential",
    consent: true,
    profile: {
      displayName: "Minh Anh",
      introduction: "Tôi gửi hồ sơ cùng bằng chứng kỹ năng đã được xác minh.",
      portfolio: "https://example.com/portfolio",
    },
  };
  const responses = await Promise.all([
    api("student", "/api/opportunities/qa-opportunity/applications", body),
    api("student", "/api/opportunities/qa-opportunity/applications", body),
  ]);
  for (const response of responses)
    assert.ok(response.ok, await response.text());
  const rows = await api(
    "employer",
    "/api/opportunities/qa-opportunity/applications",
  );
  const applications = (
    (await rows.json()) as { applications: { id: string }[] }
  ).applications;
  assert.equal(applications.length, 1);
  assert.equal(
    (await api("outsider", "/api/opportunities/qa-opportunity/applications"))
      .status,
    403,
  );
  fixture.revoke();
  const recheck = await api(
    "employer",
    "/api/opportunities/qa-opportunity/applications",
    { action: "verify", applicationId: applications[0].id },
    "PATCH",
  );
  assert.equal(recheck.status, 200);
  assert.equal(
    ((await recheck.json()) as { eligibility: { valid: boolean } }).eligibility
      .valid,
    false,
  );
  assert.equal(
    (
      await api("student", "/api/opportunities/qa-opportunity/verify", {
        credentialId: "qa-credential",
      })
    ).status,
    403,
  );
});
