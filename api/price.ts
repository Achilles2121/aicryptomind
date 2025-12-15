import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { isRateLimited } from "./utils/rateLimit";
import { DEFAULT_MARKET_ID, findMarketById, getMarketById, type MarketConfig } from "../src/config/markets";
import { getActiveProviders, type MarketDataProviderConfig } from "../src/config/dataSources";
import { fetchOhlcFromProvider } from "../src/services/providers/openProviders";
import { ok, fail, sendEnvelope } from "./utils/apiEnvelope.js";
import type { ApiEnvelope } from "./utils/response";

// If this endpoint returns a Vercel Authentication HTML page in production, disable deployment protection/auth. See docs/vercel-auth.md.

type Req = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  method?: string;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
};

const symbolToId: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
  BTCUSD: "bitcoin",
};

const normalizeProviderId = (id?: string) => (id || "").toLowerCase();
const findProviderSymbol = (market: MarketConfig, providerId: string) =>
  Object.entries(market.providerSymbols || {}).find(([key]) => normalizeProviderId(key) === normalizeProviderId(providerId))?.[1];
const getActiveProviderById = (providerId?: string): MarketDataProviderConfig | undefined => {
  if (!providerId) return undefined;
  return getActiveProviders().find((p) => normalizeProviderId(p.id) === normalizeProviderId(providerId));
};

const isAbortError = (error: unknown) => {
  const message = (error as Error)?.message?.toLowerCase?.() || "";
  return (error as Error)?.name === "AbortError" || message.includes("abort") || message.includes("timeout");
};

const normalizeError = (source: string, error: unknown) => {
  const message = (error as Error)?.message || "Provider failed";
  const statusCode = isAbortError(error) ? 504 : 502;
  return {
    source,
    message,
    statusCode,
    hint: statusCode === 504 ? "Upstream timeout/abort detected" : "Upstream provider unavailable",
  };
};

const now = () => Date.now();

const generateFallbackPrice = (symbol: string) => {
  const base = symbol.includes("ETH") ? 3500 : 60000;
  const variance = Math.sin(now() / 60000) * (symbol.includes("ETH") ? 30 : 120);
  return Number((base + variance).toFixed(2));
};

type FxPrice = { base: string; quote: string; price: number; provider: string; timestamp: number };
type MetalPrice = { symbol: string; price: number; provider: string; timestamp: number };

// --- Simple helpers for robustness ---
const fetchBtcUsd = async (): Promise<{ price: number; source: string; timestamp: number }> => {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
  const data = await safeFetchJson<Record<string, { usd: number }>>(url, undefined, { timeoutMs: 4500, attempts: 1 });
  const price = Number(data?.bitcoin?.usd);
  if (!Number.isFinite(price)) throw new Error("CoinGecko BTC price missing");
  return { price, source: "coingecko", timestamp: now() };
};

// Use open.er-api.com (free, no API key required)
const fetchFxFromOpenExchangeRate = async (base: string, quote: string): Promise<FxPrice> => {
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`;
  const res = await safeFetchJson<{ result?: string; rates?: Record<string, number> }>(url, undefined, { timeoutMs: 4000, attempts: 1 });
  if (res?.result !== "success" || !res?.rates) throw new Error("OpenExchangeRate API failed");
  const rate = Number(res.rates[quote.toUpperCase()]);
  if (!Number.isFinite(rate)) throw new Error(`OpenExchangeRate missing rate for ${quote}`);
  return { base, quote, price: rate, provider: "open.er-api.com", timestamp: now() };
};

// Legacy fallback (requires API key now)
const fetchFxFromExchangeRateHost = async (base: string, quote: string): Promise<FxPrice> => {
  const url = `https://api.exchangerate.host/convert?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
  const res = await safeFetchJson<{ result?: number; info?: { rate?: number } }>(url, undefined, { timeoutMs: 4000, attempts: 1 });
  const rate = Number(res?.result ?? res?.info?.rate);
  if (!Number.isFinite(rate)) throw new Error("ExchangeRateHost missing rate");
  return { base, quote, price: rate, provider: "exchangerate.host", timestamp: now() };
};

const fetchMetalFromMetalsDev = async (symbol: string): Promise<MetalPrice> => {
  const key = process.env.METALS_DEV_KEY || process.env.METALS_API_KEY || process.env.METALPRICEAPI_KEY || process.env.GOLDAPI_KEY;
  if (!key) throw new Error("Metal API key missing");
  const url = process.env.METALS_DEV_KEY
    ? `https://api.metals.dev/v1/latest?api_key=${process.env.METALS_DEV_KEY}&symbols=${symbol}`
    : process.env.METALS_API_KEY
    ? `https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY}&base=USD&symbols=${symbol}`
    : process.env.METALPRICEAPI_KEY
    ? `https://api.metalpriceapi.com/v1/latest?api_key=${process.env.METALPRICEAPI_KEY}&base=USD&currencies=${symbol}`
    : `https://www.goldapi.io/api/${symbol}/USD`;

  const res = await safeFetchJson<any>(url, process.env.GOLDAPI_KEY ? { headers: { "x-access-token": process.env.GOLDAPI_KEY } } : undefined, {
    timeoutMs: 4500,
    attempts: 1,
  });
  const rate =
    res?.data?.[symbol]?.price ??
    res?.rates?.[symbol] ??
    res?.price ??
    res?.[symbol] ??
    res?.[`${symbol}USD`] ??
    res?.[symbol.toLowerCase()];
  const price = Number(rate);
  if (!Number.isFinite(price)) throw new Error("Metal price missing");
  return { symbol, price, provider: "metals", timestamp: now() };
};


