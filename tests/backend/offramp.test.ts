import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import bs58 from "bs58";
import { createMemoryDatabaseForTests } from "../../backend/database/adapters/d1-adapter.ts";
import { ensureCoreSchema } from "../../backend/database/schema/core-schema.ts";
import { OFFRAMP_SCHEMA } from "../../backend/database/schema/offramp-schema.ts";
import { SandboxProvider, sandboxSignature } from "../../backend/services/cashout/providers/sandbox.ts";
import { configuredProvider, storedProvider } from "../../backend/services/cashout/providers/registry.ts";
import { payloadHash, readFundingSnapshot, fundingDisposition } from "../../backend/services/cashout/offramp-snapshot.ts";
import { ensureProviderOrder } from "../../backend/services/cashout/offramp-operations.ts";
import { applyPayoutEvent, receivePayoutEvent } from "../../backend/services/cashout/offramp-inbox.ts";
import { reconcileCashout, acceptCashoutQuote } from "../../backend/services/cashout/offramp-orchestrator.ts";
import { verifyCashoutFunding } from "../../backend/services/cashout/offramp-verification.ts";
import { serializeCashout, type CashoutRow } from "../../backend/services/cashout/cashout-record.ts";
import { cashoutCapabilities } from "../../backend/services/cashout/cashout.ts";
import { PaymentVerificationError, type verifyUsdcPayment } from "../../solana/server/payments.ts";
import type { FundingSnapshot, PayoutEvent } from "../../backend/services/cashout/providers/types.ts";

