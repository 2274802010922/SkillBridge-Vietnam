import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

test("independent verifier assets are public but private manifests stay authenticated",async()=>{
  const response=await render("/claim-verifier/index.html");
  assert.equal(response.status,200);
  assert.match((await response.text()).replace(/\s+/g," "),/Không cần phiên đăng nhập/);
  for(const pathname of ["/api/submissions/not-owned/manifest","/api/challenges/not-owned/escrow/manifest"]){
    const privateResponse=await fetch(baseUrl+pathname);
    assert.equal(privateResponse.status,401);
  }
});

test("AI assistance requires a session before reading or sending content",async()=>{
  const response=await fetch(baseUrl+"/api/ai/assist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"brief",text:"A sample challenge for access verification."})});
  assert.equal(response.status,401);
});

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
    readFile(new URL("../../frontend/features/landing/home-copy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(homeCopy, /K95StageCanvas|K95BootLoader|K95Cursor|K95LayoutSwitch|useSmoothScroll|useScrollReveal/);
  assert.match(homeCopy, /solana-hero-proof/);
  assert.doesNotMatch(packageJson, /"three"|"lenis"|"@types\/three"/);
});

test("wallet entry explains zero-funds onboarding before any wallet is detected", async () => {
  const response = await render("/auth?returnTo=%2Fchallenge%2Finvitation-test&lang=en");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Tôi đã có ví/);
  assert.match(html, /Tôi chưa có ví/);
  assert.match(html, /chưa cần nạp tiền/);
  assert.match(html, /cụm từ khôi phục/);
  assert.doesNotMatch(html, /Đăng nhập bằng ví Solana/);
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
  const [header, styles, clarityStyles, workspaceLayout, loadingUi, childPage] = await Promise.all([
    readFile(new URL("../../frontend/components/layout/app-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/styles/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/styles/clarity.css", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/components/feedback/loading-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/reviews/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(header, /mobile-workspace-navigation/);
  assert.match(header, /aria-expanded=\{workspaceMenuOpen\}/);
  assert.match(header, /LanguageSwitcher/);
  assert.match(styles, /@media \(max-width: 1023px\)/);
  assert.match(styles, /\.app-sidebar\s*\{\s*display: none;/);
  assert.match(styles, /\.challenge-builder,/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /\.mobile-workspace-navigation\s*\{\s*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(workspaceLayout, /<AppHeader[\s\S]*<AppSidebar[\s\S]*\{children\}/);
  assert.doesNotMatch(childPage, /AppHeader|AppSidebar|product-app/);
  assert.match(loadingUi, /ContentSkeleton delayed/);
  assert.match(loadingUi, /5_000/);
  assert.match(clarityStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(clarityStyles, /\.skeleton-block/);
});

test("preserves wallet transaction recovery while showing meaningful progress", async () => {
  const payment = await readFile(new URL("../../frontend/components/wallet/wallet-payment-button.tsx", import.meta.url), "utf8");
  assert.match(payment, /skillbridge-escrow:/);
  assert.match(payment, /localStorage\.getItem\(savedKey\)/);
  assert.match(payment, /wallet-payment-progress/);
  assert.match(payment, /Đã gửi giao dịch/);
  assert.match(payment, /aria-busy=\{busy\}/);
});
test("keeps the product navigation role-first and exposes a unified payment hub", async () => {
  const [header, dashboard, payments] = await Promise.all([
    readFile(new URL("../../frontend/components/layout/app-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/features/dashboard/app-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/features/payments/payments-workspace.tsx", import.meta.url), "utf8"),
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
    readFile(new URL("../../backend/http/challenges/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/auth/authorization.ts", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/features/challenges/challenges-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/features/reviews/reviews-workspace.tsx", import.meta.url), "utf8"),
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

test("presents challenges as structured, responsive content and manages drafts safely", async () => {
  const [challengeRoute, challengeMutationRoute, challengeUi, detailUi, detailPage, styles] = await Promise.all([
    readFile(new URL("../../backend/http/challenges/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/challenges/[id]/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/features/challenges/challenges-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/features/challenge-detail/challenge-detail-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/app/challenges/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/styles/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(challengeRoute, /content_json/);
  assert.match(challengeRoute, /normalizeChallengeContent/);
  assert.match(challengeUi, /challenge-content-form/);
  assert.match(challengeUi, /challenge-content-preview/);
  assert.match(challengeUi, /challenge-details-link/);
  assert.match(challengeUi, /<dl className="challenge-summary-meta">/);
  assert.match(challengeUi, /editDraft/);
  assert.match(challengeUi, /deleteDraft/);
  assert.match(challengeMutationRoute, /update_draft/);
  assert.match(challengeMutationRoute, /draftDeletionDecision/);
  assert.match(challengeMutationRoute, /deleted_at/);
  assert.match(detailUi, /challenge-detail-layout/);
  assert.match(detailUi, /parseChallengeContent/);
  assert.match(detailPage, /ChallengeDetailWorkspace/);
  assert.match(styles, /challenge-summary-meta/);
  assert.match(styles, /challenge-card-managed/);
  assert.match(styles, /@container challenge-summary/);
  assert.match(styles, /button-danger-text/);
  assert.match(styles, /challenge-wizard \.review-mode-option input\[type="radio"\]/);
});

test("supports Wallet Standard sign-and-send and sign-only Devnet payment flows", async () => {
  const [paymentButton, relayRoute, invoiceRoute] = await Promise.all([
    readFile(new URL("../../frontend/components/wallet/wallet-payment-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/solana/send/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/invoices/[id]/handler.ts", import.meta.url), "utf8"),
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

test("includes an on-chain reward-vault gate and recoverable Devnet cash-out", async () => {
  const [challengeRoute, fundingRoute, payoutRoute, cashoutRoute, cashoutVerify, cashoutUi, walletAssets, webhookRoute, fxReference, beneficiaryVerification] = await Promise.all([
    readFile(new URL("../../backend/http/challenges/[id]/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/challenges/[id]/funding/verify/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/payouts/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/cashout/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/cashout/[id]/verify/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../frontend/features/cashout/cashout-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/wallet/assets/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/webhooks/offramp/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/fx/reference/handler.ts", import.meta.url), "utf8"),
    readFile(new URL("../../backend/http/cashout/beneficiaries/verify/handler.ts", import.meta.url), "utf8"),
  ]);
  assert.match(challengeRoute, /funding_status !== "funded"/);
  assert.match(fundingRoute, /verifySolPayment/);
  assert.match(fundingRoute, /verifyUsdcPayment/);
  assert.match(payoutRoute, /journaledVaultTransfer/);
  assert.match(cashoutRoute, /createDevnetCashoutQuote/);
  assert.match(cashoutRoute, /getFxReference/);
  assert.match(cashoutRoute, /fx_rate_snapshots/);
  assert.match(cashoutRoute, /quote_expires_at/);
  assert.match(cashoutVerify, /verifyUsdcPayment/);
  assert.match(cashoutVerify, /requireFinalized: true/);
  assert.match(cashoutVerify, /TX_ALREADY_USED/);
  assert.match(cashoutUi, /WalletPaymentButton\s+cashoutId/);
  assert.match(cashoutUi, /Keep USDC in wallet/);
  assert.match(cashoutUi, /Giá thị trường tham chiếu/);
  assert.match(cashoutUi, /Đã kiểm tra định dạng/);
  assert.match(cashoutUi, /no real VND has moved/);
  assert.match(cashoutUi, /private key or seed phrase/);
  assert.match(webhookRoute, /x-skillbridge-signature/);
  assert.match(webhookRoute, /provider_event_id/);
  assert.match(walletAssets, /getTokenAccountsByOwner/);
  assert.match(fxReference, /getFxReference/);
  assert.match(beneficiaryVerification, /sandbox_confirmed/);
});

test("removes temporary starter metadata and dependencies", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /codex-preview|_sites-preview|SkeletonPreview/);
  assert.match(layout, /lang="vi"/);
  assert.match(layout, /SkillBridge Vietnam/);
  assert.match(packageJson, /"name": "skillbridge-vietnam"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
