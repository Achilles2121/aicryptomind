import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { isRateLimited } from "./utils/rateLimit";
import { DEFAULT_MARKET_ID, findMarketById, getMarketById, type MarketConfig } from "../src/config/markets";
import { getActiveProviders, type MarketDataProviderConfig } from "../src/config/dataSources";
import { fetchOhlcFromProvider, type StandardizedOhlc } from "../src/services/providers/openProviders";
import { ok, fail, okEnvelope, failEnvelope, sendEnvelope, ApiStatus } from "./utils/apiEnvelope.js";

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

// FX daily series (close-only, turned into flat OHLC)
const fetchFxDailySeries = async (base: string, quote: string, limit: number) => {
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(limit, 30) * 24 * 60 * 60 * 1000);
  const url = `https://api.exchangerate.host/timeseries?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(
    quote
  )}&start_date=${start.toISOString().slice(0, 10)}&end_date=${end.toISOString().slice(0, 10)}`;
  const res = await safeFetchJson<{ rates?: Record<string, Record<string, number>> }>(url, undefined, { timeoutMs: 4000, attempts: 1 });
  const entries = Object.entries(res?.rates || {}).sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
  if (!entries.length) throw new Error("ExchangeRateHost FX empty");
  return entries
    .slice(-limit)
    .map(([date, quotes]) => {
      const v = Number(quotes?.[quote]);
      if (!Number.isFinite(v)) return null;
      const t = Date.parse(date);
      return {
        t,
        o: v,
        h: v,
        l: v,
        c: v,
        v: 0,
        time: t,
        open: v,
        high: v,
        low: v,
        close: v,
        volume: 0,
        provider: "exchangerate.host",
      };
    })
    .filter(Boolean) as Candle[];
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

export default async function handler(req: Req, res: Res) {
  const intervalValue =
    (typeof req.query?.interval === "string" ? req.query?.interval : undefined) ?? "60";
  const { minutes: intervalMinutes, binance: binanceInterval } = mapInterval(intervalValue);
  try {
    const assetParam =
      (typeof req.query?.asset === "string"
        ? req.query?.asset
        : Array.isArray(req.query?.asset)
        ? req.query?.asset[0]
        : undefined) || undefined;
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
      if (isFx) {
        try {
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
        } catch (err: any) {
          const fallback = generateFakeSeries(limit).map((c) => ({ ...c, provider: "fallback" }));
          return sendEnvelope(
            res,
            fail("degraded", {
              source: "ohlc",
              statusCode: 502,
              message: err?.message || "FX OHLC unavailable",
              hint: "fx_fallback",
              data: fallback,
            }) as ApiEnvelope<Candle[]>
          );
        }
      }
      if (isMetal) {
        try {
          const base = market.base || "XAU";
          const priceFetcher = async () => {
            const key = cacheKey("metal_price", base);
            const cachedPrice = cache.get<number>(key);
            if (cachedPrice) return cachedPrice;
            const fetchers: Array<() => Promise<number>> = [];
            if (process.env.METALS_API_KEY) {
              fetchers.push(async () => {
                const url = `https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY}&base=USD&symbols=${base}USD`;
                const res = await safeFetchJson<{ rates?: Record<string, number> }>(url, undefined, { timeoutMs: 3500, attempts: 1 });
                const rate = res?.rates?.[`${base}USD`] ?? res?.rates?.[base];
                if (!Number.isFinite(rate)) throw new Error("metals-api price missing");
                return Number(rate);
              });
            }
            if (process.env.METALPRICEAPI_KEY) {
              fetchers.push(async () => {
                const url = `https://api.metalpriceapi.com/v1/latest?api_key=${process.env.METALPRICEAPI_KEY}&base=USD&currencies=${base}USD`;
                const res = await safeFetchJson<{ rates?: Record<string, number> }>(url, undefined, { timeoutMs: 3500, attempts: 1 });
                const rate = res?.rates?.[`${base}USD`] ?? res?.rates?.[base];
                if (!Number.isFinite(rate)) throw new Error("metalpriceapi price missing");
                return Number(rate);
              });
            }
            for (const fn of fetchers) {
              try {
                const price = await fn();
                cache.set(key, price);
                return price;
              } catch {
                // continue
              }
            }
            throw new Error("No metal price");
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
        } catch (err: any) {
          const fallback = generateFakeSeries(limit).map((c) => ({ ...c, provider: "fallback" }));
          return sendEnvelope(
            res,
            fail("degraded", {
              source: "ohlc",
              statusCode: 502,
              message: err?.message || "Metal OHLC unavailable",
              hint: "metal_fallback",
              data: fallback,
            }) as ApiEnvelope<Candle[]>
          );
        }
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
    }
    }

    const rawSymbol =
      (typeof req.query?.symbol === "string"
        ? req.query?.symbol
        : Array.isArray(req.query?.symbol)
        ? req.query?.symbol[0]
        : undefined) ??
      (typeof req.query?.pair === "string"
        ? req.query?.pair
        : Array.isArray(req.query?.pair)
        ? req.query?.pair[0]
        : undefined) ??
      "BTCUSDT";
    const symbol = rawSymbol.toUpperCase();
    const krakenPair =
      (typeof req.query?.pair === "string"
        ? req.query?.pair
        : Array.isArray(req.query?.pair)
        ? req.query?.pair[0]
        : undefined) || symbol;
    const binanceSymbol =
      (typeof req.query?.binance === "string"
        ? req.query?.binance
        : Array.isArray(req.query?.binance)
        ? req.query?.binance[0]
        : undefined) || symbol;

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
