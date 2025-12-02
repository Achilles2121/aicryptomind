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
  if (res.setHeader) res.setHeader("Content-Type", "application/json");
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
  const mapped = symbol === "BTCUSDT" ? "XBTUSDT" : symbol;

  const key = cacheKey("kraken", symbol);
  const cached = cache.get<unknown>(key);
  if (cached) {
    return send(res, 200, { ok: true, cached: true, ...(cached as object) });
  }

  try {
    const priceUrl = `https://api.kraken.com/0/public/Ticker?pair=${mapped}`;
    const ticker = await safeFetchJson<{ result: Record<string, { c: [string] }> }>(
      priceUrl,
      undefined,
      { timeoutMs: 2600, attempts: 2 }
    );
    const firstTicker = Object.values(ticker.result ?? {})[0];
    const price = Number(firstTicker?.c?.[0] ?? 0);

    const ohlcUrl = `https://api.kraken.com/0/public/OHLC?pair=${mapped}&interval=60`;
    const response = await safeFetchJson<{ result: Record<string, (number | string)[]> }>(
      ohlcUrl,
      undefined,
      { timeoutMs: 3200, attempts: 2 }
    );
    const rawSeries = Object.values(response.result ?? {})[0];
    const series = Array.isArray(rawSeries)
      ? (rawSeries as unknown as (number | string)[][])
      : undefined;

    const payload = {
      source: "kraken" as const,
      symbol,
      price,
      candles:
        series?.slice(-120).map((row) => ({
          time: Number(row[0]) * 1000,
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[6]),
        })) ?? [],
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
