/**
 * /api/forex - Forex, Index & Commodity Prices via Yahoo Finance
 * Vision AI Mind - Vercel Serverless Function
 */

const YAHOO_SYMBOLS = {
  // Forex
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  // Indices
  DAX: "^GDAXI",
  "S&P500": "^GSPC",
  SP500: "^GSPC",
  NASDAQ: "^IXIC",
  // Commodities
  GOLD: "GC=F",
  XAUUSD: "GC=F",
  OIL: "CL=F",
  WTI: "CL=F",
  SILVER: "SI=F",
  XAGUSD: "SI=F",
};

const cache = new Map();
const CACHE_TTL = 60_000; // 60 seconds

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
  // Evict old entries if cache grows too large
  if (cache.size > 50) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return data;
}

export default async function handler(req, res) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  }

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  try {
    const assetParam = String(
      req.query?.asset || req.query?.symbol || "EURUSD"
    ).toUpperCase().replace(/[^A-Z0-9&]/g, "");

    const yahooSymbol = YAHOO_SYMBOLS[assetParam];
    if (!yahooSymbol) {
      return res.status(400).json({
        ok: false,
        error: `Unsupported asset: ${assetParam}. Supported: ${Object.keys(YAHOO_SYMBOLS).join(", ")}`,
      });
    }

    // Check cache
    const cacheKey = `forex:${assetParam}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({ ok: true, ...cached, cached: true });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const encoded = encodeURIComponent(yahooSymbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2d`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Yahoo HTTP ${response.status}`);
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      throw new Error("No Yahoo data");
    }

    const meta = result.meta || {};
    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    const payload = {
      symbol: assetParam,
      yahooSymbol,
      price,
      change24h: Math.round(change24h * 100) / 100,
      prevClose,
      currency: meta.currency || "USD",
      exchangeName: meta.exchangeName || "",
      ts: Date.now(),
    };

    setCache(cacheKey, payload);

    return res.status(200).json({ ok: true, ...payload, cached: false });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err?.message || "Failed to fetch forex/commodity data",
      ts: Date.now(),
    });
  }
}
