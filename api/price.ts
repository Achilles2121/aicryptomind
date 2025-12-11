import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { isRateLimited } from "./utils/rateLimit";

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

const send = (res: Res, status: number, body: unknown) => {
  if (res.setHeader) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  if (typeof res.json === "function") {
    res.status(status).json(body);
  } else if (res.end) {
    res.end(JSON.stringify(body));
  }
};

const now = () => Date.now();

const generateFallbackPrice = (symbol: string) => {
  const base = symbol.includes("ETH") ? 3500 : 60000;
  const variance = Math.sin(now() / 60000) * (symbol.includes("ETH") ? 30 : 120);
  return Number((base + variance).toFixed(2));
};

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

export default async function handler(req: Req, res: Res) {
  try {
    const symbolParam =
      (typeof req.query?.symbol === "string"
        ? req.query?.symbol
        : Array.isArray(req.query?.symbol)
        ? req.query?.symbol[0]
        : undefined) ??
      (typeof req.query?.asset === "string"
        ? req.query?.asset
        : Array.isArray(req.query?.asset)
        ? req.query?.asset[0]
        : undefined);
    const symbol = (symbolParam || "BTCUSDT").toUpperCase();

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`price:${rateKey}`)) {
      return send(res, 429, {
        ok: false,
        status: "degraded",
        source: "price",
        statusCode: 429,
        message: "rate limited",
        hint: "Slow down requests",
      });
    }

    const key = cacheKey("price", symbol);
    const cached = cache.get<unknown>(key) as any;
    if (cached) {
      return send(res, 200, { ok: true, status: "ok", statusCode: 200, source: "price", data: cached, cached: true });
    }

    const { data, errors } = await resolvePrice(symbol);
    const payload = {
      value: data.price,
      change24h: null,
      source: data.source,
      symbol: data.symbol,
      updatedAt: new Date(data.timestamp).toISOString(),
    };
    cache.set(key, payload);
    return send(res, 200, { ok: true, status: "ok", statusCode: 200, source: "price", data: payload, cached: false, errors });
  } catch (error) {
    const errors: ReturnType<typeof normalizeError>[] = (error as any)?.errors || [];
    const primary = errors[0] ?? normalizeError("price", error);
    const statusCode = primary.statusCode || 502;
    const fallback = {
      value: generateFallbackPrice("BTCUSDT"),
      change24h: null,
      source: "fallback",
      symbol: "BTCUSDT",
      updatedAt: new Date().toISOString(),
    };
    return send(res, statusCode, {
      ok: false,
      status: statusCode === 503 ? "disabled" : "degraded",
      source: "price",
      statusCode,
      message: primary.message || "Price feed unavailable",
      hint: primary.hint || "Serving synthetic fallback price",
      data: fallback,
      errors,
    });
  }
}
