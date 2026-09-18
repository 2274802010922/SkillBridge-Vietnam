import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import bs58 from "bs58";
import { competitionFixture } from "../helpers/competition-fixture.ts";
import { assertCashoutTransaction } from "../../solana/client/cashout-transaction.ts";
import { sandboxSignature } from "../../backend/services/cashout/providers/sandbox.ts";
import type { CashoutRow } from "../../backend/services/cashout/cashout-record.ts";

let fixture: Awaited<ReturnType<typeof competitionFixture>>, server: ChildProcess;
const base = "http://127.0.0.1:3244", key = (n: number) => bs58.encode(new Uint8Array(32).fill(n));
before(async () => {
  fixture = await competitionFixture();
  server = spawn(process.execPath, ["--import", "./tests/helpers/mock-offramp.mjs", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3244"], {
    env: { ...process.env, NODE_ENV: "production", TURSO_DATABASE_URL: fixture.dbUrl, TURSO_AUTH_TOKEN: "",
      SOLANA_RPC_URL: "http://127.0.0.1:39998", SOLANA_USDC_MINT: key(2), SOLANA_REWARD_VAULT_SECRET: "", SOLANA_AUTHORIZED_SIGNER_SECRET: "",
      CASHOUT_DEVNET_SETTLEMENT_WALLET: key(3), CASHOUT_WEBHOOK_SECRET: "fixture-secret",
      CASHOUT_MODE: "devnet_sandbox", REAL_CASHOUT_ENABLED: "false", OFFRAMP_PROVIDER: "devnet_sandbox", OFFRAMP_API_KEY: "", OFFRAMP_API_BASE_URL: "",
      CASHOUT_QUOTE_TTL_SECONDS: "300", EXCHANGE_RATE_API_KEY: "", OPEN_EXCHANGE_RATES_APP_ID: "", PYTH_HERMES_API_KEY: "", PYTH_HERMES_URL: "https://hermes.pyth.network" }, stdio: "ignore" });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) return; } catch { /* waiting for local fixture */ } await new Promise(r => setTimeout(r, 300)); }
  throw new Error("Offramp test server unavailable");
});
after(async () => { if (server?.exitCode === null) { server.kill(); await new Promise(r => server.once("exit", r)); } await fixture?.stop(); });
function api(role: string, path: string, body?: unknown, method = body ? "POST" : "GET") {
  return fetch(base + path, { method, headers: { cookie: fixture.cookies[role] || "", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}

test("HTTP journey: create → accept → inspect unsigned message → finalized verify → adapter recheck, with ownership and replay guards", async () => {
  assert.equal((await api("", "/api/cashout")).status, 401);
  assert.equal((await fetch(base + "/api/cashout", { method: "POST", headers: { cookie: fixture.cookies.student, origin: "https://other.invalid" }, body: "{}" })).status, 403);
  const beneficiary = await api("student", "/api/cashout/beneficiaries", { method: "bank", bankCode: "MB", destination: "000123456789", accountHolder: "QA ONLY" });
  assert.equal(beneficiary.status, 201, await beneficiary.clone().text());
  const { beneficiary: b } = await beneficiary.json() as { beneficiary: { id: string } };
  const create = await api("student", "/api/cashout", { amountUsdc: "10", beneficiaryId: b.id, payoutMethod: "bank" });
  assert.equal(create.status, 201, await create.clone().text());
  const { session } = await create.json() as { session: { id: string; amountAtomic: string; mint: string; network: string; reference: string; settlementWallet: string; solanaPayUrl: string | null } };
  const id = session.id;
  assert.equal(session.solanaPayUrl, null);
  assert.equal((await api("outsider", `/api/cashout/${id}`)).status, 404);
  assert.equal((await api("outsider", `/api/cashout/${id}`, { action: "accept_quote", acceptedTerms: true }, "PATCH")).status, 404);
  assert.equal((await api("student", `/api/cashout/${id}`, { action: "refresh" }, "PATCH")).status, 409);
  assert.equal((await api("student", `/api/cashout/${id}`, { action: "accept_quote", acceptedTerms: true }, "PATCH")).status, 200);
  const wallet = (await fixture.db.prepare("SELECT wallet_address FROM cashout_sessions WHERE id=?").bind(id).first<{ wallet_address: string }>())!.wallet_address;
  const build = await api("student", "/api/payments/build", { cashoutId: id, senderWallet: wallet });
  assert.equal(build.status, 200, await build.clone().text());
  const built = await build.json() as { transaction: string };
  const expected = { network: session.network, mint: session.mint, amountAtomic: session.amountAtomic, recipientWallet: session.settlementWallet, reference: session.reference };
  const bytes = Uint8Array.from(Buffer.from(built.transaction, "base64"));
  await assertCashoutTransaction(bytes, wallet, expected);
  await assert.rejects(assertCashoutTransaction(bytes, wallet, { ...expected, amountAtomic: "1" }));
  await assert.rejects(assertCashoutTransaction(bytes, wallet, { ...expected, recipientWallet: key(8) }));
  await assert.rejects(assertCashoutTransaction(bytes, wallet, { ...expected, mint: key(8) }));
  await assert.rejects(assertCashoutTransaction(bytes, wallet, { ...expected, network: "solana:mainnet" }));
  const sig = bs58.encode(new Uint8Array(64).fill(9));
  assert.equal((await api("outsider", `/api/cashout/${id}/verify`, { signature: sig })).status, 404);
  const verify = await api("student", `/api/cashout/${id}/verify`, { signature: sig });
  assert.equal(verify.status, 200, await verify.clone().text());
  assert.equal(((await verify.json()) as { session: { status: string } }).session.status, "bank_processing");
  assert.equal((await api("student", "/api/payments/build", { cashoutId: id, senderWallet: wallet })).status, 409);
  for (let i = 0; i < 2; i++) {
    const refresh = await api("student", `/api/cashout/${id}`, { action: "refresh" }, "PATCH");
    assert.equal(refresh.status, 200, await refresh.clone().text());
    assert.equal(((await refresh.json()) as { session: { status: string } }).session.status, "sandbox_completed");
  }
  const order = (await fixture.db.prepare("SELECT * FROM cashout_sessions WHERE id=?").bind(id).first<CashoutRow>())!;
  const raw = JSON.stringify({ provider: order.provider, mode: "devnet_sandbox", orderId: id, providerOrderId: `sandbox:${id}`, amountVnd: order.net_vnd, currency: "VND", status: "failed" });
  const ts = String(Math.floor(Date.now() / 1000)), eventId = "http-callback-test";
  const headers = { "content-type": "application/json", "x-skillbridge-event-id": eventId, "x-skillbridge-timestamp": ts,
    "x-skillbridge-signature": sandboxSignature("fixture-secret", ts, eventId, raw) };
  const webhook = () => fetch(base + "/api/webhooks/offramp", { method: "POST", headers, body: raw });
  assert.equal((await webhook()).status, 200); assert.equal((await webhook()).status, 200);
  assert.equal((await fetch(base + "/api/webhooks/offramp", { method: "POST", headers: { ...headers, "x-skillbridge-event-id": "tampered-event" }, body: raw })).status, 401);
  assert.equal((await fixture.db.prepare("SELECT status FROM cashout_sessions WHERE id=?").bind(id).first<{ status: string }>())!.status, "sandbox_completed");
});