// Legacy provider fallbacks (kept for other markets)
async function fetchBinance(symbol: string) {
  const pair = symbol.replace("/", "").toUpperCase();
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`;
  const data = await safeFetchJson<{ price: string }>(url, undefined, {
    timeoutMs: 2500,
    attempts: 2,
  });
  return {
    source: "binance" as const,
    symbol: pair,
    price: Number(data.price),
    timestamp: now(),
  };
}

async function fetchKraken(symbol: string) {
  const pair = symbol.replace("/", "").toUpperCase();
  const mapped = pair === "BTCUSDT" ? "XBTUSDT" : pair;
  const url = `https://api.kraken.com/0/public/Ticker?pair=${mapped}`;
  const data = await safeFetchJson<{
    result: Record<string, { c: [string] }>;
  }>(url, undefined, { timeoutMs: 3000, attempts: 2 });
  const first = Object.values(data.result ?? {})[0];
  const price = first?.c?.[0];
  if (!price) throw new Error("No price from Kraken");
  return {
    source: "kraken" as const,
    symbol: pair,
    price: Number(price),
    timestamp: now(),
  };
}

async function fetchCoinGecko(symbol: string) {
  const id = symbolToId[symbol.replace("/", "").toUpperCase()] ?? "bitcoin";
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
  const data = await safeFetchJson<Record<string, { usd: number }>>(url, undefined, {
    timeoutMs: 3000,
    attempts: 2,
  });
  const entry = data[id];
  if (!entry) throw new Error("No CoinGecko price");
  return {
    source: "coingecko" as const,
    symbol: symbol.replace("/", "").toUpperCase(),
    price: Number(entry.usd),
    timestamp: now(),
  };
}

async function resolvePrice(symbol: string) {
  const providers = [fetchBinance, fetchKraken, fetchCoinGecko];
  const errors: ReturnType<typeof normalizeError>[] = [];
  for (const provider of providers) {
    try {
      const data = await provider(symbol);
      return { data, errors };
    } catch (error) {
      errors.push(normalizeError(provider.name || "price", error));
    }
  }
  const aggregate = new Error("All providers failed");
  (aggregate as any).errors = errors;
  throw aggregate;
}

const buildProviderPriority = (market: MarketConfig) =>
  Array.from(new Set([market.defaultProvider, ...Object.keys(market.providerSymbols || {})]));

async function fetchMarketPrice(market: MarketConfig) {
  const providerIds = buildProviderPriority(market);
  const errors: ReturnType<typeof normalizeError>[] = [];
  for (const providerId of providerIds) {
    const provider = getActiveProviderById(providerId);
    const symbol = provider ? findProviderSymbol(market, provider.id) : undefined;
    if (!provider || !symbol) continue;
    const interval = market.supportsIntraday === false ? 1440 : 60;
    try {
      const rows = await fetchOhlcFromProvider(provider, { symbol, interval, limit: 2 });
      const last = rows?.at?.(-1);
      if (last) {
        return {
          data: {
            source: provider.id,
            symbol: market.id,
            price: Number(last.c ?? last.close ?? last.o ?? 0),
            timestamp: Date.now(),
          },
          errors,
        };
      }
    } catch (error) {
      errors.push(normalizeError(provider.id, error));
    }
  }
  const aggregate = new Error("All providers failed");
  (aggregate as any).errors = errors;
  throw aggregate;
}

