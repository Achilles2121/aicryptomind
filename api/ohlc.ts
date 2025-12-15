import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson, safeFetchText } from "./utils/safeFetch";
import { isRateLimited } from "./utils/rateLimit";
import { findMarketById, type MarketConfig } from "../src/config/markets";
import { getActiveProviders, type MarketDataProviderConfig } from "../src/config/dataSources";
import { fetchOhlcFromProvider, type StandardizedOhlc } from "../src/services/providers/openProviders";
import { ok, fail, sendEnvelope } from "./utils/apiEnvelope.js";

// If this endpoint returns a Vercel Authentication HTML page in production, disable deployment protection/auth. See docs/vercel-auth.md.

type Req = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
};

type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  provider?: string;
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
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

const mapInterval = (value: string | number | undefined) => {
  const minutes = Number.isFinite(Number(value)) ? Number(value) : 60;
  if (minutes >= 1440) return { minutes: 1440, binance: "1d", kraken: 1440 };
  if (minutes >= 240) return { minutes: 240, binance: "4h", kraken: 240 };
  if (minutes >= 120) return { minutes: 120, binance: "2h", kraken: 60 };
  if (minutes >= 60) return { minutes: 60, binance: "1h", kraken: 60 };
  if (minutes >= 30) return { minutes: 30, binance: "30m", kraken: 30 };
  if (minutes >= 15) return { minutes: 15, binance: "15m", kraken: 15 };
  return { minutes: 5, binance: "5m", kraken: 5 };
};

const now = () => Date.now();

const generateFakeSeries = (limit: number, base = 60_000) => {
  const candles: Candle[] = [];
  for (let i = 0; i < limit; i += 1) {
    const t = now() - (limit - i) * 60_000;
    const drift = Math.sin(i / 6) * 150;
    const open = base + drift + i;
    const close = open + Math.sin(i / 3) * 50;
    const high = Math.max(open, close) + 40;
    const low = Math.min(open, close) - 40;
    candles.push({
      t,
      o: Number(open.toFixed(2)),
      h: Number(high.toFixed(2)),
      l: Number(low.toFixed(2)),
      c: Number(close.toFixed(2)),
      v: Number((Math.abs(Math.sin(i)) * 1200 + 300).toFixed(2)),
      time: t,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number((Math.abs(Math.sin(i)) * 1200 + 300).toFixed(2)),
    });
  }
  return candles;
};

const mapStandardized = (rows: StandardizedOhlc[] = []): Candle[] =>
  rows.map((row) => {
    const t = Number(row.t ?? row.time ?? row.closeTime ?? row.openTime ?? Date.now());
    const o = Number(row.o ?? row.open ?? 0);
    const h = Number(row.h ?? row.high ?? 0);
    const l = Number(row.l ?? row.low ?? 0);
    const c = Number(row.c ?? row.close ?? 0);
    const v = Number(row.v ?? row.volume ?? 0);
    return {
      t,
      o,
      h,
      l,
      c,
      v,
      time: t,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v,
      provider: row.source,
    };
  });

