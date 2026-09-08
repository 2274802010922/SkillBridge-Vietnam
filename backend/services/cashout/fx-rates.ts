export const PYTH_USDC_USD_FEED_ID =
  "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

export type FxEnvironment = {
  CASHOUT_SANDBOX_VND_RATE?: string;
  FX_CACHE_TTL_SECONDS?: string;
  FX_MAX_STALENESS_SECONDS?: string;
  FX_MAX_DEVIATION_BPS?: string;
  PYTH_HERMES_URL?: string;
  PYTH_HERMES_API_KEY?: string;
  PYTH_USDC_USD_FEED_ID?: string;
  EXCHANGE_RATE_API_KEY?: string;
  OPEN_EXCHANGE_RATES_APP_ID?: string;
};

export type FxRateSource = {
  provider: string;
  pair: "USDC/USD" | "USD/VND";
  rate: string;
  updatedAt: string;
  freshness: "live" | "delayed" | "fallback" | "unavailable";
  confidence?: string | null;
  message?: string | null;
};

export type FxReference = {
  usdcUsd: string;
  usdVnd: string;
  usdcVnd: string;
  updatedAt: string;
  freshness: "live" | "delayed" | "fallback";
  sources: FxRateSource[];
  deviationBps: string;
  warning: string | null;
  sourceHash: string;
};

type FetchLike = typeof fetch;
let cached: { expiresAt: number; value: FxReference } | null = null;

