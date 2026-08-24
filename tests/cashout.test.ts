import assert from "node:assert/strict";
import test from "node:test";
import bs58 from "bs58";
import { cashoutCapabilities, createCashoutReference, createDevnetCashoutQuote, payoutProviderForMethod, solanaPayCashoutUrl } from "../lib/cashout.ts";

test("Devnet cash-out quote uses atomic math, explicit fees and a fixed expiry", () => {
  const quote = createDevnetCashoutQuote({
    CASHOUT_SANDBOX_VND_RATE: "25000",
    CASHOUT_PROVIDER_FEE_BPS: "80",
    CASHOUT_NETWORK_FEE_VND: "5000",
    CASHOUT_QUOTE_TTL_SECONDS: "300",
  }, { display: "10", atomic: "10000000" }, new Date("2026-08-24T00:00:00.000Z"));
  assert.deepEqual(quote, {
    rateVnd: "25000", grossVnd: "250000", providerFeeVnd: "2000", networkFeeVnd: "5000",
    feeVnd: "7000", netVnd: "243000", expiresAt: "2026-08-24T00:05:00.000Z", rateSource: "configured_test_rate",
  });
});

test("cash-out references and Solana Pay URLs remain Devnet-transfer compatible", () => {
  const reference = createCashoutReference();
  assert.equal(bs58.decode(reference).length, 32);
  const url = solanaPayCashoutUrl({
    settlementWallet: "11111111111111111111111111111111",
    amountUsdc: "12.5",
    reference: "22222222222222222222222222222222",
    mint: "33333333333333333333333333333333",
  });
  assert.match(url, /^solana:11111111111111111111111111111111\?/);
  assert.match(url, /amount=12.5/);
  assert.match(url, /spl-token=33333333333333333333333333333333/);
  assert.match(url, /reference=22222222222222222222222222222222/);
});

test("capabilities never represent the Devnet lab as a real bank payout", async () => {
  const capabilities = await cashoutCapabilities({ CASHOUT_DEVNET_SETTLEMENT_WALLET: "11111111111111111111111111111111" });
  assert.equal(capabilities.network, "solana:devnet");
  assert.equal(capabilities.devnetTransferEnabled, true);
  assert.equal(capabilities.directSolanaPay, true);
  assert.equal(capabilities.bankPayoutMode, "sandbox_only");
  assert.equal(capabilities.realPayoutEnabled, false);
  assert.deepEqual(capabilities.methods.map((method) => method.id), ["bank", "momo", "zalopay"]);
  assert.equal(capabilities.methods.find((method) => method.id === "bank")?.payoutProvider, "payos");
});

test("receiving choices map to payout providers without exposing a real-money switch", () => {
  assert.equal(payoutProviderForMethod("bank", {}), "payos");
  assert.equal(payoutProviderForMethod("momo", {}), "momo");
  assert.equal(payoutProviderForMethod("zalopay", {}), "zalopay");
  assert.equal(payoutProviderForMethod("bank", { PAYOUT_PROVIDERS: "momo,zalopay" }), "momo");
});
