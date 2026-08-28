import assert from "node:assert/strict";
import test from "node:test";
import bs58 from "bs58";
import {
  cashoutCapabilities,
  createCashoutReference,
  createDevnetCashoutQuote,
  payoutProviderForMethod,
  solanaPayCashoutUrl,
} from "../lib/cashout.ts";
import {
  getFxReference,
  resetFxReferenceCacheForTests,
} from "../lib/fx-rates.ts";
import { parseVietQrPayload } from "../lib/bank-directory.ts";

test("Devnet cash-out quote uses atomic math, explicit fees and a fixed expiry", () => {
  const quote = createDevnetCashoutQuote(
    {
      CASHOUT_SANDBOX_VND_RATE: "25000",
      CASHOUT_PROVIDER_FEE_BPS: "80",
      CASHOUT_NETWORK_FEE_VND: "5000",
      CASHOUT_QUOTE_TTL_SECONDS: "300",
    },
    { display: "10", atomic: "10000000" },
    {
      usdcUsd: "1.0000000000",
      usdVnd: "25000.000000",
      usdcVnd: "25000.000000",
      updatedAt: "2026-08-24T00:00:00.000Z",
      freshness: "live",
      sources: [],
      deviationBps: "0",
      warning: null,
      sourceHash: "hash",
    },
    new Date("2026-08-24T00:00:00.000Z"),
  );
  assert.deepEqual(quote, {
    rateVnd: "25000",
    grossVnd: "250000",
    providerFeeVnd: "2000",
    networkFeeVnd: "5000",
    feeVnd: "7000",
    netVnd: "243000",
    expiresAt: "2026-08-24T00:05:00.000Z",
    rateSource: "market_reference",
    referenceRateVnd: "25000.000000",
    usdcUsdRate: "1.0000000000",
    usdVndRate: "25000.000000",
    referenceUpdatedAt: "2026-08-24T00:00:00.000Z",
    referenceFreshness: "live",
    sourceHash: "hash",
    spreadBps: "0",
  });
});

test("reference rate uses independent USDC and USD/VND sources and records freshness", async () => {
  resetFxReferenceCacheForTests();
  const now = Math.floor(Date.now() / 1_000);
  const fakeFetch = async (url: string | URL | Request) => {
    const value = String(url);
    if (value.includes("coingecko"))
      return Response.json({
        "usd-coin": { usd: 0.9999, last_updated_at: now },
      });
    return Response.json({
      result: "success",
      time_last_update_unix: now,
      rates: { VND: 25_500 },
    });
  };
  const reference = await getFxReference(
    { FX_CACHE_TTL_SECONDS: "1", FX_MAX_STALENESS_SECONDS: "120" },
    fakeFetch as typeof fetch,
  );
  assert.equal(reference.freshness, "live");
  assert.equal(reference.usdcUsd, "0.9999000000");
  assert.equal(reference.usdVnd, "25500.000000");
  assert.equal(reference.usdcVnd, "25497.450000");
  assert.equal(
    reference.sources.filter((source) => source.freshness === "unavailable")
      .length,
    0,
  );
});

test("VietQR parser extracts a selected bank BIN and account number without claiming owner verification", () => {
  const payload =
    "00020101021238400010A000000727011097042200000208123456785802VN6304ABCD";
  assert.deepEqual(parseVietQrPayload(payload), {
    bank: {
      code: "MB",
      bin: "970422",
      shortName: "MB Bank",
      name: "Ngân hàng TMCP Quân đội",
    },
    accountNumber: "12345678",
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
  const capabilities = await cashoutCapabilities({
    CASHOUT_DEVNET_SETTLEMENT_WALLET: "11111111111111111111111111111111",
  });
  assert.equal(capabilities.network, "solana:devnet");
  assert.equal(capabilities.devnetTransferEnabled, true);
  assert.equal(capabilities.directSolanaPay, true);
  assert.equal(capabilities.bankPayoutMode, "sandbox_only");
  assert.equal(capabilities.realPayoutEnabled, false);
  assert.deepEqual(
    capabilities.methods.map((method) => method.id),
    ["bank", "momo", "zalopay"],
  );
  assert.equal(
    capabilities.methods.find((method) => method.id === "bank")?.payoutProvider,
    "payos",
  );
});

test("receiving choices map to payout providers without exposing a real-money switch", () => {
  assert.equal(payoutProviderForMethod("bank", {}), "payos");
  assert.equal(payoutProviderForMethod("momo", {}), "momo");
  assert.equal(payoutProviderForMethod("zalopay", {}), "zalopay");
  assert.equal(
    payoutProviderForMethod("bank", { PAYOUT_PROVIDERS: "momo,zalopay" }),
    "momo",
  );
});
