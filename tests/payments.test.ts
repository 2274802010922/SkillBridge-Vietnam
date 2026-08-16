import assert from "node:assert/strict";
import test from "node:test";
import { formatUsdcAtomic, parseUsdcAmount, verifyUsdcPayment } from "../lib/payments.ts";

test("USDC amounts are normalized to six decimal atomic units", () => {
  assert.deepEqual(parseUsdcAmount("12.5"), { display: "12.5", atomic: "12500000" });
  assert.deepEqual(parseUsdcAmount("0.000001"), { display: "0.000001", atomic: "1" });
  assert.equal(parseUsdcAmount("0"), null);
  assert.equal(parseUsdcAmount("1.1234567"), null);
  assert.equal(formatUsdcAtomic("12500000"), "12.5");
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
