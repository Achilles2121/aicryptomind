/**
 * Real-Time Sentiment API
 * Vision AI Mind - Vision AI Mind
 * 
 * Combines multiple data sources for real-time market sentiment:
 * - Binance Futures Long/Short Ratio (5-minute updates)
 * - Binance Open Interest
 * - Alternative.me Fear & Greed (daily baseline)
 * 
 * Returns a hybrid sentiment score updated every 5 minutes
 */

// ============================================
// TYPES
// ============================================

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

interface SentimentData {
  // Real-time from Binance
  longShortRatio: number;
  longPercent: number;
  shortPercent: number;
  topTraderLongShortRatio: number;
  openInterest: number;
  openInterestChange: number;
  
  // Calculated real-time sentiment (0-100)
  realTimeSentiment: number;
  realTimeSentimentLabel: string;
  
  // Daily Fear & Greed from Alternative.me
  dailyFearGreed: number;
  dailyFearGreedLabel: string;
  
  // Combined score
  combinedScore: number;
  combinedLabel: string;
  
  // Meta
  timestamp: number;
  provider: string;
  nextUpdate: number;
}

// ============================================
// CACHE
// ============================================

interface CacheEntry {
  data: SentimentData;
  expires: number;
}

let sentimentCache: CacheEntry | null = null;
const CACHE_TTL = 30000; // 30 seconds

function getCached(): SentimentData | null {
  if (sentimentCache && Date.now() < sentimentCache.expires) {
    return sentimentCache.data;
  }
  return null;
}

function setCache(data: SentimentData): SentimentData {
  sentimentCache = { data, expires: Date.now() + CACHE_TTL };
  return data;
}

// ============================================
// FETCH UTILITIES
// ============================================

async function safeFetch<T>(url: string, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "VisionAIMind/2.0"
      },
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

// ============================================
// BINANCE FUTURES DATA
// ============================================

interface BinanceLongShortRatio {
  symbol: string;
  longAccount: string;
  shortAccount: string;
  longShortRatio: string;
  timestamp: number;
}

interface BinanceOpenInterest {
  symbol: string;
  openInterest: string;
  time: number;
}

async function fetchBinanceLongShort(symbol = "BTCUSDT"): Promise<{
  longShortRatio: number;
  longPercent: number;
  shortPercent: number;
  timestamp: number;
}> {
  const data = await safeFetch<BinanceLongShortRatio[]>(
    `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`
  );
  
  const latest = data[0];
  return {
    longShortRatio: parseFloat(latest.longShortRatio),
    longPercent: parseFloat(latest.longAccount) * 100,
    shortPercent: parseFloat(latest.shortAccount) * 100,
    timestamp: latest.timestamp,
  };
}

async function fetchTopTraderRatio(symbol = "BTCUSDT"): Promise<number> {
  const data = await safeFetch<BinanceLongShortRatio[]>(
    `https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=5m&limit=1`
  );
  return parseFloat(data[0].longShortRatio);
}

async function fetchOpenInterest(symbol = "BTCUSDT"): Promise<{
  openInterest: number;
  timestamp: number;
}> {
  const data = await safeFetch<BinanceOpenInterest>(
    `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`
  );
  return {
    openInterest: parseFloat(data.openInterest),
    timestamp: data.time,
  };
}

// ============================================
// ALTERNATIVE.ME FEAR & GREED
// ============================================

interface AlternativeFNG {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update: string;
  }>;
}

async function fetchDailyFearGreed(): Promise<{
  value: number;
  label: string;
  nextUpdate: number;
}> {
  try {
    const data = await safeFetch<AlternativeFNG>(
      "https://api.alternative.me/fng/?limit=1&format=json"
    );
    const item = data.data[0];
    return {
      value: parseInt(item.value, 10),
      label: item.value_classification,
      nextUpdate: parseInt(item.time_until_update, 10),
    };
  } catch {
    // Fallback if API fails
    return { value: 50, label: "Neutral", nextUpdate: 0 };
  }
}

