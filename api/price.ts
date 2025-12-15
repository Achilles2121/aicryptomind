import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { isRateLimited } from "./utils/rateLimit";
import { DEFAULT_MARKET_ID, findMarketById, getMarketById, type MarketConfig } from "../src/config/markets";
import { getActiveProviders, type MarketDataProviderConfig } from "../src/config/dataSources";
import { fetchOhlcFromProvider } from "../src/services/providers/openProviders";
import { ok, fail, okEnvelope, failEnvelope, sendEnvelope, ApiStatus } from "./utils/apiEnvelope.js";
import type { ApiEnvelope } from "./utils/response";

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

// --- FX helpers ---
const fetchFxFromFreeForex = async (base: string, quote: string): Promise<FxPrice> => {
  const pair = `${base}${quote}`.toUpperCase();
  const url = `https://freeforexapi.com/api/live?pairs=${pair}`;
  const res = await safeFetchJson<{ rates?: Record<string, { rate: number; timestamp: number }> }>(url, undefined, {
    timeoutMs: 2500,
    attempts: 1,
  });
  const entry = res?.rates?.[pair];
  if (!entry || !Number.isFinite(entry.rate)) throw new Error("FreeForex missing rate");
  return { base, quote, price: Number(entry.rate), provider: "freeforexapi", timestamp: (entry.timestamp || now()) * 1000 };
};

const fetchFxFromExchangeRateHost = async (base: string, quote: string): Promise<FxPrice> => {
  const url = `https://api.exchangerate.host/convert?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
  const res = await safeFetchJson<{ result?: number; info?: { rate?: number } }>(url, undefined, { timeoutMs: 3000, attempts: 1 });
  const rate = Number(res?.result ?? res?.info?.rate);
  if (!Number.isFinite(rate)) throw new Error("ExchangeRateHost missing rate");
  return { base, quote, price: rate, provider: "exchangerate.host", timestamp: now() };
};

const fetchFxFromAlphaVantage = async (base: string, quote: string): Promise<FxPrice> => {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) throw new Error("AlphaVantage key missing");
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${encodeURIComponent(
    base
  )}&to_currency=${encodeURIComponent(quote)}&apikey=${key}`;
  const res = await safeFetchJson<{ "Realtime Currency Exchange Rate"?: Record<string, string> }>(url, undefined, {
    timeoutMs: 3500,
    attempts: 1,
  });
  const rateStr = res?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"];
  const rate = Number(rateStr);
  if (!Number.isFinite(rate)) throw new Error("AlphaVantage missing rate");
  return { base, quote, price: rate, provider: "alphavantage", timestamp: now() };
};

const fetchFxFromFinnhub = async (base: string, quote: string): Promise<FxPrice> => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("Finnhub key missing");
  const symbol = `${base}${quote}`.toUpperCase();
  const url = `https://finnhub.io/api/v1/forex/rate?from=${base.toUpperCase()}&to=${quote.toUpperCase()}&token=${key}`;
  const res = await safeFetchJson<{ price?: number }>(url, undefined, { timeoutMs: 3500, attempts: 1 });
  const rate = Number(res?.price);
  if (!Number.isFinite(rate)) throw new Error("Finnhub missing rate");
  return { base, quote, price: rate, provider: "finnhub", timestamp: now() };
};

async function fetchFxRate(base: string, quote: string): Promise<{ data: FxPrice; errors: ReturnType<typeof normalizeError>[] }> {
  const errors: ReturnType<typeof normalizeError>[] = [];
  const attempts: Array<() => Promise<FxPrice>> = [() => fetchFxFromFreeForex(base, quote), () => fetchFxFromExchangeRateHost(base, quote)];
  if (process.env.ALPHAVANTAGE_API_KEY) attempts.push(() => fetchFxFromAlphaVantage(base, quote));
  if (process.env.FINNHUB_API_KEY) attempts.push(() => fetchFxFromFinnhub(base, quote));
  for (const attempt of attempts) {
    try {
      const data = await attempt();
      return { data, errors };
    } catch (err) {
      errors.push(normalizeError(attempt.name || "fx", err));
    }
  }
  const aggregate = new Error("All FX providers failed");
  (aggregate as any).errors = errors;
  throw aggregate;
}

