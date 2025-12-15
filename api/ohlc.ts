// STANDALONE OHLC ENDPOINT - NO EXTERNAL IMPORTS

type Req = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  provider?: string;
};

// Simple in-memory cache
const ohlcCache = new Map<string, { data: { candles: Candle[]; provider: string }; expires: number }>();
const CACHE_TTL = 60000; // 1 minute

function getCached(key: string) {
  const entry = ohlcCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  ohlcCache.delete(key);
  return null;
}

function setCache(key: string, data: { candles: Candle[]; provider: string }) {
  ohlcCache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

// Simple rate limiting
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 500;

function isRateLimited(key: string): boolean {
  const last = rateLimitMap.get(key);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(key, now);
  return false;
}

// Simple fetch with timeout
async function safeFetch<T>(url: string, options?: { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 5000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json() as T;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function safeFetchText(url: string, options?: { timeoutMs?: number }): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 5000);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

const symbolToId: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
  BTCUSD: "bitcoin",
  ETHUSD: "ethereum",
};

const mapInterval = (value: string | number | undefined) => {
  const minutes = Number.isFinite(Number(value)) ? Number(value) : 60;
  if (minutes >= 1440) return { minutes: 1440, binance: "1d", kraken: 1440 };
  if (minutes >= 240) return { minutes: 240, binance: "4h", kraken: 240 };
  if (minutes >= 60) return { minutes: 60, binance: "1h", kraken: 60 };
  if (minutes >= 15) return { minutes: 15, binance: "15m", kraken: 15 };
  return { minutes: 5, binance: "5m", kraken: 5 };
};

const now = () => Date.now();

// Generate synthetic candles for fallback
const generateFakeSeries = (limit: number, base = 60_000): Candle[] => {
  const candles: Candle[] = [];
  for (let i = 0; i < limit; i += 1) {
    const t = now() - (limit - i) * 60_000;
    const drift = Math.sin(i / 6) * 150;
    const open = base + drift + i;
    const close = open + Math.sin(i / 3) * 50;
    const high = Math.max(open, close) + 40;
    const low = Math.min(open, close) - 40;
    const volume = Math.abs(Math.sin(i)) * 1200 + 300;
    candles.push({
      t,
      o: Number(open.toFixed(2)),
      h: Number(high.toFixed(2)),
      l: Number(low.toFixed(2)),
      c: Number(close.toFixed(2)),
      v: Number(volume.toFixed(2)),
      time: t,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number(volume.toFixed(2)),
      provider: "synthetic",
    });
  }
  return candles;
};

// Fetch from Binance
async function fetchBinance(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = symbol.replace("/", "").toUpperCase();
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const data = await safeFetch<(number | string)[][]>(url, { timeoutMs: 3000 });
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

// Fetch from Kraken
async function fetchKraken(symbol: string, intervalMinutes: number, limit: number): Promise<Candle[]> {
  const pair = symbol.replace("/", "").toUpperCase();
  const mapped = pair === "BTCUSDT" ? "XBTUSDT" : pair === "BTCUSD" ? "XBTUSD" : pair;
  const url = `https://api.kraken.com/0/public/OHLC?pair=${mapped}&interval=${intervalMinutes}`;
  const data = await safeFetch<{ result: Record<string, unknown[]> }>(url, { timeoutMs: 3200 });
  const first = Object.values(data.result ?? {})[0] as (number | string)[][] | undefined;
  if (!Array.isArray(first)) throw new Error("No Kraken OHLC data");
  const sliced = first.slice(-limit);
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

// Fetch from CoinGecko
async function fetchCoinGecko(symbol: string, limit: number): Promise<Candle[]> {
  const id = symbolToId[symbol.replace("/", "").toUpperCase()] ?? "bitcoin";
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=1`;
  const data = await safeFetch<(number | string)[][]>(url, { timeoutMs: 3200 });
  return data.slice(-limit).map((row) => {
    const t = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    return {
      t, o, h, l, c, v: 0,
      time: t, open: o, high: h, low: l, close: c, volume: 0,
      provider: "coingecko",
    };
  });
}

// Fetch FX from open.er-api.com
async function fetchFxSeries(base: string, quote: string, limit: number): Promise<Candle[]> {
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`;
  const res = await safeFetch<{ result?: string; rates?: Record<string, number> }>(url, { timeoutMs: 4000 });
  
  if (res?.result !== "success" || !res?.rates) {
    throw new Error("FX API failed");
  }
  
  const rate = Number(res.rates[quote.toUpperCase()]);
  if (!Number.isFinite(rate)) {
    throw new Error(`Missing rate for ${quote}`);
  }
  
  // Generate synthetic daily candles with slight variation
  const candles: Candle[] = [];
  const baseVariation = rate * 0.001;
  
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
}

// Fetch Stooq for indices
async function fetchStooqDaily(symbol: string, limit: number): Promise<Candle[]> {
  const url = `https://stooq.pl/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}&i=d`;
  const csv = await safeFetchText(url, { timeoutMs: 5000 });
  
  if (!csv || csv.trim().length === 0) {
    throw new Error("Stooq response invalid");
  }
  
  const lines = csv.trim().split(/\r?\n/).slice(1);
  if (lines.length === 0) {
    throw new Error("Stooq has no data");
  }
  
  const rows = lines
    .map((line) => {
      const [date, open, high, low, close, volume] = line.split(",");
      const t = Date.parse(date);
      if (!Number.isFinite(t)) return null;
      const o = Number(open), h = Number(high), l = Number(low), c = Number(close), v = Number(volume) || 0;
      if ([o, h, l, c].some((n) => Number.isNaN(n))) return null;
      return { t, o, h, l, c, v, time: t, open: o, high: h, low: l, close: c, volume: v, provider: "stooq" };
    })
    .filter(Boolean) as Candle[];
  
  return rows.slice(-limit);
}

// Resolve OHLC from multiple providers
async function resolveOHLC(symbol: string, interval: string, intervalMinutes: number, limit: number) {
  const errors: string[] = [];
  
  // Try Binance first
  try {
    const candles = await fetchBinance(symbol, interval, limit);
    if (candles?.length) return { candles, provider: "binance", errors };
  } catch (err) {
    errors.push(`binance: ${(err as Error)?.message}`);
  }
  
  // Try Kraken
  try {
    const candles = await fetchKraken(symbol, intervalMinutes, limit);
    if (candles?.length) return { candles, provider: "kraken", errors };
  } catch (err) {
    errors.push(`kraken: ${(err as Error)?.message}`);
  }
  
  // Try CoinGecko
  try {
    const candles = await fetchCoinGecko(symbol, limit);
    if (candles?.length) return { candles, provider: "coingecko", errors };
  } catch (err) {
    errors.push(`coingecko: ${(err as Error)?.message}`);
  }
  
  // All failed - return synthetic data
  return { candles: generateFakeSeries(limit), provider: "synthetic", errors };
}

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const val = query?.[key];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
};

// Simple market lookup
const SUPPORTED_MARKETS: Record<string, { id: string; type: string; base?: string; quote?: string }> = {
  BTC: { id: "BTC", type: "crypto", base: "BTC", quote: "USD" },
  BTCUSD: { id: "BTCUSD", type: "crypto", base: "BTC", quote: "USD" },
  BTCUSDT: { id: "BTCUSDT", type: "crypto", base: "BTC", quote: "USDT" },
  ETH: { id: "ETH", type: "crypto", base: "ETH", quote: "USD" },
  ETHUSD: { id: "ETHUSD", type: "crypto", base: "ETH", quote: "USD" },
  EURUSD: { id: "EURUSD", type: "fx", base: "EUR", quote: "USD" },
  XAUUSD: { id: "XAUUSD", type: "commodity", base: "XAU", quote: "USD" },
  SPX: { id: "SPX", type: "index", base: "SPX", quote: "USD" },
  SP500: { id: "SP500", type: "index", base: "SPX", quote: "USD" },
};

export default async function handler(req: Req, res: Res) {
  try {
    const intervalValue = getQueryParam(req.query, "interval") ?? "60";
    const { minutes: intervalMinutes, binance: binanceInterval } = mapInterval(intervalValue);
    
    const assetParam = getQueryParam(req.query, "asset")?.toUpperCase();
    const symbolParam = getQueryParam(req.query, "symbol")?.toUpperCase() ?? getQueryParam(req.query, "pair")?.toUpperCase() ?? "BTCUSDT";
    
    const limitParam = typeof req.query?.limit === "string" ? Number(req.query.limit) : 60;
    const limit = Number.isFinite(limitParam) ? Math.max(20, Math.min(500, limitParam)) : 120;

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`ohlc:${rateKey}`)) {
      return res.status(429).json({
        ok: false,
        status: "rate_limited",
        error: "Rate limited. Slow down requests.",
        data: [],
      });
    }

    // Handle specific asset types
    if (assetParam) {
      const market = SUPPORTED_MARKETS[assetParam];
      
      if (!market) {
        return res.status(400).json({
          ok: false,
          status: "error",
          error: "Unknown asset. Supported: BTC, ETH, EURUSD, XAUUSD, SPX",
          data: [],
        });
      }

      const cacheKey = `ohlc:${market.id}:${intervalMinutes}:${limit}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return res.status(200).json({
          ok: true,
          status: "ok",
          data: cached.candles,
          meta: { symbol: market.id, interval: intervalMinutes, provider: cached.provider, cached: true },
        });
      }

      // FX markets
      if (market.type === "fx") {
        try {
          const candles = await fetchFxSeries(market.base || "EUR", market.quote || "USD", limit);
          setCache(cacheKey, { candles, provider: "open.er-api.com" });
          return res.status(200).json({
            ok: true,
            status: "ok",
            data: candles,
            meta: { symbol: market.id, interval: intervalMinutes, provider: "open.er-api.com", cached: false },
          });
        } catch (err) {
          const fallback = generateFakeSeries(limit, 1.08);
          return res.status(200).json({
            ok: true,
            status: "degraded",
            data: fallback,
            meta: { symbol: market.id, interval: intervalMinutes, provider: "synthetic", error: (err as Error)?.message },
          });
        }
      }

      // Index markets (SPX)
      if (market.type === "index") {
        try {
          const candles = await fetchStooqDaily("^spx", limit);
          setCache(cacheKey, { candles, provider: "stooq" });
          return res.status(200).json({
            ok: true,
            status: "ok",
            data: candles,
            meta: { symbol: market.id, interval: intervalMinutes, provider: "stooq", cached: false },
          });
        } catch (err) {
          const fallback = generateFakeSeries(limit, 5000);
          return res.status(200).json({
            ok: true,
            status: "degraded",
            data: fallback,
            meta: { symbol: market.id, interval: intervalMinutes, provider: "synthetic", error: (err as Error)?.message },
          });
        }
      }

      // Crypto and commodity - use resolveOHLC
      const symbol = market.type === "crypto" ? `${market.base}USDT` : market.id;
      const result = await resolveOHLC(symbol, binanceInterval, intervalMinutes, limit);
      setCache(cacheKey, { candles: result.candles, provider: result.provider });
      
      return res.status(200).json({
        ok: true,
        status: result.provider === "synthetic" ? "degraded" : "ok",
        data: result.candles,
        meta: {
          symbol: market.id,
          interval: intervalMinutes,
          provider: result.provider,
          cached: false,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      });
    }

    // Default: use symbol param
    const cacheKey = `ohlc:${symbolParam}:${intervalMinutes}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({
        ok: true,
        status: "ok",
        data: cached.candles,
        meta: { symbol: symbolParam, interval: intervalMinutes, provider: cached.provider, cached: true },
      });
    }

    const result = await resolveOHLC(symbolParam, binanceInterval, intervalMinutes, limit);
    setCache(cacheKey, { candles: result.candles, provider: result.provider });

    return res.status(200).json({
      ok: true,
      status: result.provider === "synthetic" ? "degraded" : "ok",
      data: result.candles,
      meta: {
        symbol: symbolParam,
        interval: intervalMinutes,
        provider: result.provider,
        cached: false,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    });
  } catch (error) {
    console.error("[ohlc] handler error", error);
    const fallback = generateFakeSeries(60);
    return res.status(200).json({
      ok: true,
      status: "degraded",
      data: fallback,
      meta: { provider: "synthetic", error: (error as Error)?.message },
    });
  }
}
