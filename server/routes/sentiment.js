import { Router } from "express";
import { withCache } from "../utils/cache.js";

const router = Router();
const CACHE_TTL = 30000; // 30 seconds

// Binance Futures API endpoints
const BINANCE_FUTURES = "https://fapi.binance.com";
const FEAR_GREED_API = "https://api.alternative.me/fng/";

router.get("/", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  
  const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
  
  try {
    const data = await withCache(`sentiment:${symbol}`, CACHE_TTL, async () => {
      // Fetch all data in parallel
      const [longShortRes, topTraderRes, oiRes, fearGreedRes] = await Promise.allSettled([
        // Global Long/Short Ratio
        fetch(`${BINANCE_FUTURES}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`, {
          signal: AbortSignal.timeout(5000),
        }),
        // Top Trader Long/Short Ratio
        fetch(`${BINANCE_FUTURES}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`, {
          signal: AbortSignal.timeout(5000),
        }),
        // Open Interest
        fetch(`${BINANCE_FUTURES}/fapi/v1/openInterest?symbol=${symbol}`, {
          signal: AbortSignal.timeout(5000),
        }),
        // Fear & Greed Index
        fetch(FEAR_GREED_API, {
          signal: AbortSignal.timeout(5000),
        }),
      ]);
      
      let longShortRatio = 1.0;
      let longPercent = 50;
      let shortPercent = 50;
      let topTraderLongShortRatio = 1.0;
      let openInterest = 0;
      let dailyFearGreed = 50;
      let dailyFearGreedLabel = "Neutral";
      
      // Parse Long/Short Ratio
      if (longShortRes.status === "fulfilled" && longShortRes.value.ok) {
        try {
          const lsData = await longShortRes.value.json();
          if (lsData?.[0]) {
            longShortRatio = parseFloat(lsData[0].longShortRatio) || 1.0;
            longPercent = (longShortRatio / (1 + longShortRatio)) * 100;
            shortPercent = 100 - longPercent;
          }
        } catch {}
      }
      
      // Parse Top Trader Ratio
      if (topTraderRes.status === "fulfilled" && topTraderRes.value.ok) {
        try {
          const ttData = await topTraderRes.value.json();
          if (ttData?.[0]) {
            topTraderLongShortRatio = parseFloat(ttData[0].longShortRatio) || 1.0;
          }
        } catch {}
      }
      
      // Parse Open Interest
      if (oiRes.status === "fulfilled" && oiRes.value.ok) {
        try {
          const oiData = await oiRes.value.json();
          openInterest = parseFloat(oiData?.openInterest) || 0;
        } catch {}
      }
      
      // Parse Fear & Greed
      if (fearGreedRes.status === "fulfilled" && fearGreedRes.value.ok) {
        try {
          const fgData = await fearGreedRes.value.json();
          if (fgData?.data?.[0]) {
            dailyFearGreed = parseInt(fgData.data[0].value) || 50;
            dailyFearGreedLabel = fgData.data[0].value_classification || "Neutral";
          }
        } catch {}
      }
      
      // Calculate real-time sentiment (0-100)
      // Formula: Weighted average of long/short ratios
      const lsScore = Math.min(100, Math.max(0, longPercent));
      const ttScore = Math.min(100, Math.max(0, (topTraderLongShortRatio / (1 + topTraderLongShortRatio)) * 100));
      const realTimeSentiment = Math.round(lsScore * 0.6 + ttScore * 0.4);
      
      const realTimeSentimentLabel = 
        realTimeSentiment >= 70 ? "Extreme Greed" :
        realTimeSentiment >= 55 ? "Greed" :
        realTimeSentiment >= 45 ? "Neutral" :
        realTimeSentiment >= 30 ? "Fear" : "Extreme Fear";
      
      // Combined score (50% real-time + 50% daily)
      const combinedScore = Math.round(realTimeSentiment * 0.5 + dailyFearGreed * 0.5);
      const combinedLabel = 
        combinedScore >= 70 ? "Extreme Greed" :
        combinedScore >= 55 ? "Greed" :
        combinedScore >= 45 ? "Neutral" :
        combinedScore >= 30 ? "Fear" : "Extreme Fear";
      
      return {
        longShortRatio,
        longPercent: Math.round(longPercent * 100) / 100,
        shortPercent: Math.round(shortPercent * 100) / 100,
        topTraderLongShortRatio,
        openInterest,
        openInterestChange: 0,
        realTimeSentiment,
        realTimeSentimentLabel,
        dailyFearGreed,
        dailyFearGreedLabel,
        combinedScore,
        combinedLabel,
        timestamp: Date.now(),
        provider: "binance+alternative.me",
        nextUpdate: Date.now() + CACHE_TTL,
      };
    });
    
    return res.status(200).json({
      ok: true,
      data,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[sentiment] Error:", err.message);
    
    // Return fallback data
    return res.status(200).json({
      ok: true,
      data: {
        longShortRatio: 1.0,
        longPercent: 50,
        shortPercent: 50,
        topTraderLongShortRatio: 1.0,
        openInterest: 0,
        openInterestChange: 0,
        realTimeSentiment: 50,
        realTimeSentimentLabel: "Neutral",
        dailyFearGreed: 50,
        dailyFearGreedLabel: "Neutral",
        combinedScore: 50,
        combinedLabel: "Neutral",
        timestamp: Date.now(),
        provider: "fallback",
        nextUpdate: Date.now() + CACHE_TTL,
      },
      generatedAt: new Date().toISOString(),
    });
  }
});

export default router;
