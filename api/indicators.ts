// STANDALONE INDICATORS ENDPOINT - NO EXTERNAL IMPORTS

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
const indicatorCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCached(key: string) {
  const entry = indicatorCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  indicatorCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  indicatorCache.set(key, { data, expires: Date.now() + CACHE_TTL });
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

// Generate synthetic candles for fallback
const generateFakeSeries = (limit: number, base = 60_000): Candle[] => {
  const candles: Candle[] = [];
  for (let i = 0; i < limit; i += 1) {
    const t = now() - (limit - i) * 60_000;
    const drift = Math.sin(i / 4) * 90;
    const open = base + drift + i;
    const close = open + Math.sin(i / 3) * 55;
    const high = Math.max(open, close) + 35;
    const low = Math.min(open, close) - 35;
    candles.push({
      time: t,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number((Math.abs(Math.sin(i)) * 1300 + 280).toFixed(2)),
    });
  }
  return candles;
};

// ===== INLINE INDICATOR IMPLEMENTATIONS =====

function ema(values: number[], period = 14): number[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((value, idx) => {
    if (idx === 0) {
      out.push(value);
    } else {
      const prev = out[idx - 1];
      out.push(value * k + prev * (1 - k));
    }
  });
  return out;
}

function rsi(values: number[], period = 14): number[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  const deltas = values.slice(1).map((c, i) => c - values[i]);
  let gains = 0;
  let losses = 0;
  deltas.slice(0, period).forEach((d) => {
    if (d >= 0) gains += d;
    else losses -= d;
  });
  const result = Array(values.length).fill(50);
  let avgGain = gains / period;
  let avgLoss = losses / period || 1;
  for (let i = period; i < deltas.length; i += 1) {
    const delta = deltas[i];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period || 1;
    const rs = avgGain / avgLoss;
    result[i + 1] = 100 - 100 / (1 + rs);
  }
  return result;
}

function macd(values: number[]) {
  if (!Array.isArray(values) || values.length === 0) {
    return { line: [], signal: [], histogram: [] };
  }
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signal[i]);
  return { line: macdLine, signal, histogram };
}

function smooth(values: number[], period: number): number[] {
  if (!Array.isArray(values) || values.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - period + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push(avg);
  }
  return out;
}

function stochastic(candles: Candle[], period = 14, smoothing = 3) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { k: [], d: [] };
  }
  const values: number[] = [];
  for (let i = period; i <= candles.length; i += 1) {
    const slice = candles.slice(i - period, i);
    const high = Math.max(...slice.map((c) => c.high ?? 0));
    const low = Math.min(...slice.map((c) => c.low ?? 0));
    const lastClose = slice[slice.length - 1]?.close ?? 0;
    const k = high === low ? 50 : ((lastClose - low) / (high - low)) * 100;
    values.push(k);
  }
  const d = smooth(values, smoothing);
  return { k: values, d };
}

function atr(candles: Candle[], period = 14): number[] {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const prevClose = candles[i - 1]?.close ?? current.close ?? 0;
    const tr = Math.max(
      (current.high ?? 0) - (current.low ?? 0),
      Math.abs((current.high ?? 0) - prevClose),
      Math.abs((current.low ?? 0) - prevClose)
    );
    trs.push(tr);
  }
  if (trs.length === 0) return [];
  const out: number[] = [];
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < trs.length; i += 1) {
    prev = (prev * (period - 1) + trs[i]) / period;
    out.push(prev);
  }
  return out;
}

function trendStrength(emaFast: number[], emaSlow: number[]): number {
  const lastFast = emaFast?.[emaFast.length - 1] ?? 0;
  const lastSlow = emaSlow?.[emaSlow.length - 1] ?? 0;
  return lastFast - lastSlow;
}

function smartMoneyFlow(candles: Candle[]): number {
  if (!Array.isArray(candles) || candles.length === 0) return 0;
  let flow = 0;
  candles.forEach((candle) => {
    const high = candle.high ?? 0;
    const low = candle.low ?? 0;
    const close = candle.close ?? 0;
    const volume = candle.volume ?? 0;
    const multiplier = high === low ? 0 : ((close - low) - (high - close)) / (high - low);
    flow += multiplier * volume;
  });
  return flow;
}

function volatility(closes: number[], period = 20): number[] {
  const vols: number[] = [];
  for (let i = period; i <= closes.length; i += 1) {
    const slice = closes.slice(i - period, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / slice.length;
    vols.push(Math.sqrt(variance));
  }
  return vols;
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
  
  console.log("[indicators] All providers failed:", errors);
  return generateFakeSeries(limit);
}

const fallbackIndicators = (length = 60) => ({
  rsi: Array(length).fill(50),
  macd: { line: Array(length).fill(0), signal: Array(length).fill(0), histogram: Array(length).fill(0) },
  stochastic: { k: Array(length).fill(50), d: Array(length).fill(50) },
  ema: { ema21: Array(length).fill(0), ema50: Array(length).fill(0) },
  atr: Array(length).fill(0),
  trendStrength: 0,
  volatility: Array(length).fill(0),
  smartMoneyFlow: 0,
});

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
  if (value === "5m" || value === "5") return { interval: "5m", minutes: 5 };
  return { interval: "1h", minutes: 60 };
};

export default async function handler(req: Req, res: Res) {
  try {
    const symbol = getQueryParam(req.query, "symbol")?.toUpperCase() ?? "BTCUSDT";
    const intervalParam = getQueryParam(req.query, "interval") ?? "1h";
    const { interval, minutes: intervalMinutes } = mapInterval(intervalParam);
    const limitParam = typeof req.query?.limit === "string" ? Number(req.query.limit) : 120;
    const limit = Number.isFinite(limitParam) ? Math.max(40, Math.min(400, limitParam)) : 180;

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`indicators:${rateKey}`)) {
      return res.status(429).json({ ok: false, status: "rate_limited", error: "Rate limited" });
    }

    const cacheKey = `indicators:${symbol}:${interval}:${limit}`;
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
    
    if (!candles || candles.length < 30) {
      const fallback = fallbackIndicators(limit);
      return res.status(200).json({
        ok: true,
        status: "degraded",
        data: fallback,
        meta: { symbol, interval, limit, provider: "synthetic" },
      });
    }

    // Calculate indicators
    const closes = candles.map((c) => c.close);
    const ema21 = ema(closes, 21);
    const ema50 = ema(closes, 50);

    const indicators = {
      rsi: rsi(closes, 14),
      macd: macd(closes),
      stochastic: stochastic(candles, 14, 3),
      ema: { ema21, ema50 },
      atr: atr(candles, 14),
      trendStrength: trendStrength(ema21, ema50),
      volatility: volatility(closes, 20),
      smartMoneyFlow: smartMoneyFlow(candles),
    };

    setCache(cacheKey, indicators);

    return res.status(200).json({
      ok: true,
      status: "ok",
      data: indicators,
      meta: { symbol, interval, limit, cached: false },
    });
  } catch (error) {
    console.error("[indicators] handler error", error);
    const fallback = fallbackIndicators(60);
    return res.status(200).json({
      ok: true,
      status: "degraded",
      data: fallback,
      meta: { provider: "synthetic", error: (error as Error)?.message },
    });
  }
}