const key = (n: number) => bs58.encode(new Uint8Array(32).fill(n));
const provider = new SandboxProvider();
function snapshot(id = "order-a"): FundingSnapshot {
  return { provider: provider.id, mode: "devnet_sandbox", adapterVersion: "2", termsVersion: "sandbox-v2",
    orderId: id, providerOrderId: `sandbox:${id}`, userId: "user", wallet: key(1), beneficiaryId: "legacy", method: "bank",
    network: "solana:devnet", mint: key(2), recipient: key(3), reference: key(4), amountAtomic: "10000000",
    netVnd: "243000", currency: "VND", country: "VN", quoteId: `quote:${id}`, quoteExpiresAt: "2026-09-18T01:00:00.000Z",
    quoteCreatedAt: "2026-09-18T00:55:00.000Z", fundingDeadline: "2026-09-18T01:10:00.000Z", quoteKind: "test", calculation: null };
}
async function fixture() {
  const db = createMemoryDatabaseForTests();
  await ensureCoreSchema(db);
  await db.prepare("INSERT INTO users(id,display_name) VALUES ('user','Test')").run();
  return db;
}
async function insert(db: D1Database, id = "order-a", state = "bank_processing", legacy = false) {
  const s = snapshot(id);
  await db.prepare(`INSERT INTO cashout_sessions
    (id,user_id,wallet_address,amount_usdc,amount_atomic,estimated_vnd,fee_vnd,net_vnd,provider,payout_method,execution_mode,
     status,settlement_wallet,reference_key,quote_expires_at,quote_id,metadata_json,payment_tx,verification_state,provider_reference)
    VALUES (?,'user',?,'10',?,'250000','7000',?,?,'bank','devnet_sandbox',?,?,?,?,?,?,?,?,?)`)
    .bind(id, s.wallet, s.amountAtomic, s.netVnd, s.provider, state, s.recipient, s.reference + (id === "order-a" ? "" : "x"),
      s.quoteExpiresAt, s.quoteId, JSON.stringify(legacy ? { network: s.network, mint: s.mint } : { offramp: s, offrampHash: payloadHash(JSON.stringify(s)) }),
      state === "bank_processing" ? `tx:${id}` : null, state === "bank_processing" ? "verified" : "awaiting_signature", `SB-DEVNET-${id}`).run();
  if (id !== "order-a") {
    s.reference = key(5);
    await db.prepare("UPDATE cashout_sessions SET reference_key = ?, metadata_json = ? WHERE id = ?")
      .bind(s.reference, JSON.stringify({ offramp: s, offrampHash: payloadHash(JSON.stringify(s)) }), id).run();
  }
  return s;
}
async function row(db: D1Database, id = "order-a") { return (await db.prepare("SELECT * FROM cashout_sessions WHERE id = ?").bind(id).first<CashoutRow>())!; }
async function count(db: D1Database, table: string) { return (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n; }
async function event(id = "order-a"): Promise<PayoutEvent> { return (await provider.getOrderStatus(snapshot(id), true))!; }

test("registry fails closed for production, unknown provider and invalid corridor", async () => {
  assert.equal(configuredProvider({ OFFRAMP_PROVIDER: "devnet_sandbox" }).id, provider.id);
  for (const env of [{ OFFRAMP_PROVIDER: "circle" }, { CASHOUT_MODE: "production" }, { REAL_CASHOUT_ENABLED: "true" }, { OFFRAMP_API_KEY: "fixture" }])
    assert.throws(() => configuredProvider(env));
  assert.throws(() => storedProvider(provider.id, "production"));
  for (const patch of [{ network: "solana:mainnet" }, { country: "US" }, { currency: "USD" }, { method: "cash" }, { mint: "bad" }, { amountAtomic: "0" }])
    assert.throws(() => provider.getFundingInstructions({ ...snapshot(), ...patch } as FundingSnapshot));
  assert.equal((await cashoutCapabilities({})).devnetTransferEnabled, false);
  assert.equal(provider.getCapabilities().kyc, "not_required_for_sandbox");
});

test("snapshot survives config changes; tampering fails; legacy mint never falls back", async () => {
  const db = await fixture(); await insert(db, "order-a", "awaiting_wallet_signature");
  const order = await row(db);
  assert.equal(readFundingSnapshot(order).mint, key(2));
  assert.match(serializeCashout(order, key(9)).solanaPayUrl!, new RegExp(key(2)));
  assert.throws(() => readFundingSnapshot({ ...order, amount_atomic: "9" }));
  assert.throws(() => readFundingSnapshot({ ...order, metadata_json: "{}" }));
  const legacy = { ...order, metadata_json: JSON.stringify({ mint: key(2), network: "solana:devnet" }) };
  assert.equal(readFundingSnapshot(legacy).recipient, key(3));
  assert.equal(readFundingSnapshot(legacy).fundingDeadline, order.quote_expires_at);
});

test("amount/time exceptions are reconciliation, never an automatic refund or payout", () => {
  const s = snapshot(), onTime = Date.parse(s.quoteExpiresAt) / 1000;
  assert.equal(fundingDisposition(s, s.amountAtomic, onTime), null);
  assert.equal(fundingDisposition(s, "1", onTime), "UNDERPAYMENT");
  assert.equal(fundingDisposition(s, "10000001", onTime), "OVERPAYMENT");
  assert.equal(fundingDisposition(s, s.amountAtomic, null), "BLOCK_TIME_UNKNOWN");
  assert.equal(fundingDisposition(s, s.amountAtomic, onTime + 601), "LATE_FUNDING");
  assert.equal(fundingDisposition(s, s.amountAtomic, onTime - 601), "FUNDING_BEFORE_QUOTE");
});

test("webhook v2 binds raw body, event ID and timestamp; rejects old signatures and replay", async () => {
  const raw = JSON.stringify(await event()), ts = String(Math.floor(Date.now() / 1000)), id = "event-test-001";
  const headers = new Headers({ "x-skillbridge-event-id": id, "x-skillbridge-timestamp": ts,
    "x-skillbridge-signature": sandboxSignature("fixture-secret", ts, id, raw) });
  assert.equal((await provider.verifyAndNormalizeWebhook(raw, headers, "fixture-secret")).eventId, id);
  await assert.rejects(provider.verifyAndNormalizeWebhook(raw + " ", headers, "fixture-secret"));
  await assert.rejects(provider.verifyAndNormalizeWebhook(raw, headers, "fixture-secret", Date.now() + 600000));
  headers.set("x-skillbridge-event-id", "event-test-002");
  await assert.rejects(provider.verifyAndNormalizeWebhook(raw, headers, "fixture-secret"));
  headers.set("x-skillbridge-signature", "sha256=legacy");
  await assert.rejects(provider.verifyAndNormalizeWebhook(raw, headers, "fixture-secret"));
});

test("early callback is retained and reprocessed after order/crypto arrive", async () => {
  const db = await fixture(), e = await event();
  assert.equal((await receivePayoutEvent(db, e)).processed, false);
  await insert(db);
  await reconcileCashout(db, "order-a");
  assert.equal((await row(db)).status, "sandbox_completed");
  assert.equal((await receivePayoutEvent(db, e)).reused, true);
  assert.equal(await count(db, "cashout_events"), 1);
  assert.equal(await count(db, "audit_events"), 1);
});

test("duplicate/conflicting/concurrent callbacks cannot double apply or regress state", async () => {
  const db = await fixture(); await insert(db); const e = await event();
  await Promise.all([receivePayoutEvent(db, e), receivePayoutEvent(db, e)]);
  await receivePayoutEvent(db, e);
  await assert.rejects(receivePayoutEvent(db, { ...e, amountVnd: "1" }));
  await receivePayoutEvent(db, { ...e, eventId: "late-failure", status: "failed" });
  assert.equal((await row(db)).status, "sandbox_completed");
  assert.equal(await count(db, "cashout_events"), 1);
  assert.equal(await count(db, "audit_events"), 1);
});

test("crash after inbox insert/before apply and DB batch rollback resume safely", async () => {
  const db = await fixture(); await insert(db); const e = await event();
  const batch = db.batch.bind(db);
  db.batch = async () => { throw new Error("fixture database unavailable"); };
  await assert.rejects(receivePayoutEvent(db, e));
  assert.equal((await row(db)).status, "bank_processing");
  db.batch = batch;
  await receivePayoutEvent(db, e);
  assert.equal((await row(db)).status, "sandbox_completed");
  assert.equal(await count(db, "cashout_events"), 1);
});

test("expired inbox lease resumes; wrong amount/provider order cannot change the order", async () => {
  const db = await fixture(); await insert(db); const e = await event();
  await assert.rejects(receivePayoutEvent(db, { ...e, amountVnd: "1" }));
  assert.equal((await row(db)).status, "bank_processing");
  const identity = `${e.provider}:${e.mode}:recover-event`;
  await db.prepare(`INSERT INTO offramp_inbox(identity,provider,mode,event_id,order_id,payload_hash,event_json,status,lease_token,lease_until)
    VALUES (?,?,?,'recover-event',?,?,?,'processing','dead-instance',1)`)
    .bind(identity, e.provider, e.mode, e.orderId, payloadHash(JSON.stringify(e)), JSON.stringify(e)).run();
  assert.equal((await applyPayoutEvent(db, identity)).processed, true);
});

test("payout failure preserves finalized crypto and recheck does not silently retry payout", async () => {
  const db = await fixture(); await insert(db);
  await receivePayoutEvent(db, { ...await event(), status: "failed", bankReference: undefined });
  const failed = await row(db);
  assert.equal(failed.status, "payout_failed"); assert.equal(failed.payment_tx, "tx:order-a");
  assert.equal(failed.verification_state, "verified");
  await reconcileCashout(db, "order-a");
  assert.equal((await row(db)).status, "payout_failed");
});

test("outbox freezes intent before call and retries ambiguous external success with SAME key", async () => {
  const db = await fixture(), s = await insert(db);
  let calls = 0;
  const fake = new SandboxProvider();
  fake.createOrder = async (input, key) => {
    assert.equal(await count(db, "offramp_operations"), 1);
    assert.equal(key, "create:order-a"); calls++;
    if (calls === 1) throw new Error("response lost after provider accepted");
    return { providerOrderId: input.providerOrderId };
  };
  await assert.rejects(ensureProviderOrder(db, s, fake));
  await ensureProviderOrder(db, s, fake); await ensureProviderOrder(db, s, fake);
  assert.equal(calls, 2); assert.equal(await count(db, "offramp_operations"), 1);
  await assert.rejects(ensureProviderOrder(db, { ...s, netVnd: "1" }, fake));
});

const verified: typeof verifyUsdcPayment = async (input) => ({ signature: input.signature, senderWallet: key(1), recipientWallet: key(3),
  amountAtomic: input.expectedAtomic, observedAt: "2026-09-18T01:00:00.000Z", blockTime: Date.parse("2026-09-18T01:00:00Z") / 1000,
  referenceMatched: true, confirmationStatus: "finalized" });

test("two orders cannot claim same signature and repeated verification keeps one audit", async () => {
  const db = await fixture(); await insert(db, "order-a", "awaiting_wallet_signature"); await insert(db, "order-b", "awaiting_wallet_signature");
  const results = await Promise.allSettled([verifyCashoutFunding(db, await row(db), "sig", "automatic", undefined, verified),
    verifyCashoutFunding(db, await row(db, "order-b"), "sig", "automatic", undefined, verified)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await count(db, "offramp_signature_claims"), 1);
  assert.equal(await count(db, "audit_events"), 1);
});

test("pending RPC survives reload; partial deposit is retained without payout", async () => {
  const db = await fixture(); await insert(db, "order-a", "awaiting_wallet_signature");
  await assert.rejects(verifyCashoutFunding(db, await row(db), "sig", "automatic", undefined, async () => {
    throw new PaymentVerificationError("NOT_FINALIZED", "pending", 202, true);
  }));
  assert.equal((await row(db)).submitted_tx, "sig");
  await verifyCashoutFunding(db, await row(db), "sig", "manual", undefined, async input => ({ ...await verified(input), amountAtomic: "1" }));
  assert.equal((await row(db)).status, "reconciliation_required");
  assert.equal((await row(db)).payment_tx, "sig");
  await reconcileCashout(db, "order-a");
  assert.equal((await row(db)).status, "reconciliation_required");
  assert.equal(serializeCashout(await row(db), key(9)).solanaPayUrl, null);
});

test("migration is additive, repeatable, synchronized with runtime, and preserves legacy order", async () => {
  const db = await fixture(); await insert(db, "order-a", "bank_processing", true);
  const before = await row(db);
  const sql = readFileSync(new URL("../../backend/database/migrations/0021_offramp_journals.sql", import.meta.url), "utf8");
  assert.equal(sql.replace(/\s/g, ""), (OFFRAMP_SCHEMA.join(";\n") + ";").replace(/\s/g, ""));
  await db.exec(sql); await db.exec(sql);
  assert.deepEqual(await row(db), before);
  await reconcileCashout(db, before.id);
  assert.equal((await row(db)).status, "sandbox_completed");
});

test("concurrent accept retries create one transition and audit", async () => {
  const db = await fixture(), s = await insert(db, "order-a", "quote_ready");
  s.quoteExpiresAt = new Date(Date.now() + 60000).toISOString();
  s.fundingDeadline = new Date(Date.now() + 660000).toISOString();
  await db.prepare("UPDATE cashout_sessions SET quote_expires_at=?,metadata_json=? WHERE id=?")
    .bind(s.quoteExpiresAt, JSON.stringify({ offramp: s, offrampHash: payloadHash(JSON.stringify(s)) }), s.orderId).run();
  const original = await row(db);
  await Promise.allSettled([acceptCashoutQuote(db, original), acceptCashoutQuote(db, original)]);
  await acceptCashoutQuote(db, original);
  assert.equal((await row(db)).status, "awaiting_wallet_signature");
  assert.equal(await count(db, "cashout_events"), 1); assert.equal(await count(db, "audit_events"), 1);
});

test("legacy pending signature cannot be replaced or stranded by a conflicting verification", async () => {
  const db = await fixture(); await insert(db, "order-a", "onchain_pending");
  await db.prepare("UPDATE cashout_sessions SET submitted_tx='original' WHERE id='order-a'").run();
  await assert.rejects(verifyCashoutFunding(db, await row(db), "different", "manual", undefined, verified));
  assert.equal(await count(db, "offramp_signature_claims"), 0);
  await verifyCashoutFunding(db, await row(db), "original", "manual", undefined, verified);
  assert.equal((await row(db)).payment_tx, "original");
});

test("expired outbox worker is fenced when a newer worker takes the lease", async () => {
  const db = await fixture(), s = await insert(db);
  const fake = new SandboxProvider();
  fake.createOrder = async input => {
    await db.prepare("UPDATE offramp_operations SET lease_token='new-worker',lease_until=? WHERE operation_key=?")
      .bind(Date.now() + 30000, `create:${s.orderId}`).run();
    return { providerOrderId: input.providerOrderId };
  };
  await assert.rejects(ensureProviderOrder(db, s, fake));
  const operation = await db.prepare("SELECT status,lease_token FROM offramp_operations").first<{ status: string; lease_token: string }>();
  assert.equal(operation?.lease_token, "new-worker"); assert.equal(operation?.status, "processing");
});
