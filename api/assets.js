/**
 * /api/assets - Top 100 Crypto Assets from CoinGecko
 * Vision AI Mind - Vercel Serverless Function
 */

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h";

let cachedData = null;
let cacheTs = 0;
const CACHE_TTL = 300_000; // 5 minutes

export default async function handler(req, res) {
  // CORS
  if (typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
  }

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  // Serve from memory cache
  if (cachedData && Date.now() - cacheTs < CACHE_TTL) {
    return res.status(200).json({ ok: true, assets: cachedData, ts: cacheTs, cached: true });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(COINGECKO_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "VisionAIMind/2.0",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`CoinGecko HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("CoinGecko returned empty data");
    }

    // Normalize response
    const assets = data.map((coin) => ({
      id: coin.id,
      symbol: String(coin.symbol || "").toUpperCase(),
      name: coin.name,
      image: coin.image,
      current_price: coin.current_price,
      price: coin.current_price,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      change24h: coin.price_change_percentage_24h,
      market_cap: coin.market_cap,
      marketCap: coin.market_cap,
      total_volume: coin.total_volume,
      market_cap_rank: coin.market_cap_rank,
    }));

    cachedData = assets;
    cacheTs = Date.now();

    return res.status(200).json({ ok: true, assets, ts: cacheTs, cached: false });
  } catch (err) {
    clearTimeout(timeout);

    // Serve stale cache if available
    if (cachedData) {
      return res.status(200).json({
        ok: true,
        assets: cachedData,
        ts: cacheTs,
        cached: true,
        stale: true,
      });
    }

    return res.status(502).json({
      ok: false,
      error: err?.message || "Failed to fetch assets",
      assets: [],
      ts: Date.now(),
    });
  }
}