// --- Metal helpers ---
const fetchMetalFromMetalsApi = async (symbol: string): Promise<MetalPrice> => {
  const key = process.env.METALS_API_KEY;
  if (!key) throw new Error("METALS_API_KEY missing");
  const url = `https://metals-api.com/api/latest?access_key=${key}&base=USD&symbols=${symbol}`;
  const res = await safeFetchJson<{ rates?: Record<string, number> }>(url, undefined, { timeoutMs: 3500, attempts: 1 });
  const rate = res?.rates?.[symbol];
  if (!Number.isFinite(rate)) throw new Error("Metals-API missing rate");
  return { symbol, price: Number(rate), provider: "metals-api", timestamp: now() };
};

const fetchMetalFromMetalpriceapi = async (symbol: string): Promise<MetalPrice> => {
  const key = process.env.METALPRICEAPI_KEY;
  if (!key) throw new Error("METALPRICEAPI_KEY missing");
  const url = `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=USD&currencies=${symbol}`;
  const res = await safeFetchJson<{ rates?: Record<string, number> }>(url, undefined, { timeoutMs: 3500, attempts: 1 });
  const rate = res?.rates?.[symbol];
  if (!Number.isFinite(rate)) throw new Error("Metalpriceapi missing rate");
  return { symbol, price: Number(rate), provider: "metalpriceapi", timestamp: now() };
};

const fetchMetalFromGoldApi = async (symbol: string): Promise<MetalPrice> => {
  const key = process.env.GOLDAPI_KEY;
  if (!key) throw new Error("GOLDAPI_KEY missing");
  const url = `https://www.goldapi.io/api/${symbol}/USD`;
  const res = await safeFetchJson<{ price?: number }>(url, { headers: { "x-access-token": key } }, { timeoutMs: 3500, attempts: 1 });
  const rate = res?.price;
  if (!Number.isFinite(rate)) throw new Error("GoldAPI missing rate");
  return { symbol, price: Number(rate), provider: "goldapi", timestamp: now() };
};

const fetchMetalFromMetalsDev = async (symbol: string): Promise<MetalPrice> => {
  const key = process.env.METALS_DEV_KEY;
  if (!key) throw new Error("METALS_DEV_KEY missing");
  const url = `https://api.metals.dev/v1/latest?api_key=${key}&symbols=${symbol}`;
  const res = await safeFetchJson<{ data?: Record<string, { price?: number }> }>(url, undefined, { timeoutMs: 3500, attempts: 1 });
  const rate = res?.data?.[symbol]?.price;
  if (!Number.isFinite(rate)) throw new Error("metals.dev missing rate");
  return { symbol, price: Number(rate), provider: "metals.dev", timestamp: now() };
};

async function fetchMetalPrice(symbol: string): Promise<{ data: MetalPrice; errors: ReturnType<typeof normalizeError>[] }> {
  const sym = symbol.toUpperCase();
  const errors: ReturnType<typeof normalizeError>[] = [];
  const attempts: Array<() => Promise<MetalPrice>> = [];
  if (process.env.METALS_API_KEY) attempts.push(() => fetchMetalFromMetalsApi(sym));
  if (process.env.METALPRICEAPI_KEY) attempts.push(() => fetchMetalFromMetalpriceapi(sym));
  if (process.env.GOLDAPI_KEY) attempts.push(() => fetchMetalFromGoldApi(sym));
  if (process.env.METALS_DEV_KEY) attempts.push(() => fetchMetalFromMetalsDev(sym));
  for (const attempt of attempts) {
    try {
      const data = await attempt();
      return { data, errors };
    } catch (err) {
      errors.push(normalizeError(attempt.name || "metal", err));
    }
  }
  const aggregate = new Error("All metal providers failed");
  (aggregate as any).errors = errors;
  throw aggregate;
}

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
    if (isCrypto) {
      const result = await resolvePrice(symbol);
      data = result.data;
      errors = result.errors;
    } else if (isFx) {
      const fxRes = await fetchFxRate(resolvedMarket.base || symbol.slice(0, 3), resolvedMarket.quote || symbol.slice(3));
      data = { source: fxRes.data.provider, symbol: `${fxRes.data.base}${fxRes.data.quote}`, price: fxRes.data.price, timestamp: fxRes.data.timestamp };
      errors = fxRes.errors;
    } else if (isMetal) {
      const metalRes = await fetchMetalPrice(resolvedMarket.base || symbol);
      data = { source: metalRes.data.provider, symbol: metalRes.data.symbol, price: metalRes.data.price, timestamp: metalRes.data.timestamp };
      errors = metalRes.errors;
    } else {
      const result = await fetchMarketPrice(resolvedMarket);
      data = result.data;
      errors = result.errors;
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
