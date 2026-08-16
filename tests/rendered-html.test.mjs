import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3217;
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let serverOutput = "";

before(async () => {
  server = spawn(
    process.execPath,
    [path.join(projectRoot, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(port)],
    { cwd: projectRoot, env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server may still be starting; retry until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Next.js test server did not start. ${serverOutput.slice(-1_000)}`);
});

after(() => {
  server?.kill();
});

async function render(pathname = "/") {
  return fetch(`${baseUrl}${pathname}`, { headers: { accept: "text/html" } });
}

test("server-renders the SkillBridge product page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /SkillBridge Vietnam/i);
  assert.match(html, /Bài làm tốt/i);
  assert.match(html, /Luồng tương tác mẫu/i);
  assert.match(html, /AI đề xuất/i);
  assert.match(html, /15\/15 bài kiểm tra hợp đồng đạt/i);
  assert.match(html, /language-switcher/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("server-renders the three-role end-to-end sandbox", async () => {
  const response = await render("/sandbox");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build một lần/i);
  assert.match(html, /SANDBOX · ROLE SIMULATOR/i);
  assert.match(html, /role-workspace/i);
});

test("removes temporary starter metadata and dependencies", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /codex-preview|_sites-preview|SkeletonPreview/);
  assert.match(layout, /lang="vi"/);
  assert.match(layout, /SkillBridge Vietnam/);
  assert.match(packageJson, /"name": "skillbridge-vietnam"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
