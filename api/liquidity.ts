// STANDALONE LIQUIDITY ENDPOINT - NO EXTERNAL IMPORTS

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
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Simple in-memory cache
const liquidityCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 30000;

function getCached(key: string) {
  const entry = liquidityCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  liquidityCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  liquidityCache.set(key, { data, expires: Date.now() + CACHE_TTL });
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
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
};

const now = () => Date.now();

const generateFakeSeries = (limit: number, base = 60_000): Candle[] => {
  const candles: Candle[] = [];
  for (let i = 0; i < limit; i += 1) {
    const t = now() - (limit - i) * 60_000;
    const drift = Math.sin(i / 6) * 150;
    const open = base + drift + i;
    const close = open + Math.sin(i / 3) * 50;
    const high = Math.max(open, close) + 40;
    const low = Math.min(open, close) - 40;
    candles.push({
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

// ===== INLINE LIQUIDITY ANALYSIS IMPLEMENTATIONS =====

function detectOrderBlocks(candles: Candle[]) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { buySide: [], sellSide: [] };
  }

  const buySide: { start: number; end: number; high: number; low: number }[] = [];
  const sellSide: { start: number; end: number; high: number; low: number }[] = [];

  for (let i = 2; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const current = candles[i];
    const before = candles[i - 2];
    if (!prev || !current || !before) continue;

    const isBullishBreaker =
      before.close < before.open &&
      prev.close > prev.open &&
      current.close > current.open &&
      current.close > before.high;
    if (isBullishBreaker) {
      buySide.push({
        start: prev.time ?? 0,
        end: current.time ?? 0,
        high: Math.max(prev.high ?? 0, current.high ?? 0),
        low: Math.min(prev.low ?? 0, current.low ?? 0),
      });
    }

    const isBearishBreaker =
      before.close > before.open &&
      prev.close < prev.open &&
      current.close < current.open &&
      current.close < before.low;
    if (isBearishBreaker) {
      sellSide.push({
        start: prev.time ?? 0,
        end: current.time ?? 0,
        high: Math.max(prev.high ?? 0, current.high ?? 0),
        low: Math.min(prev.low ?? 0, current.low ?? 0),
      });
    }
  }

  return { buySide, sellSide };
}

function detectFairValueGaps(candles: Candle[]) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const gaps: { start: number; end: number; upper: number; lower: number; type: string }[] = [];
  for (let i = 2; i < candles.length; i += 1) {
    const a = candles[i - 2];
    const b = candles[i - 1];
    const c = candles[i];
    if (!a || !b || !c) continue;
    const bullishGap = (a.high ?? 0) < (c.low ?? 0) && (b.low ?? 0) > (a.high ?? 0);
    const bearishGap = (a.low ?? 0) > (c.high ?? 0) && (b.high ?? 0) < (a.low ?? 0);
    if (bullishGap || bearishGap) {
      gaps.push({
        start: b.time ?? 0,
        end: c.time ?? 0,
        upper: Math.max(a.high ?? 0, b.high ?? 0, c.high ?? 0),
        lower: Math.min(a.low ?? 0, b.low ?? 0, c.low ?? 0),
        type: bullishGap ? "bullish" : "bearish",
      });
    }
  }
  return gaps;
}

function detectImbalanceZones(candles: Candle[]) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const zones: { time: number; high: number; low: number; side: string }[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const current = candles[i];
    if (!prev || !current) continue;
    const bodyPrev = Math.abs((prev.close ?? 0) - (prev.open ?? 0));
    const bodyCurr = Math.abs((current.close ?? 0) - (current.open ?? 0));
    const wickPrev = Math.abs((prev.high ?? 0) - (prev.low ?? 0));
    const wickCurr = Math.abs((current.high ?? 0) - (current.low ?? 0));
    const imbalance = (bodyPrev + bodyCurr) / Math.max(1, wickPrev + wickCurr);
    if (imbalance > 0.6) {
      zones.push({
        time: current.time ?? 0,
        high: Math.max(prev.high ?? 0, current.high ?? 0),
        low: Math.min(prev.low ?? 0, current.low ?? 0),
        side: current.close > current.open ? "buy" : "sell",
      });
    }
  }
  return zones;
}

function buildLiquidityHeatmap(candles: Candle[], buckets = 10) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const highs = candles.map((c) => c.high ?? 0);
  const lows = candles.map((c) => c.low ?? 0);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  if (max === min) return [];

  const step = (max - min) / buckets;
  const heatmap = Array.from({ length: buckets }, (_, idx) => {
    const start = min + idx * step;
    const end = start + step;
    return {
      level: Number(((start + end) / 2).toFixed(2)),
      liquidity: 0,
    };
  });

  candles.forEach((candle) => {
    const volume = candle.volume ?? 0;
    const mid = ((candle.high ?? 0) + (candle.low ?? 0)) / 2;
    const index = Math.min(
      heatmap.length - 1,
      Math.max(0, Math.floor(((mid - min) / (max - min)) * buckets))
    );
    heatmap[index].liquidity += volume;
  });

  const maxLiquidity = Math.max(...heatmap.map((h) => h.liquidity));
  return heatmap.map((h) => ({
    ...h,
    intensity: maxLiquidity ? Number((h.liquidity / maxLiquidity).toFixed(3)) : 0,
  }));
}

