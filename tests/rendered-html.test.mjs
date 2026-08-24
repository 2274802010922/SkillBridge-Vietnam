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
  assert.match(html, /solana-hero-title/i);
  assert.match(html, /solana-flow-list/i);
  assert.match(html, /AI tùy chọn/i);
  assert.match(html, /solana-mobile-menu-btn/i);
  assert.match(html, /solana-hero-proof/i);
  assert.doesNotMatch(html, /k95-persistent-canvas|3D View Mode/i);
  assert.doesNotMatch(html, /data-reveal="(?:title|panel)"/i);
  assert.doesNotMatch(html, /Luồng tương tác mẫu|Interactive vertical slice|demo-section/i);
  assert.match(html, /language-switcher/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
});

test("keeps the public landing static and free of the retired animation runtime", async () => {
  const [homeCopy, packageJson] = await Promise.all([
    readFile(new URL("../app/components/home-copy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(homeCopy, /K95StageCanvas|K95BootLoader|K95Cursor|K95LayoutSwitch|useSmoothScroll|useScrollReveal/);
  assert.match(homeCopy, /solana-hero-proof/);
  assert.doesNotMatch(packageJson, /"three"|"lenis"|"@types\/three"/);
});

test("server-renders the three-role end-to-end sandbox", async () => {
  const response = await render("/sandbox");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Build một lần/i);
  assert.match(html, /SANDBOX · ROLE SIMULATOR/i);
  assert.match(html, /role-workspace/i);
});

test("keeps the authenticated workspace responsive without removing language access", async () => {
  const [header, styles] = await Promise.all([
    readFile(new URL("../app/components/app-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(header, /mobile-workspace-navigation/);
  assert.match(header, /aria-expanded=\{workspaceMenuOpen\}/);
  assert.match(header, /LanguageSwitcher/);
  assert.match(styles, /@media \(max-width: 1023px\)/);
  assert.match(styles, /\.app-sidebar\s*\{\s*display: none;/);
  assert.match(styles, /\.challenge-builder,/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /\.mobile-workspace-navigation\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
});

test("keeps the product navigation role-first and exposes a unified payment hub", async () => {
  const [header, dashboard, payments] = await Promise.all([
    readFile(new URL("../app/components/app-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/app-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/payments-workspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(header, /primaryNavigation/);
  assert.match(header, /sidebar-advanced/);
  assert.match(header, /role-switcher/);
  assert.match(dashboard, /next-action-panel/);
  assert.match(dashboard, /journey-summary/);
  assert.match(payments, /payment-choice-grid/);
  assert.match(payments, /payments\.challengeTitle/);
});

test("supports internal business and independent organization review provenance", async () => {
  const [challengeRoute, authorization, challengeUi, reviewUi] = await Promise.all([
    readFile(new URL("../app/api/challenges/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/authorization.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/challenges-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/reviews-workspace.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(challengeRoute, /reviewMode/);
  assert.match(challengeRoute, /reviewerOrganizationId/);
  assert.match(challengeRoute, /kind IN \('business', 'university'\)/);
  assert.match(challengeRoute, /Review độc lập phải do một tổ chức khác/);
  assert.match(authorization, /requireChallengeReviewer/);
  assert.match(authorization, /business_admin.*challenge_manager.*reviewer.*university_admin/);
  assert.match(challengeUi, /review-mode-options/);
  assert.match(challengeUi, /reviewSelf/);
  assert.match(challengeUi, /reviewIndependent/);
  assert.match(reviewUi, /review-provenance/);
});

test("supports Wallet Standard sign-and-send and sign-only Devnet payment flows", async () => {
  const [paymentButton, relayRoute, invoiceRoute] = await Promise.all([
    readFile(new URL("../app/components/wallet-payment-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/solana/send/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invoices/[id]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(paymentButton, /SolanaSignAndSendTransaction/);
  assert.match(paymentButton, /SolanaSignTransaction/);
  assert.match(paymentButton, /solana:devnet/);
  assert.match(paymentButton, /\/api\/solana\/send/);
  assert.match(relayRoute, /method: "sendTransaction"/);
  assert.match(relayRoute, /preflightCommitment: "confirmed"/);
  assert.match(invoiceRoute, /getSessionUser/);
  assert.match(invoiceRoute, /publicPayer/);
});

test("includes an on-chain reward-vault gate and a clearly isolated cash-out sandbox", async () => {
  const [challengeRoute, fundingRoute, payoutRoute, cashoutRoute, cashoutUi, walletAssets] = await Promise.all([
    readFile(new URL("../app/api/challenges/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/challenges/[id]/funding/verify/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/payouts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cashout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/cashout-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/wallet/assets/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(challengeRoute, /funding_status !== "funded"/);
  assert.match(fundingRoute, /verifySolPayment/);
  assert.match(fundingRoute, /verifyUsdcPayment/);
  assert.match(payoutRoute, /sendRewardVaultTransfer/);
  assert.match(cashoutRoute, /No bank transfer or on-chain transfer is performed/);
  assert.match(cashoutUi, /No real bank transfer was made/);
  assert.match(walletAssets, /getTokenAccountsByOwner/);
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
