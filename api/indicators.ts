import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { isRateLimited } from "./utils/rateLimit";
import { ema as emaCalc } from "../server/indicators/ema.js";
import { rsi as rsiCalc } from "../server/indicators/rsi.js";
import { macd as macdCalc } from "../server/indicators/macd.js";
import { stochastic as stochCalc } from "../server/indicators/stoch.js";
import { atr as atrCalc } from "../server/indicators/atr.js";
import { trendStrength } from "../server/indicators/trend.js";
import { smartMoneyFlow } from "../server/indicators/smf.js";

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

const volatility = (closes: number[], period = 20) => {
  const vols: number[] = [];
  for (let i = period; i <= closes.length; i += 1) {
    const slice = closes.slice(i - period, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance =
      slice.reduce((a, b) => a + (b - mean) * (b - mean), 0) / slice.length;
    vols.push(Math.sqrt(variance));
  }
  return vols;
};

const smooth = (values: number[], window = 3) => {
  if (!values.length) return [];
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
};

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

export default async function handler(req: Req, res: Res) {
  try {
    const symbol =
      (typeof req.query?.symbol === "string"
        ? req.query?.symbol
        : Array.isArray(req.query?.symbol)
        ? req.query?.symbol[0]
        : undefined) ?? "BTCUSDT";
    const interval =
      (typeof req.query?.interval === "string" ? req.query?.interval : "1h") ?? "1h";
    const limitParam = typeof req.query?.limit === "string" ? Number(req.query.limit) : 120;
    const limit = Number.isFinite(limitParam) ? Math.max(40, Math.min(400, limitParam)) : 180;
    const version = typeof req.query?.v === "string" ? req.query.v : "3";
    const type = typeof req.query?.type === "string" ? req.query.type : "all";

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`indicators:${rateKey}`)) {
      return send(res, 429, { ok: false, error: "rate_limited" });
    }

    const key = cacheKey("indicators", symbol, interval, limit);
    const cached = cache.get<unknown>(key);
    if (cached) {
      return send(res, 200, { ok: true, cached: true, ...(cached as object) });
    }

    const timeframes = version === "4" || version === "5" ? ["5m", "15m", "1h", "4h", "1d"] : [interval];
    const frameResults: Record<string, unknown> = {};

    for (const tf of timeframes) {
      const candles = await resolveOHLC(symbol, tf, limit);
      const closes = candles.map((c) => c.close);
      const ema21 = emaCalc(closes, 21);
      const ema50 = emaCalc(closes, 50);
      const baseIndicators = {
        rsi: rsiCalc(closes),
        macd: macdCalc(closes),
        stochastic: stochCalc(candles),
        ema: { ema21, ema50 },
        atr: atrCalc(candles),
        trendStrength: trendStrength(ema21, ema50),
        volatility: volatility(closes),
        smartMoneyFlow: smartMoneyFlow(candles.slice(-50)),
      };

      const smoothed = {
        rsi: smooth(baseIndicators.rsi),
        macd: {
          line: smooth(baseIndicators.macd.macdLine),
          signal: smooth(baseIndicators.macd.signal),
          histogram: smooth(baseIndicators.macd.histogram),
        },
        stochastic: {
          k: smooth(baseIndicators.stochastic.k),
          d: smooth(baseIndicators.stochastic.d),
        },
        ema: {
          ema21: smooth(baseIndicators.ema.ema21),
          ema50: smooth(baseIndicators.ema.ema50),
        },
        atr: smooth(baseIndicators.atr),
        trendStrength: baseIndicators.trendStrength,
        volatility: smooth(baseIndicators.volatility),
        smartMoneyFlow: baseIndicators.smartMoneyFlow,
      };

      const framePayload =
        type === "all"
          ? { candles: candles.slice(-120), indicators: smoothed }
          : { candles: candles.slice(-120), indicators: { [type]: smoothed[type as keyof typeof smoothed] ?? null } };

      frameResults[tf] = framePayload;

      // Keep backward-compatible top-level when interval matches
      if (tf === interval) {
        Object.assign(frameResults, {
          candles: framePayload.candles,
          indicators: framePayload.indicators,
        });
      }
    }

    // HTF confirmation: combine 4h + 1h + 15m RSI/trend
    const h4 = frameResults["4h"] as { indicators?: any };
    const h1 = frameResults["1h"] as { indicators?: any };
    const m15 = frameResults["15m"] as { indicators?: any };
    const rsiH4 = h4?.indicators?.rsi?.slice(-1)[0] ?? 50;
    const rsiH1 = h1?.indicators?.rsi?.slice(-1)[0] ?? 50;
    const rsiM15 = m15?.indicators?.rsi?.slice(-1)[0] ?? 50;
    const trendH4 = h4?.indicators?.trendStrength ?? 0;
    const trendH1 = h1?.indicators?.trendStrength ?? 0;
    const trendM15 = m15?.indicators?.trendStrength ?? 0;
    const htfConfirmation = {
      bullish: rsiH4 > 55 && rsiH1 > 55 && rsiM15 > 55 && trendH4 >= 0 && trendH1 >= 0 && trendM15 >= 0,
      bearish: rsiH4 < 45 && rsiH1 < 45 && rsiM15 < 45 && trendH4 <= 0 && trendH1 <= 0 && trendM15 <= 0,
      composite: {
        rsi: { h4: rsiH4, h1: rsiH1, m15: rsiM15 },
        trend: { h4: trendH4, h1: trendH1, m15: trendM15 },
      },
    };

    const payload = {
      ok: true,
      cached: false,
      version,
      type,
      symbol,
      interval,
      frames: frameResults,
      htfConfirmation,
      timestamp: now(),
    };

    cache.set(key, payload);
    return send(res, 200, payload);
  } catch (error) {
    return send(res, 200, {
      ok: true,
      version: typeof req.query?.v === "string" ? req.query.v : "4",
      type: typeof req.query?.type === "string" ? req.query.type : "all",
      symbol: "BTCUSDT",
      interval: "1h",
      frames: {
        "1h": { candles: generateFakeSeries(120), indicators: fallbackIndicators(120) },
      },
      htfConfirmation: {
        bullish: false,
        bearish: false,
        composite: { rsi: { h4: 50, h1: 50, m15: 50 }, trend: { h4: 0, h1: 0, m15: 0 } },
      },
      timestamp: now(),
      note: "auto-recovered",
      error: (error as Error)?.message,
    });
  }
}