function detectWhaleMoves(candles: Candle[], thresholdMultiplier = 3) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const volumes = candles.map((c) => c.volume ?? 0);
  const avg = volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);
  const threshold = avg * thresholdMultiplier;
  const alerts: { time: number; side: string; volume: number; price: number }[] = [];
  candles.forEach((candle) => {
    const volume = candle.volume ?? 0;
    if (volume >= threshold) {
      alerts.push({
        time: candle.time ?? 0,
        side: (candle.close ?? 0) >= (candle.open ?? 0) ? "buy" : "sell",
        volume,
        price: candle.close ?? candle.high ?? candle.low ?? 0,
      });
    }
  });
  return alerts;
}

// ===== DATA FETCHING =====

async function fetchBinance(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = symbol.replace("/", "").toUpperCase();
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const data = await safeFetch<(number | string)[][]>(url, { timeoutMs: 3000 });
  return data.map((row) => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

async function fetchKraken(symbol: string, intervalMinutes: number, limit: number): Promise<Candle[]> {
  const pair = symbol.replace("/", "").toUpperCase();
  const mapped = pair === "BTCUSDT" ? "XBTUSDT" : pair;
  const url = `https://api.kraken.com/0/public/OHLC?pair=${mapped}&interval=${intervalMinutes}`;
  const data = await safeFetch<{ result: Record<string, unknown[]> }>(url, { timeoutMs: 3200 });
  const first = Object.values(data.result ?? {})[0] as (number | string)[][] | undefined;
  if (!Array.isArray(first)) throw new Error("No Kraken OHLC");
  const sliced = first.slice(-limit);
  return sliced.map((row) => ({
    time: Number(row[0]) * 1000,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[6]),
  }));
}

async function fetchCoinGecko(symbol: string, limit: number): Promise<Candle[]> {
  const id = symbolToId[symbol.replace("/", "").toUpperCase()] ?? "bitcoin";
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=1`;
  const data = await safeFetch<(number | string)[][]>(url, { timeoutMs: 3200 });
  return data.slice(-limit).map((row) => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[4]),
  }));
}

async function resolveOHLC(symbol: string, interval: string, intervalMinutes: number, limit: number): Promise<Candle[]> {
  const errors: string[] = [];
  
  try {
    const candles = await fetchBinance(symbol, interval, limit);
    if (candles?.length) return candles;
  } catch (err) {
    errors.push(`binance: ${(err as Error)?.message}`);
  }
  
  try {
    const candles = await fetchKraken(symbol, intervalMinutes, limit);
    if (candles?.length) return candles;
  } catch (err) {
    errors.push(`kraken: ${(err as Error)?.message}`);
  }
  
  try {
    const candles = await fetchCoinGecko(symbol, limit);
    if (candles?.length) return candles;
  } catch (err) {
    errors.push(`coingecko: ${(err as Error)?.message}`);
  }
  
  console.log("[liquidity] All providers failed:", errors);
  return generateFakeSeries(limit);
}

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const val = query?.[key];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
};

const mapInterval = (value: string | undefined) => {
  if (value === "1d" || value === "1440") return { interval: "1d", minutes: 1440 };
  if (value === "4h" || value === "240") return { interval: "4h", minutes: 240 };
  if (value === "1h" || value === "60") return { interval: "1h", minutes: 60 };
  if (value === "15m" || value === "15") return { interval: "15m", minutes: 15 };
  return { interval: "1h", minutes: 60 };
};

const fallbackLiquidity = () => ({
  orderBlocks: { buySide: [], sellSide: [] },
  fairValueGaps: [],
  imbalanceZones: [],
  liquidityHeatmap: [],
  whaleMoves: [],
});

export default async function handler(req: Req, res: Res) {
  try {
    const symbol = getQueryParam(req.query, "symbol")?.toUpperCase() ?? "BTCUSDT";
    const intervalParam = getQueryParam(req.query, "interval") ?? "1h";
    const { interval, minutes: intervalMinutes } = mapInterval(intervalParam);
    const limitParam = typeof req.query?.limit === "string" ? Number(req.query.limit) : 120;
    const limit = Number.isFinite(limitParam) ? Math.max(40, Math.min(400, limitParam)) : 180;

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`liquidity:${rateKey}`)) {
      return res.status(429).json({ ok: false, status: "rate_limited", error: "Rate limited" });
    }

    const cacheKey = `liquidity:${symbol}:${interval}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({
        ok: true,
        status: "ok",
        data: cached,
        meta: { symbol, interval, limit, cached: true },
      });
    }

    // Fetch candle data
    const candles = await resolveOHLC(symbol, interval, intervalMinutes, limit);
    
    if (!candles || candles.length < 20) {
      const fallback = fallbackLiquidity();
      return res.status(200).json({
        ok: true,
        status: "degraded",
        data: fallback,
        meta: { symbol, interval, limit, provider: "synthetic" },
      });
    }

    // Calculate liquidity analysis
    const liquidityData = {
      orderBlocks: detectOrderBlocks(candles),
      fairValueGaps: detectFairValueGaps(candles),
      imbalanceZones: detectImbalanceZones(candles),
      liquidityHeatmap: buildLiquidityHeatmap(candles, 10),
      whaleMoves: detectWhaleMoves(candles, 3),
    };

    setCache(cacheKey, liquidityData);

    return res.status(200).json({
      ok: true,
      status: "ok",
      data: liquidityData,
      meta: { symbol, interval, limit, cached: false },
    });
  } catch (error) {
    console.error("[liquidity] handler error", error);
    const fallback = fallbackLiquidity();
    return res.status(200).json({
      ok: true,
      status: "degraded",
      data: fallback,
      meta: { provider: "synthetic", error: (error as Error)?.message },
    });
  }
}
