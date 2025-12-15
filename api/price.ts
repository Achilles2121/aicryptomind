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
    const assetParam =
      (typeof req.query?.asset === "string"
        ? req.query?.asset
        : Array.isArray(req.query?.asset)
        ? req.query?.asset[0]
        : undefined) || undefined;
    const symbolParam =
      (typeof req.query?.symbol === "string"
        ? req.query?.symbol
        : Array.isArray(req.query?.symbol)
        ? req.query?.symbol[0]
        : undefined) || undefined;
    const market = assetParam ? findMarketById(assetParam) : undefined;
    if (assetParam && !market) {
      return sendEnvelope(
        res,
        fail("invalid_request", {
          source: "price",
          statusCode: 400,
          message: "Unknown asset id",
          hint: "Unknown asset id",
        })
      );
    }
    const resolvedMarket = market ?? getMarketById(assetParam || DEFAULT_MARKET_ID);
    requestedAssetId = resolvedMarket.id;
    const symbol =
      (symbolParam ||
        findProviderSymbol(resolvedMarket, "binance") ||
        findProviderSymbol(resolvedMarket, resolvedMarket.defaultProvider) ||
        "BTCUSDT")?.toUpperCase();
    requestedSymbol = symbol;

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

    const isFx = resolvedMarket.assetClass === "fx";
    const isMetal = resolvedMarket.assetClass === "commodity" || /^XA(U|G)/i.test(resolvedMarket.base || symbol);
    const key = cacheKey("price", assetParam ? resolvedMarket.id : symbol);
    const cached = cache.get<unknown>(key) as any;
    if (cached) {
      return sendEnvelope(
        res,
        ok(cached, {
          source: "price",
          statusCode: 200,
          cached: true,
        })
      );
    }

    const isCrypto = resolvedMarket.assetClass === "crypto";
    let data: any;
    let errors: ReturnType<typeof normalizeError>[] = [];
    try {
      if (isCrypto) {
        // Simple BTC/USD first, then legacy providers
        if (requestedSymbol.startsWith("BTC")) {
          const btc = await fetchBtcUsd();
          data = { source: btc.source, symbol: "BTCUSD", price: btc.price, timestamp: btc.timestamp };
        } else {
          const result = await resolvePrice(symbol);
          data = result.data;
          errors = result.errors;
        }
      } else if (isFx) {
        const fxRes = await fetchFxFromExchangeRateHost(resolvedMarket.base || symbol.slice(0, 3), resolvedMarket.quote || symbol.slice(3));
        data = { source: fxRes.provider, symbol: `${fxRes.base}${fxRes.quote}`, price: fxRes.price, timestamp: fxRes.timestamp };
      } else if (isMetal) {
        const metalRes = await fetchMetalFromMetalsDev(resolvedMarket.base || symbol);
        data = { source: metalRes.provider, symbol: metalRes.symbol, price: metalRes.price, timestamp: metalRes.timestamp };
      } else {
        const result = await fetchMarketPrice(resolvedMarket);
        data = result.data;
        errors = result.errors;
      }
    } catch (err: any) {
      const primary = normalizeError(resolvedMarket.assetClass || "price", err);
      const fallback = {
        value: generateFallbackPrice(requestedSymbol || "BTCUSDT"),
        change24h: null,
        source: "fallback",
        symbol: requestedAssetId || "BTCUSDT",
        updatedAt: new Date().toISOString(),
      };
      return sendEnvelope(
        res,
        fail("error", {
          source: "price",
          statusCode: 500,
          message: primary.message || "Price fetch failed",
          hint: primary.hint || "fallback_served",
          errors: [primary.message],
          data: fallback,
        }) as ApiEnvelope
      );
    }
    const payload = {
      value: data.price,
      change24h: null,
      source: data.source,
      symbol: assetParam ? resolvedMarket.id : data.symbol,
      updatedAt: new Date(data.timestamp).toISOString(),
    };
    cache.set(key, payload);
    return sendEnvelope(
      res,
      ok(payload, {
        source: "price",
        statusCode: 200,
        cached: false,
        errors: errors?.map((e) => e.message),
      }) as ApiEnvelope
    );
  } catch (error) {
    console.error("[price] handler error", {
      message: (error as any)?.message,
      stack: (error as any)?.stack,
      asset: requestedAssetId,
      symbol: requestedSymbol,
    });
    const errors: ReturnType<typeof normalizeError>[] = (error as any)?.errors || [];
    const primary = errors[0] ?? normalizeError("price", error);
    const statusCode = primary.statusCode || 502;
    const fallback = {
      value: generateFallbackPrice(requestedSymbol || "BTCUSDT"),
      change24h: null,
      source: "fallback",
      symbol: requestedAssetId || "BTCUSDT",
      updatedAt: new Date().toISOString(),
    };
    return sendEnvelope(
      res,
      fail(statusCode === 503 ? "disabled" : "degraded", {
        source: "price",
        statusCode,
        message: primary.message || "Price feed unavailable",
        hint: primary.hint || "Serving synthetic fallback price",
        errors: errors?.map((e) => e.message),
        data: fallback,
      }) as ApiEnvelope
    );
  }
}
