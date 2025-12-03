import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";

type Req = {
  query?: Record<string, string | string[]>;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
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

const generateFallback = (symbol: string) => ({
  source: "fallback",
  symbol,
  price: 60_000,
  candles: [],
  timestamp: now(),
});

export default async function handler(req: Req, res: Res) {
  const symbol =
    (typeof req.query?.symbol === "string"
      ? req.query?.symbol
      : Array.isArray(req.query?.symbol)
      ? req.query?.symbol[0]
      : undefined) ?? "BTCUSDT";

  const key = cacheKey("binance", symbol);
  const cached = cache.get<unknown>(key);
  if (cached) {
    return send(res, 200, { ok: true, cached: true, ...(cached as object) });
  }

  try {
    const priceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const ticker = await safeFetchJson<{ price: string }>(priceUrl, undefined, {
      timeoutMs: 2500,
      attempts: 2,
    });

    const ohlcUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=120`;
    const candles = await safeFetchJson<(number | string)[][]>(ohlcUrl, undefined, {
      timeoutMs: 3000,
      attempts: 2,
    });

    const payload = {
      source: "binance" as const,
      symbol,
      price: Number(ticker.price),
      candles: candles.map((row) => ({
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      })),
      timestamp: now(),
    };

    cache.set(key, payload);
    return send(res, 200, { ok: true, cached: false, ...payload });
  } catch (error) {
    const payload = generateFallback(symbol);
    cache.set(key, payload);
    return send(res, 200, { ok: true, ...payload, error: (error as Error)?.message });
  }
}
