import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const checker = fileURLToPath(new URL("../../scripts/check-repo.mjs", import.meta.url));
const required = [
  "AGENTS.md", "solana/AGENTS.md", "docs/README.md",
  "docs/harness/README.md",
  "docs/harness/context/CURRENT_STATE.md", "docs/harness/context/HANDOFF.md",
  "docs/harness/plans/README.md", "docs/harness/plans/PLAN_TEMPLATE.md",
  "docs/harness/decisions/README.md", "docs/harness/decisions/ADR_TEMPLATE.md",
];
function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "skillbridge-harness-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, content = "# Fixture\n") => {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  for (const name of [...required, "README.md", "README.vi.md", "CONTRIBUTING.md", "CHANGELOG.md"]) put(name);
  put("tsconfig.json", '{"compilerOptions":{}}');
  put("docs/harness/plans/active/.gitkeep", "");
  put("docs/harness/plans/completed/.gitkeep", "");
  const run = () => {
    const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.ifError(result.error);
    return { code: result.status, output: result.stdout + result.stderr };
  };
  return { root, put, run };
}

test("harness accepts empty plan directories and valid lifecycle states", (t) => {
  const f = fixture(t);
  assert.equal(f.run().code, 0);
  f.put("docs/harness/plans/active/one.md", "# One\nStatus: active\n");
  f.put("docs/harness/plans/active/two.md", "# Two\r\nStatus: blocked\r\n");
  f.put("docs/harness/plans/completed/three.md", "# Three\nStatus: completed\n");
  f.put("docs/harness/plans/completed/four.md", "# Four\nStatus: cancelled\n");
  assert.equal(f.run().code, 0);
});
test("harness rejects every missing or empty required file", (t) => {
  const f = fixture(t);
  for (const name of required) rmSync(path.join(f.root, name));
  const missing = f.run();
  assert.equal(missing.code, 1);
  for (const name of required) assert.ok(missing.output.includes("Missing or empty harness file: " + name));
  for (const name of required) f.put(name, "\n");
  const empty = f.run();
  assert.equal(empty.code, 1);
  for (const name of required) assert.ok(empty.output.includes("Missing or empty harness file: " + name));
});
test("harness checks local links in the index and root instructions", (t) => {
  const f = fixture(t);
  f.put("docs/README.md", "[Broken](context/missing.md)\n");
  f.put("AGENTS.md", "[Broken](docs/missing.md)\n");
  const result = f.run();
  assert.equal(result.code, 1);
  assert.match(result.output, /docs[/\\]README.md: broken link context\/missing.md/);
  assert.match(result.output, /AGENTS.md: broken link docs\/missing.md/);
});
test("harness rejects missing plan directories and unexpected nesting", (t) => {
  const f = fixture(t);
  rmSync(path.join(f.root, "docs/harness/plans/active"), { recursive: true });
  assert.match(f.run().output, /Missing plan directory: docs\/harness\/plans\/active/);
  f.put("docs/harness/plans/active/nested/one.md", "Status: active\n");
  const result = f.run();
  assert.equal(result.code, 1);
  assert.match(result.output, /plans must be flat Markdown files/);
});
test("harness rejects wrong, absent and ambiguous plan statuses", (t) => {
  const f = fixture(t);
  f.put("docs/harness/plans/active/wrong.md", "Status: completed\n");
  f.put("docs/harness/plans/completed/wrong.md", "Status: active\n");
  f.put("docs/harness/plans/active/absent.md", "# No status\n");
  f.put("docs/harness/plans/active/ambiguous.md", "Status: active\nStatus: blocked\n");
  f.put("docs/harness/plans/active/split.md", "Status:\nactive\n");
  const result = f.run();
  assert.equal(result.code, 1);
  for (const name of ["active/wrong", "completed/wrong", "active/absent", "active/ambiguous", "active/split"])
    assert.ok(result.output.includes(name + ".md: expected one Status:"));
});
test("harness rejects plans copied to both lifecycle directories", (t) => {
  const f = fixture(t);
  f.put("docs/harness/plans/active/same.md", "Status: active\n");
  f.put("docs/harness/plans/completed/same.md", "Status: completed\n");
  const result = f.run();
  assert.equal(result.code, 1);
  assert.match(result.output, /Duplicate active\/completed plan: same.md/);
});
