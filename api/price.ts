// STANDALONE PRICE ENDPOINT - NO EXTERNAL IMPORTS

type Req = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  method?: string;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

// Simple rate limiting
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 1000;

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

const now = () => Date.now();

type FxPrice = { base: string; quote: string; price: number; provider: string; timestamp: number };
type MetalPrice = { symbol: string; price: number; provider: string; timestamp: number };

// --- Price fetchers ---
const fetchBtcUsd = async (): Promise<{ price: number; source: string; timestamp: number }> => {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
  const data = await safeFetch<Record<string, { usd: number }>>(url, { timeoutMs: 4500 });
  const price = Number(data?.bitcoin?.usd);
  if (!Number.isFinite(price)) throw new Error("CoinGecko BTC price missing");
  return { price, source: "coingecko", timestamp: now() };
};

// Use open.er-api.com (free, no API key required)
const fetchFxFromOpenExchangeRate = async (base: string, quote: string): Promise<FxPrice> => {
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base.toUpperCase())}`;
  const res = await safeFetch<{ result?: string; rates?: Record<string, number> }>(url, { timeoutMs: 4000 });
  if (res?.result !== "success" || !res?.rates) throw new Error("OpenExchangeRate API failed");
  const rate = Number(res.rates[quote.toUpperCase()]);
  if (!Number.isFinite(rate)) throw new Error(`OpenExchangeRate missing rate for ${quote}`);
  return { base, quote, price: rate, provider: "open.er-api.com", timestamp: now() };
};

// Legacy fallback (requires API key now)
const fetchFxFromExchangeRateHost = async (base: string, quote: string): Promise<FxPrice> => {
  const url = `https://api.exchangerate.host/convert?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
  const res = await safeFetch<{ result?: number; info?: { rate?: number } }>(url, { timeoutMs: 4000 });
  const rate = Number(res?.result ?? res?.info?.rate);
  if (!Number.isFinite(rate)) throw new Error("ExchangeRateHost missing rate");
  return { base, quote, price: rate, provider: "exchangerate.host", timestamp: now() };
};

const buildMetalApiUrl = (symbol: string): string => {
  if (process.env.METALS_DEV_KEY) {
    return `https://api.metals.dev/v1/latest?api_key=${process.env.METALS_DEV_KEY}&symbols=${symbol}`;
  }
  if (process.env.METALS_API_KEY) {
    return `https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY}&base=USD&symbols=${symbol}`;
  }
  if (process.env.METALPRICEAPI_KEY) {
    return `https://api.metalpriceapi.com/v1/latest?api_key=${process.env.METALPRICEAPI_KEY}&base=USD&currencies=${symbol}`;
  }
  return `https://www.goldapi.io/api/${symbol}/USD`;
};

const fetchMetalFromMetalsDev = async (symbol: string): Promise<MetalPrice> => {
  const key = process.env.METALS_DEV_KEY || process.env.METALS_API_KEY || process.env.METALPRICEAPI_KEY || process.env.GOLDAPI_KEY;
  if (!key) throw new Error("Metal API key missing");
  const url = buildMetalApiUrl(symbol);

  const res = await safeFetch<any>(url, { timeoutMs: 4500 });
  const rate =
    res?.data?.[symbol]?.price ??
    res?.rates?.[symbol] ??
    res?.price ??
    res?.[symbol] ??
    res?.[`${symbol}USD`] ??
    res?.[symbol.toLowerCase()];
  const price = Number(rate);
  if (!Number.isFinite(price)) throw new Error("Metal price missing");
  return { symbol, price, provider: "metals", timestamp: now() };
};

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const val = query?.[key];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
};

export default async function handler(req: Req, res: Res) {
  try {
    const assetParamRaw = getQueryParam(req.query, "asset");
    const assetParam = assetParamRaw?.toUpperCase?.();

    const supportedAssets = ["BTCUSD", "BTCUSDT", "EURUSD", "XAUUSD"];
    if (!assetParam || !supportedAssets.includes(assetParam)) {
      return res.status(400).json({
        ok: false,
        status: "error",
        error: "Invalid or missing asset. Supported: BTCUSD, BTCUSDT, EURUSD, XAUUSD",
      });
    }

    const rateKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`price:${rateKey}`)) {
      return res.status(429).json({
        ok: false,
        status: "rate_limited",
        error: "Rate limited. Slow down requests.",
      });
    }

    // Fast-path for required assets
    if (assetParam.startsWith("BTC")) {
      try {
        const btc = await fetchBtcUsd();
        return res.status(200).json({
          ok: true,
          status: "ok",
          data: { asset: "BTCUSD", value: btc.price, ts: btc.timestamp, source: btc.source },
        });
      } catch (err: unknown) {
        console.error("[price] btc fetch error", err);
        return res.status(502).json({
          ok: false,
          status: "error",
          error: (err as Error)?.message || "BTC price fetch failed",
        });
      }
    }

    if (assetParam === "EURUSD") {
      try {
        // Try free open.er-api.com first
        let fx: FxPrice;
        try {
          fx = await fetchFxFromOpenExchangeRate("EUR", "USD");
        } catch {
          // Fallback to exchangerate.host (may require API key)
          fx = await fetchFxFromExchangeRateHost("EUR", "USD");
        }
        if (!Number.isFinite(fx.price)) throw new Error("Invalid FX price");
        return res.status(200).json({
          ok: true,
          status: "ok",
          data: { asset: "EURUSD", value: fx.price, ts: fx.timestamp, source: fx.provider },
        });
      } catch (err: unknown) {
        console.error("[price] fx fetch error", err);
        return res.status(502).json({
          ok: false,
          status: "error",
          error: (err as Error)?.message || "FX price fetch failed",
        });
      }
    }

    if (assetParam === "XAUUSD") {
      try {
        if (!process.env.METALS_DEV_KEY && !process.env.METALS_API_KEY && !process.env.METALPRICEAPI_KEY && !process.env.GOLDAPI_KEY) {
          return res.status(500).json({
            ok: false,
            status: "error",
            error: "Missing metals API key",
          });
        }
        const metal = await fetchMetalFromMetalsDev("XAU");
        if (!Number.isFinite(metal.price)) throw new Error("Invalid metal price");
        return res.status(200).json({
          ok: true,
          status: "ok",
          data: { asset: "XAUUSD", value: metal.price, ts: metal.timestamp, source: metal.provider },
        });
      } catch (err: unknown) {
        console.error("[price] metal fetch error", err);
        return res.status(502).json({
          ok: false,
          status: "error",
          error: (err as Error)?.message || "Metal price fetch failed",
        });
      }
    }

    // For unsupported assets, return error
    return res.status(400).json({
      ok: false,
      status: "error",
      error: `Asset ${assetParam} not supported yet`,
    });
  } catch (error) {
    console.error("[price] handler error", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      error: (error as Error)?.message || "Internal error",
    });
  }
}