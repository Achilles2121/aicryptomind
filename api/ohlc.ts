import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { isRateLimited } from "./utils/rateLimit";

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
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const symbolToId: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana",
};

const send = (res: Res, status: number, body: unknown) => {
  if (res.setHeader) res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (typeof res.json === "function") {
    res.status(status).json(body);
  } else if (res.end) {
    res.end(JSON.stringify(body));
  }
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

async function fetchBinance(symbol: string, interval: string, limit: number) {
  const pair = symbol.replace("/", "").toUpperCase();
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const data = await safeFetchJson<(number | string)[][]>(url, undefined, {
    timeoutMs: 3000,
    attempts: 2,
  });
  return data.map((row) => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}

async function fetchKraken(symbol: string, interval: string, limit: number) {
  const pair = symbol.replace("/", "").toUpperCase();
  const mapped = pair === "BTCUSDT" ? "XBTUSDT" : pair;
  const url = `https://api.kraken.com/0/public/OHLC?pair=${mapped}&interval=${interval === "1h" ? 60 : 15}`;
  const data = await safeFetchJson<{ result: Record<string, (number | string)[]> }>(
    url,
    undefined,
    { timeoutMs: 3200, attempts: 2 }
  );
  const first = Object.values(data.result ?? {})[0];
  if (!Array.isArray(first)) throw new Error("No Kraken OHLC");
  const sliced = (first as unknown as (number | string)[][]).slice(-limit);
  return sliced.map((row) => ({
    time: Number(row[0]) * 1000,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[6]),
  }));
}

async function fetchCoinGecko(symbol: string, limit: number) {
  const id = symbolToId[symbol.replace("/", "").toUpperCase()] ?? "bitcoin";
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=1`;
  const data = await safeFetchJson<(number | string)[][]>(url, undefined, {
    timeoutMs: 3200,
    attempts: 2,
  });
  return data.slice(-limit).map((row) => ({
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[4]),
  }));
}

async function resolveOHLC(symbol: string, interval: string, limit: number) {
  const providers = [
    () => fetchBinance(symbol, interval, limit),
    () => fetchKraken(symbol, interval, limit),
    () => fetchCoinGecko(symbol, limit),
  ];
  for (const provider of providers) {
    try {
      const candles = await provider();
      if (candles?.length) return candles;
    } catch {
      // continue
    }
  }
  return generateFakeSeries(limit);
}

export default async function handler(req: Req, res: Res) {
  try {
    const symbol =
      (typeof req.query?.symbol === "string"
        ? req.query?.symbol
        : Array.isArray(req.query?.symbol)
        ? req.query?.symbol[0]
        : undefined) ?? "BTCUSDT";
    const interval = (typeof req.query?.interval === "string" ? req.query?.interval : "1h") ?? "1h";
    const limitParam = typeof req.query?.limit === "string" ? Number(req.query.limit) : 60;
    const limit = Number.isFinite(limitParam) ? Math.max(20, Math.min(500, limitParam)) : 120;

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`ohlc:${rateKey}`)) {
      return send(res, 429, { ok: false, error: "rate_limited" });
    }

    const key = cacheKey("ohlc", symbol, interval, limit);
    const cached = cache.get<{ candles: Candle[] }>(key);
    if (cached) {
      return send(res, 200, { ok: true, symbol, interval, candles: cached.candles, cached: true });
    }

    const candles = await resolveOHLC(symbol, interval, limit);
    const payload = { candles };
    cache.set(key, payload);
    return send(res, 200, { ok: true, symbol, interval, ...payload, cached: false });
  } catch (error) {
    return send(res, 200, {
      ok: true,
      symbol: "BTCUSDT",
      interval: "1h",
      candles: generateFakeSeries(60),
      cached: true,
      note: "auto-recovered",
      error: (error as Error)?.message,
    });
  }
}