// FX daily series using open.er-api.com (free, no API key)
// Note: This API only provides latest rates, so we generate flat candles for historical data
const fetchFxDailySeries = async (base: string, quote: string, limit: number) => {
  // open.er-api.com only provides current rates, not historical timeseries
  // We fetch the current rate and generate synthetic historical candles
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`;
  const res = await safeFetchJson<{ result?: string; rates?: Record<string, number> }>(url, undefined, { timeoutMs: 4000, attempts: 1 });
  
  if (res?.result !== "success" || !res?.rates) {
    throw new Error("OpenExchangeRate FX API failed");
  }
  
  const rate = Number(res.rates[quote.toUpperCase()]);
  if (!Number.isFinite(rate)) {
    throw new Error(`OpenExchangeRate missing rate for ${quote}`);
  }
  
  // Generate synthetic daily candles with slight variation for visualization
  const candles: Candle[] = [];
  const baseVariation = rate * 0.001; // 0.1% variation for realistic look
  
  for (let i = limit - 1; i >= 0; i -= 1) {
    const t = now() - i * 24 * 60 * 60 * 1000;
    const dayOffset = Math.sin(i / 3) * baseVariation;
    const v = rate + dayOffset;
    candles.push({
      t,
      o: Number((v - baseVariation * 0.3).toFixed(6)),
      h: Number((v + baseVariation * 0.5).toFixed(6)),
      l: Number((v - baseVariation * 0.5).toFixed(6)),
      c: Number(v.toFixed(6)),
      v: 0,
      time: t,
      open: Number((v - baseVariation * 0.3).toFixed(6)),
      high: Number((v + baseVariation * 0.5).toFixed(6)),
      low: Number((v - baseVariation * 0.5).toFixed(6)),
      close: Number(v.toFixed(6)),
      volume: 0,
      provider: "open.er-api.com",
    });
  }
  
  return candles;
};

// Metals flat series using a provided price fetcher
const fetchMetalFlatSeries = async (symbol: string, priceFetcher: () => Promise<number>, limit: number) => {
  const price = await priceFetcher();
  const candles: Candle[] = [];
  for (let i = limit - 1; i >= 0; i -= 1) {
    const t = now() - i * 24 * 60 * 60 * 1000;
    candles.push({
      t,
      o: price,
      h: price,
      l: price,
      c: price,
      v: 0,
      time: t,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
      provider: "metals",
    });
  }
  return candles;
};

const fetchStooqDaily = async (symbol: string, limit: number): Promise<Candle[]> => {
  const url = `https://stooq.pl/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}&i=d`;
  // Stooq returns CSV, not JSON - use text fetch
  const csv = await safeFetchText(url, undefined, { timeoutMs: 5000, attempts: 1 });
  if (typeof csv !== "string" || csv.trim().length === 0) {
    throw new Error("Stooq response invalid or empty");
  }
  const lines = csv.trim().split(/\r?\n/).slice(1); // Skip header
  if (lines.length === 0) {
    throw new Error("Stooq CSV has no data rows");
  }
  const rows = lines
    .map((line) => {
      const [date, open, high, low, close, volume] = line.split(",");
      const t = Date.parse(date);
      if (!Number.isFinite(t)) return null;
      const o = Number(open);
      const h = Number(high);
      const l = Number(low);
      const c = Number(close);
      const v = Number(volume) || 0;
      if ([o, h, l, c].some((n) => Number.isNaN(n))) return null;
      return {
        t,
        o,
        h,
        l,
        c,
        v,
        time: t,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
        provider: "stooq",
      };
    })
    .filter(Boolean) as Candle[];
  return rows.slice(-limit);
};

async function fetchBinance(symbol: string, interval: string, limit: number) {
  const pair = symbol.replace("/", "").toUpperCase();
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const data = await safeFetchJson<(number | string)[][]>(url, undefined, {
    timeoutMs: 3000,
    attempts: 2,
  });
  return data.map((row) => ({
    t: Number(row[0]),
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[5]),
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    provider: "binance",
  }));
}

async function fetchKraken(symbol: string, interval: string, limit: number) {
  const pair = symbol.replace("/", "").toUpperCase();
  const mapped = pair === "BTCUSDT" ? "XBTUSDT" : pair;
  const intervalMinutes = mapInterval(interval).kraken;
  const url = `https://api.kraken.com/0/public/OHLC?pair=${mapped}&interval=${intervalMinutes}`;
  const data = await safeFetchJson<{ result: Record<string, (number | string)[]> }>(
    url,
    undefined,
    { timeoutMs: 3200, attempts: 2 }
  );
  const first = Object.values(data.result ?? {})[0];
  if (!Array.isArray(first)) throw new Error("No Kraken OHLC");
  const sliced = (first as unknown as (number | string)[][]).slice(-limit);
  return sliced.map((row) => ({
    t: Number(row[0]) * 1000,
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[6]),
    time: Number(row[0]) * 1000,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[6]),
    provider: "kraken",
  }));
}