async function snapshotHash(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function decimal(value: unknown, digits = 8) {
  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric.toFixed(digits);
}

function pythDecimal(value: unknown, exponent: unknown, digits = 10) {
  const mantissa = Number(value);
  const expo = Number(exponent);
  if (!Number.isFinite(mantissa) || !Number.isFinite(expo)) return null;
  return decimal(mantissa * 10 ** expo, digits);
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function fromUnix(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1_000).toISOString()
    : new Date().toISOString();
}

function freshnessFor(
  updatedAt: string,
  maximumAgeSeconds: number,
): FxRateSource["freshness"] {
  const age = Date.now() - new Date(updatedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return "delayed";
  return age <= maximumAgeSeconds * 1_000 ? "live" : "delayed";
}

async function fetchJson(
  fetcher: FetchLike,
  url: string,
  headers?: HeadersInit,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetcher(url, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPyth(
  environment: FxEnvironment,
  fetcher: FetchLike,
  maxAge: number,
): Promise<FxRateSource | null> {
  const apiKey = environment.PYTH_HERMES_API_KEY?.trim();
  if (!apiKey) return null;
  const base = (
    environment.PYTH_HERMES_URL || "https://hermes.pyth.network"
  ).replace(/\/$/, "");
  const id = environment.PYTH_USDC_USD_FEED_ID || PYTH_USDC_USD_FEED_ID;
  try {
    const data = await fetchJson(
      fetcher,
      `${base}/v2/updates/price/latest?ids%5B%5D=${encodeURIComponent(id)}&encoding=hex`,
      { authorization: `Bearer ${apiKey}` },
    );
    const parsed = Array.isArray(data.parsed)
      ? (data.parsed[0] as Record<string, unknown>)
      : null;
    const price = parsed?.price as Record<string, unknown> | undefined;
    const rate = pythDecimal(price?.price, price?.expo, 10);
    if (!rate) throw new Error("Pyth price is missing");
    const updatedAt = fromUnix(price?.publish_time);
    return {
      provider: "pyth_hermes",
      pair: "USDC/USD",
      rate,
      updatedAt,
      freshness: freshnessFor(updatedAt, maxAge),
      confidence: pythDecimal(price?.conf, price?.expo, 10),
    };
  } catch (error) {
    return {
      provider: "pyth_hermes",
      pair: "USDC/USD",
      rate: "",
      updatedAt: new Date().toISOString(),
      freshness: "unavailable",
      message: error instanceof Error ? error.message : "Pyth unavailable",
    };
  }
}

async function fetchCoinGecko(
  fetcher: FetchLike,
  maxAge: number,
): Promise<FxRateSource> {
  try {
    const data = await fetchJson(
      fetcher,
      "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd&include_last_updated_at=true",
    );
    const coin = data["usd-coin"] as Record<string, unknown> | undefined;
    const rate = decimal(coin?.usd, 10);
    if (!rate) throw new Error("CoinGecko price is missing");
    const updatedAt = fromUnix(coin?.last_updated_at);
    return {
      provider: "coingecko",
      pair: "USDC/USD",
      rate,
      updatedAt,
      freshness: freshnessFor(updatedAt, maxAge),
    };
  } catch (error) {
    return {
      provider: "coingecko",
      pair: "USDC/USD",
      rate: "",
      updatedAt: new Date().toISOString(),
      freshness: "unavailable",
      message: error instanceof Error ? error.message : "CoinGecko unavailable",
    };
  }
}

async function fetchExchangeRateApi(
  environment: FxEnvironment,
  fetcher: FetchLike,
  maxAge: number,
): Promise<FxRateSource> {
  try {
    const key = environment.EXCHANGE_RATE_API_KEY?.trim();
    const url = key
      ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD`
      : "https://open.er-api.com/v6/latest/USD";
    const data = await fetchJson(fetcher, url);
    const rates = data.conversion_rates || data.rates;
    const rate = decimal(
      (rates as Record<string, unknown> | undefined)?.VND,
      6,
    );
    if (!rate) throw new Error("USD/VND is missing");
    const updatedAt = fromUnix(
      data.time_last_update_unix ?? data.time_last_updated,
    );
    return {
      provider: key ? "exchangerate_api" : "exchangerate_api_public",
      pair: "USD/VND",
      rate,
      updatedAt,
      freshness: freshnessFor(updatedAt, maxAge),
    };
  } catch (error) {
    return {
      provider: "exchangerate_api",
      pair: "USD/VND",
      rate: "",
      updatedAt: new Date().toISOString(),
      freshness: "unavailable",
      message: error instanceof Error ? error.message : "FX API unavailable",
    };
  }
}

async function fetchOpenExchangeRates(
  environment: FxEnvironment,
  fetcher: FetchLike,
  maxAge: number,
): Promise<FxRateSource | null> {
  const appId = environment.OPEN_EXCHANGE_RATES_APP_ID?.trim();
  if (!appId) return null;
  try {
    const data = await fetchJson(
      fetcher,
      `https://openexchangerates.org/api/latest.json?app_id=${encodeURIComponent(appId)}&symbols=VND&prettyprint=0`,
    );
    const rate = decimal(
      (data.rates as Record<string, unknown> | undefined)?.VND,
      6,
    );
    if (!rate) throw new Error("USD/VND is missing");
    const updatedAt = fromUnix(data.timestamp);
    return {
      provider: "open_exchange_rates",
      pair: "USD/VND",
      rate,
      updatedAt,
      freshness: freshnessFor(updatedAt, maxAge),
    };
  } catch (error) {
    return {
      provider: "open_exchange_rates",
      pair: "USD/VND",
      rate: "",
      updatedAt: new Date().toISOString(),
      freshness: "unavailable",
      message: error instanceof Error ? error.message : "OXR unavailable",
    };
  }
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function spreadBps(values: number[]) {
  if (values.length < 2) return 0;
  const middle = median(values);
  if (!Number.isFinite(middle) || middle <= 0) return 0;
  return Math.round(
    ((Math.max(...values) - Math.min(...values)) / middle) * 10_000,
  );
}

/**
 * Fetches reference prices only. It never represents a market observation as
 * an executable off-ramp quote.
 */
export async function getFxReference(
  environment: FxEnvironment,
  fetcher: FetchLike = fetch,
): Promise<FxReference> {
  const cacheTtl =
    positiveInteger(environment.FX_CACHE_TTL_SECONDS, 20, 300) * 1_000;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const maxAge = positiveInteger(
    environment.FX_MAX_STALENESS_SECONDS,
    300,
    172_800,
  );
  const [coinGecko, exchangeRate, pyth, oxr] = await Promise.all([
    fetchCoinGecko(fetcher, maxAge),
    fetchExchangeRateApi(environment, fetcher, maxAge),
    fetchPyth(environment, fetcher, maxAge),
    fetchOpenExchangeRates(environment, fetcher, maxAge),
  ]);
  const sources = [
    coinGecko,
    exchangeRate,
    ...(pyth ? [pyth] : []),
    ...(oxr ? [oxr] : []),
  ];
  const usdcSources = sources.filter(
    (source) =>
      source.pair === "USDC/USD" &&
      source.freshness === "live" &&
      Number(source.rate) > 0,
  );
  const vndSources = sources.filter(
    (source) =>
      source.pair === "USD/VND" &&
      source.freshness === "live" &&
      Number(source.rate) > 0,
  );
  const fallback = positiveInteger(
    environment.CASHOUT_SANDBOX_VND_RATE,
    25_000,
    1_000_000,
  );
  const usdcUsd = usdcSources.length
    ? median(usdcSources.map((source) => Number(source.rate)))
    : 1;
  const usdVnd = vndSources.length
    ? median(vndSources.map((source) => Number(source.rate)))
    : fallback;
  const deviation = spreadBps(vndSources.map((source) => Number(source.rate)));
  const maxDeviation = positiveInteger(
    environment.FX_MAX_DEVIATION_BPS,
    100,
    10_000,
  );
  const freshness: FxReference["freshness"] =
    !usdcSources.length || !vndSources.length
      ? "fallback"
      : [...usdcSources, ...vndSources].every(
            (source) => source.freshness === "live",
          )
        ? "live"
        : "delayed";
  const updatedAt =
    [...usdcSources, ...vndSources]
      .map((source) => source.updatedAt)
      .sort()
      .at(-1) || new Date().toISOString();
  if (freshness === "fallback") {
    sources.push({
      provider: "skillbridge_sandbox",
      pair: "USD/VND",
      rate: String(fallback),
      updatedAt,
      freshness: "fallback",
      message: "A configured sandbox fallback is in use.",
    });
  }
  const value = {
    usdcUsd: usdcUsd.toFixed(10),
    usdVnd: usdVnd.toFixed(6),
    usdcVnd: (usdcUsd * usdVnd).toFixed(6),
    updatedAt,
    freshness,
    sources,
    deviationBps: String(deviation),
    warning:
      deviation > maxDeviation
        ? `USD/VND sources diverge by ${deviation} bps.`
        : null,
    sourceHash: await snapshotHash(
      JSON.stringify({
        usdcUsd,
        usdVnd,
        deviation,
        sources: sources.map((source) => [
          source.provider,
          source.rate,
          source.updatedAt,
          source.freshness,
        ]),
      }),
    ),
  } satisfies FxReference;
  cached = { expiresAt: Date.now() + cacheTtl, value };
  return value;
}

export function resetFxReferenceCacheForTests() {
  cached = null;
}