// ============================================
// SENTIMENT CALCULATION
// ============================================

function calculateRealTimeSentiment(longShortRatio: number): {
  score: number;
  label: string;
} {
  // Long/Short Ratio to Sentiment (0-100)
  // Ratio 0.5 (33% long) = Fear (25)
  // Ratio 1.0 (50% long) = Neutral (50)
  // Ratio 2.0 (67% long) = Greed (75)
  // Ratio 3.0+ (75%+ long) = Extreme Greed (90+)
  
  let score: number;
  
  if (longShortRatio <= 0.5) {
    // Extreme Fear: 0-20
    score = Math.max(0, longShortRatio * 40);
  } else if (longShortRatio <= 1.0) {
    // Fear to Neutral: 20-50
    score = 20 + (longShortRatio - 0.5) * 60;
  } else if (longShortRatio <= 2.0) {
    // Neutral to Greed: 50-75
    score = 50 + (longShortRatio - 1.0) * 25;
  } else if (longShortRatio <= 3.0) {
    // Greed to Extreme Greed: 75-90
    score = 75 + (longShortRatio - 2.0) * 15;
  } else {
    // Extreme Greed: 90-100
    score = Math.min(100, 90 + (longShortRatio - 3.0) * 5);
  }
  
  score = Math.round(score);
  
  let label: string;
  if (score <= 20) label = "Extreme Fear";
  else if (score <= 40) label = "Fear";
  else if (score <= 60) label = "Neutral";
  else if (score <= 80) label = "Greed";
  else label = "Extreme Greed";
  
  return { score, label };
}

function getCombinedLabel(score: number): string {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: Req, res: Res) {
  // CORS
  res.setHeader?.("Access-Control-Allow-Origin", "*");
  res.setHeader?.("Access-Control-Allow-Methods", "GET, OPTIONS");
  
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }
  
  try {
    // Check cache first
    const cached = getCached();
    if (cached) {
      return res.status(200).json({
        ok: true,
        status: "cached",
        data: cached,
      });
    }
    
    // Fetch all data in parallel
    const [longShort, topTrader, openInterest, dailyFNG] = await Promise.all([
      fetchBinanceLongShort(),
      fetchTopTraderRatio(),
      fetchOpenInterest(),
      fetchDailyFearGreed(),
    ]);
    
    // Calculate real-time sentiment
    const realTime = calculateRealTimeSentiment(longShort.longShortRatio);
    
    // Combined score: 60% real-time + 40% daily
    const combinedScore = Math.round(realTime.score * 0.6 + dailyFNG.value * 0.4);
    
    const sentimentData: SentimentData = {
      // Binance real-time
      longShortRatio: longShort.longShortRatio,
      longPercent: longShort.longPercent,
      shortPercent: longShort.shortPercent,
      topTraderLongShortRatio: topTrader,
      openInterest: openInterest.openInterest,
      openInterestChange: 0, // Would need historical data
      
      // Real-time sentiment
      realTimeSentiment: realTime.score,
      realTimeSentimentLabel: realTime.label,
      
      // Daily Fear & Greed
      dailyFearGreed: dailyFNG.value,
      dailyFearGreedLabel: dailyFNG.label,
      
      // Combined
      combinedScore,
      combinedLabel: getCombinedLabel(combinedScore),
      
      // Meta
      timestamp: Date.now(),
      provider: "binance+alternative.me",
      nextUpdate: dailyFNG.nextUpdate,
    };
    
    // Cache and return
    setCache(sentimentData);
    
    return res.status(200).json({
      ok: true,
      status: "ok",
      data: sentimentData,
    });
    
  } catch (error) {
    console.error("[sentiment] handler error:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      error: (error as Error)?.message || "Failed to fetch sentiment data",
    });
  }
}