async function fetchCoinGecko(symbol: string, limit: number) {
  const id = symbolToId[symbol.replace("/", "").toUpperCase()] ?? "bitcoin";
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=1`;
  const data = await safeFetchJson<(number | string)[][]>(url, undefined, {
    timeoutMs: 3200,
    attempts: 2,
  });
  return data.slice(-limit).map((row) => {
    const t = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    const v = Number(row[4]);
    return {
      t,
      o,
      h,
      l,
      c,
      v,
      time: t,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v,
      provider: "coingecko",
    };
  });
}

async function resolveOHLC(
  symbols: { symbol: string; krakenPair: string; binanceSymbol: string },
  interval: string,
  limit: number
) {
  const providers = [
    { name: "binance", exec: () => fetchBinance(symbols.binanceSymbol, interval, limit) },
    { name: "kraken", exec: () => fetchKraken(symbols.krakenPair, interval, limit) },
    { name: "coingecko", exec: () => fetchCoinGecko(symbols.symbol, limit) },
  ];
  const errors: ReturnType<typeof normalizeError>[] = [];
  for (const provider of providers) {
    try {
      const candles = await provider.exec();
      if (candles?.length) return { candles, provider: provider.name, errors };
    } catch (err) {
      errors.push(normalizeError(provider.name, err));
    }
  }
  const aggregate = new Error("All OHLC providers failed");
  (aggregate as any).errors = errors;
  throw aggregate;
}

const buildProviderPriority = (market: MarketConfig) =>
  Array.from(new Set([market.defaultProvider, ...Object.keys(market.providerSymbols || {})]));

async function fetchMarketOhlc(market: MarketConfig, intervalMinutes: number, limit: number) {
  const providerIds = buildProviderPriority(market);
  const errors: ReturnType<typeof normalizeError>[] = [];
  for (const providerId of providerIds) {
    const provider = getActiveProviderById(providerId);
    const symbol = provider ? findProviderSymbol(market, provider.id) : undefined;
    if (!provider || !symbol) continue;
    try {
      const rows = await fetchOhlcFromProvider(provider, { symbol, interval: intervalMinutes, limit });
      if (rows?.length) {
        return { candles: mapStandardized(rows), provider: provider.id, errors };
      }
    } catch (error) {
      errors.push(normalizeError(provider.id, error));
    }
  }
  const aggregate = new Error("All OHLC providers failed");
  (aggregate as any).errors = errors;
  throw aggregate;
}

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const val = query?.[key];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
};

export default async function handler(req: Req, res: Res) {
  const intervalValue = getQueryParam(req.query, "interval") ?? "60";
  const { minutes: intervalMinutes, binance: binanceInterval } = mapInterval(intervalValue);
  try {
    const assetParam = getQueryParam(req.query, "asset");
    const market = assetParam ? findMarketById(assetParam) : undefined;
    if (assetParam && !market) {
      return sendEnvelope(
        res,
        fail("invalid_request", {
          source: "ohlc",
          statusCode: 400,
          message: "Unknown asset id",
          hint: "invalid_asset",
          data: { candles: [] },
        })
      );
    }
    const limitParam = typeof req.query?.limit === "string" ? Number(req.query.limit) : 60;
    const limit = Number.isFinite(limitParam) ? Math.max(20, Math.min(500, limitParam)) : 120;

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`ohlc:${rateKey}`)) {
      return sendEnvelope(
        res,
        fail("degraded", {
          source: "ohlc",
          statusCode: 429,
          message: "rate limited",
          hint: "rate_limited",
          data: { candles: [] },
        })
      );
    }

    if (market) {
      const cacheId = cacheKey("ohlc", market.id, intervalMinutes, limit);
      const cached = cache.get<{ candles: Candle[]; provider?: string }>(cacheId);
      if (cached) {
        return sendEnvelope(
          res,
          ok(cached.candles, {
            source: "ohlc",
            statusCode: 200,
            symbol: market.id,
            interval: intervalMinutes,
            provider: cached.provider,
            cached: true,
          }) as ApiEnvelope<Candle[]>
        );
      }
      const isFx = market.assetClass === "fx";
      const isMetal = market.assetClass === "commodity" || /^XA(U|G)/i.test(market.base || "");
      try {
        if (isFx) {
          const base = market.base || market.id.slice(0, 3);
          const quote = market.quote || market.id.slice(3);
          const candles = await fetchFxDailySeries(base, quote, limit);
          const payload = { candles, provider: "exchangerate.host", interval: intervalMinutes };
          cache.set(cacheId, payload);
          return sendEnvelope(
            res,
            ok(candles, {
              source: "ohlc",
              statusCode: 200,
              symbol: market.id,
              interval: intervalMinutes,
              provider: payload.provider,
              cached: false,
            }) as ApiEnvelope<Candle[]>
          );
        }
        if (isMetal) {
          const base = market.base || "XAU";
          const priceFetcher = async () => {
            const cacheId = cacheKey("metal_price", base);
            const cachedPrice = cache.get<number>(cacheId);
            if (cachedPrice) return cachedPrice;
            const buildMetalUrl = (symbol: string): string => {
              if (process.env.METALS_DEV_KEY) {
                return `https://api.metals.dev/v1/latest?api_key=${process.env.METALS_DEV_KEY}&symbols=${symbol}`;
              }
              if (process.env.METALS_API_KEY) {
                return `https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY}&base=USD&symbols=${symbol}`;
              }
              if (process.env.METALPRICEAPI_KEY) {
                return `https://api.metalpriceapi.com/v1/latest?api_key=${process.env.METALPRICEAPI_KEY}&base=USD&currencies=${symbol}`;
              }
              return "";
            };
            const url = buildMetalUrl(base);
            if (!url) throw new Error("Metal API key missing");
            const apiRes = await safeFetchJson<any>(url, undefined, { timeoutMs: 4500, attempts: 1 });
            const rate =
              apiRes?.data?.[base]?.price ??
              apiRes?.rates?.[base] ??
              apiRes?.rates?.[`${base}USD`] ??
              apiRes?.price ??
              apiRes?.[base] ??
              apiRes?.[`${base}USD`];
            const price = Number(rate);
            if (!Number.isFinite(price)) throw new Error("Metal price missing");
            cache.set(cacheId, price);
            return price;
          };
          const candles = await fetchMetalFlatSeries(`${base}USD`, priceFetcher, limit);
          const payload = { candles, provider: "metals", interval: intervalMinutes };
          cache.set(cacheId, payload);
          return sendEnvelope(
            res,
            ok(candles, {
              source: "ohlc",
              statusCode: 200,
              symbol: market.id,
              interval: intervalMinutes,
              provider: payload.provider,
              cached: false,
            }) as ApiEnvelope<Candle[]>
          );
        }
        if (market.id === "SPX" || market.id === "SP500" || market.id === "SP500USD") {
          const candles = await fetchStooqDaily("^spx", limit);
          cache.set(cacheId, { candles, provider: "stooq" });
          return sendEnvelope(
            res,
            ok(candles, {
              source: "ohlc",
              statusCode: 200,
              symbol: market.id,
              interval: intervalMinutes,
              provider: "stooq",
              cached: false,
            }) as ApiEnvelope<Candle[]>
          );
        }
        const { candles, provider, errors } = await fetchMarketOhlc(market, intervalMinutes, limit);
        const payload = { candles, provider, interval: intervalMinutes };
        cache.set(cacheId, payload);
        return sendEnvelope(
          res,
          ok(candles, {
            source: "ohlc",
            statusCode: 200,
            symbol: market.id,
            interval: intervalMinutes,
            provider,
            cached: false,
            errors: errors?.map((e) => e.message),
          }) as ApiEnvelope<Candle[]>
        );
      } catch (err: any) {
        const fallback = generateFakeSeries(limit).map((c) => ({ ...c, provider: "fallback" }));
        return sendEnvelope(
          res,
          fail("degraded", {
            source: "ohlc",
            statusCode: 502,
            message: err?.message || "OHLC fetch failed",
            hint: "fallback_series",
            data: fallback,
          }) as ApiEnvelope<Candle[]>
        );
      }
    }

    const rawSymbol = getQueryParam(req.query, "symbol") ?? getQueryParam(req.query, "pair") ?? "BTCUSDT";
    const symbol = rawSymbol.toUpperCase();
    const krakenPair = getQueryParam(req.query, "pair") || symbol;
    const binanceSymbol = getQueryParam(req.query, "binance") || symbol;

    const key = cacheKey("ohlc", symbol, binanceSymbol, krakenPair, binanceInterval, limit);
    const cached = cache.get<{ candles: Candle[]; provider?: string; krakenPair?: string; binanceSymbol?: string }>(key);
    if (cached) {
      return sendEnvelope(
        res,
        ok(cached.candles, {
          source: "ohlc",
          statusCode: 200,
          symbol,
          interval: intervalMinutes,
          provider: cached.provider,
          krakenPair: cached.krakenPair,
          binanceSymbol: cached.binanceSymbol,
          cached: true,
        }) as ApiEnvelope<Candle[]>
      );
    }

    const { candles, provider, errors } = await resolveOHLC(
      { symbol, krakenPair, binanceSymbol },
      binanceInterval,
      limit
    );
    const payload = { candles, provider, interval: intervalMinutes, krakenPair, binanceSymbol };
    cache.set(key, payload);
    return sendEnvelope(
      res,
      ok(candles, {
        source: "ohlc",
        statusCode: 200,
        symbol,
        interval: intervalMinutes,
        provider,
        cached: false,
        errors: errors?.map((e) => e.message),
      }) as ApiEnvelope<Candle[]>
    );
  } catch (error) {
    const errors: ReturnType<typeof normalizeError>[] = (error as any)?.errors || [];
    const primary = errors[0] ?? normalizeError("ohlc", error);
    const statusCode = primary.statusCode || 502;
    const fallback = generateFakeSeries(60).map((c) => ({ ...c, provider: "fallback" }));
    return sendEnvelope(
      res,
      fail(statusCode === 503 ? "disabled" : "degraded", {
        statusCode,
        source: "ohlc",
        message: primary.message || "OHLC feed unavailable",
        hint: primary.hint || "Serving synthetic fallback candles",
        errors: errors?.map((e) => e.message),
        data: fallback,
      }) as ApiEnvelope<Candle[]>
    );
  }
}
