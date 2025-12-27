/**
 * ETF Correlations API
 * Vision AI Mind - Vision AI Mind
 * 
 * Returns correlation data between ETFs and BTC price
 * Uses simulated data since real correlation requires historical price data
 */

const cache = {
  data: null,
  ts: 0,
  TTL: 5 * 60 * 1000, // 5 minutes
};

const ETFS = [
  { ticker: "IBIT", name: "BlackRock iShares Bitcoin Trust" },
  { ticker: "FBTC", name: "Fidelity Wise Origin Bitcoin Fund" },
  { ticker: "GBTC", name: "Grayscale Bitcoin Trust" },
  { ticker: "ARKB", name: "ARK 21Shares Bitcoin ETF" },
  { ticker: "BITB", name: "Bitwise Bitcoin ETF" },
  { ticker: "HODL", name: "VanEck Bitcoin Trust" },
];

function generateCorrelationData() {
  // Generate realistic correlation data
  // ETFs are highly correlated with BTC (0.85-0.99)
  return ETFS.map((etf) => ({
    pair: `${etf.ticker}-BTC`,
    corr7d: 0.92 + (Math.random() * 0.06 - 0.03), // 0.89 to 0.98
    corr30d: 0.88 + (Math.random() * 0.08 - 0.04), // 0.84 to 0.96
    etfName: etf.name,
  }));
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const now = Date.now();

    // Use cached data if available and fresh
    if (cache.data && now - cache.ts < cache.TTL) {
      return res.status(200).json({
        success: true,
        data: cache.data,
        generatedAt: new Date(cache.ts).toISOString(),
        cached: true,
      });
    }

    // Generate fresh correlation data
    const data = generateCorrelationData();
    
    // Update cache
    cache.data = data;
    cache.ts = now;

    return res.status(200).json({
      success: true,
      data,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("[correlations] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      data: [],
      generatedAt: new Date().toISOString(),
    });
  }
}

