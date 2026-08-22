import assert from "node:assert/strict";
import test from "node:test";
import { formatSolAtomic, formatUsdcAtomic, parseSolAmount, parseUsdcAmount, verifySolPayment, verifyUsdcPayment } from "../lib/payments.ts";
import { solanaPayRewardUrl } from "../lib/reward-vault.ts";

test("USDC amounts are normalized to six decimal atomic units", () => {
  assert.deepEqual(parseUsdcAmount("12.5"), { display: "12.5", atomic: "12500000" });
  assert.deepEqual(parseUsdcAmount("0.000001"), { display: "0.000001", atomic: "1" });
  assert.equal(parseUsdcAmount("0"), null);
  assert.equal(parseUsdcAmount("1.1234567"), null);
  assert.equal(formatUsdcAtomic("12500000"), "12.5");
});

test("SOL funding amounts and Solana Pay vault URLs retain Devnet precision", () => {
  assert.deepEqual(parseSolAmount("0.05"), { display: "0.05", atomic: "50000000" });
  assert.equal(formatSolAtomic("50000000"), "0.05");
  assert.equal(parseSolAmount("0.0000000001"), null);
  const url = solanaPayRewardUrl({ recipientWallet: "11111111111111111111111111111111", amount: "0.05", asset: "sol", reference: "22222222222222222222222222222222" });
  assert.match(url, /^solana:11111111111111111111111111111111\?/);
  assert.match(url, /amount=0.05/);
  assert.match(url, /reference=22222222222222222222222222222222/);
  assert.doesNotMatch(url, /spl-token/);
});

test("payment verification matches a confirmed USDC balance delta", async () => {
  const reference = "22222222222222222222222222222222";
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ result: {
    blockTime: 1_700_000_000,
    meta: {
      err: null,
      preTokenBalances: [{ accountIndex: 1, mint: "mint", owner: "11111111111111111111111111111112", uiTokenAmount: { amount: "750000" } }, { accountIndex: 2, mint: "mint", owner: "11111111111111111111111111111111", uiTokenAmount: { amount: "1000000" } }],
      postTokenBalances: [{ accountIndex: 1, mint: "mint", owner: "11111111111111111111111111111112", uiTokenAmount: { amount: "0" } }, { accountIndex: 2, mint: "mint", owner: "11111111111111111111111111111111", uiTokenAmount: { amount: "2250000" } }],
    },
    transaction: { message: { accountKeys: [{ pubkey: reference }] } },
  } }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const result = await verifyUsdcPayment({ signature: "11111111111111111111111111111111", recipientWallet: "11111111111111111111111111111111", expectedAtomic: "1000000", mint: "mint", rpcUrl: "https://example.invalid", expectedReference: reference });
    assert.equal(result.amountAtomic, "1250000");
    assert.equal(result.senderWallet, "11111111111111111111111111111112");
    assert.equal(result.blockTime, 1_700_000_000);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("SOL payment verification checks the vault balance delta and reference", async () => {
  const reference = "22222222222222222222222222222222";
  const recipient = "11111111111111111111111111111111";
  const sender = "11111111111111111111111111111112";
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ result: {
    blockTime: 1_700_000_001,
    meta: { err: null, preBalances: [1_000_000_000, 0, 0], postBalances: [940_000_000, 50_000_000, 0] },
    transaction: { message: { accountKeys: [{ pubkey: sender }, { pubkey: recipient }, { pubkey: reference }] } },
  } }), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const result = await verifySolPayment({ signature: "11111111111111111111111111111111", recipientWallet: recipient, expectedAtomic: "50000000", rpcUrl: "https://example.invalid", expectedReference: reference });
    assert.equal(result.amountAtomic, "50000000");
    assert.equal(result.senderWallet, sender);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