export default async function handler(req: Req, res: Res) {
  let requestedAssetId = DEFAULT_MARKET_ID;
  let requestedSymbol = "BTCUSDT";
  try {
    const assetParamRaw =
      (typeof req.query?.asset === "string"
        ? req.query?.asset
        : Array.isArray(req.query?.asset)
        ? req.query?.asset[0]
        : undefined) || undefined;
    const assetParam = assetParamRaw?.toUpperCase?.();

    const symbolParam =
      (typeof req.query?.symbol === "string"
        ? req.query?.symbol
        : Array.isArray(req.query?.symbol)
        ? req.query?.symbol[0]
        : undefined) || undefined;

    const supportedAssets = ["BTCUSD", "BTCUSDT", "EURUSD", "XAUUSD"];
    if (!assetParam || !supportedAssets.includes(assetParam)) {
      return sendEnvelope(
        res,
        fail("invalid_request", {
          source: "price",
          statusCode: 400,
          message: "Invalid or missing asset. Supported: BTCUSD, BTCUSDT, EURUSD, XAUUSD",
          hint: "BAD_REQUEST",
        })
      );
    }

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`price:${rateKey}`)) {
      return sendEnvelope(
        res,
        fail("degraded", {
          source: "price",
          statusCode: 429,
          message: "rate limited",
          hint: "Slow down requests",
        })
      );
    }

    requestedSymbol = assetParam;

    // Fast-path for required assets
    if (assetParam.startsWith("BTC")) {
      try {
        const btc = await fetchBtcUsd();
        const payload = { asset: "BTCUSD", value: btc.price, ts: btc.timestamp, source: btc.source };
        return sendEnvelope(res, ok(payload, { source: "price", statusCode: 200 }) as ApiEnvelope);
      } catch (err: any) {
        console.error("[price] btc fetch error", err);
        return sendEnvelope(
          res,
          fail("error", {
            source: "price",
            statusCode: 500,
            message: err?.message || "BTC price fetch failed",
            hint: "INTERNAL_ERROR",
          }) as ApiEnvelope
        );
      }
    }

    if (assetParam === "EURUSD") {
      try {
        // Try free open.er-api.com first
        let fx: FxPrice;
        try {
          fx = await fetchFxFromOpenExchangeRate("EUR", "USD");
        } catch {
          // Fallback to exchangerate.host (may require API key)
          fx = await fetchFxFromExchangeRateHost("EUR", "USD");
        }
        if (!Number.isFinite(fx.price)) throw new Error("Invalid FX price");
        const payload = { asset: "EURUSD", value: fx.price, ts: fx.timestamp, source: fx.provider };
        return sendEnvelope(res, ok(payload, { source: "price", statusCode: 200 }) as ApiEnvelope);
      } catch (err: any) {
        console.error("[price] fx fetch error", err);
        return sendEnvelope(
          res,
          fail("error", {
            source: "price",
            statusCode: 502,
            message: err?.message || "FX price fetch failed",
            hint: "All FX providers unavailable",
          }) as ApiEnvelope
        );
      }
    }

    if (assetParam === "XAUUSD") {
      try {
        if (!process.env.METALS_DEV_KEY && !process.env.METALS_API_KEY && !process.env.METALPRICEAPI_KEY && !process.env.GOLDAPI_KEY) {
          return sendEnvelope(
            res,
            fail("error", {
              source: "price",
              statusCode: 500,
              message: "Missing metals API key",
              hint: "Set METALS_API_KEY or METALS_DEV_KEY or METALPRICEAPI_KEY",
            }) as ApiEnvelope
          );
        }
        const metal = await fetchMetalFromMetalsDev("XAU");
        if (!Number.isFinite(metal.price)) throw new Error("Invalid metal price");
        const payload = { asset: "XAUUSD", value: metal.price, ts: metal.timestamp, source: metal.provider };
        return sendEnvelope(res, ok(payload, { source: "price", statusCode: 200 }) as ApiEnvelope);
      } catch (err: any) {
        console.error("[price] metal fetch error", err);
        return sendEnvelope(
          res,
          fail("error", {
            source: "price",
            statusCode: 500,
            message: err?.message || "Metal price fetch failed",
            hint: "INTERNAL_ERROR",
          }) as ApiEnvelope
        );
      }
    }

    // Fallback to legacy market config for other assets (kept for compatibility)
    const market = assetParam ? findMarketById(assetParam) : undefined;
    const resolvedMarket = market ?? getMarketById(assetParam || DEFAULT_MARKET_ID);
    requestedAssetId = resolvedMarket.id;
    const symbol =
      (symbolParam ||
        findProviderSymbol(resolvedMarket, "binance") ||
        findProviderSymbol(resolvedMarket, resolvedMarket.defaultProvider) ||
        assetParam ||
        "BTCUSDT")?.toUpperCase();
    const isCrypto = resolvedMarket.assetClass === "crypto";
    let data: any;
    let errors: ReturnType<typeof normalizeError>[] = [];
    if (isCrypto) {
      const result = await resolvePrice(symbol);
      data = result.data;
      errors = result.errors;
    } else {
      const result = await fetchMarketPrice(resolvedMarket);
      data = result.data;
      errors = result.errors;
    }
    const payload = {
      asset: assetParam,
      value: data.price,
      source: data.source,
      ts: data.timestamp,
    };
    return sendEnvelope(res, ok(payload, { source: "price", errors: errors?.map((e) => e.message) }) as ApiEnvelope);
  } catch (error) {
    console.error("[price] handler error", error);
    return sendEnvelope(
      res,
      fail("error", {
        source: "price",
        statusCode: 500,
        message: (error as any)?.message || "Internal error",
        hint: "INTERNAL_ERROR",
      }) as ApiEnvelope
    );
  }
}
