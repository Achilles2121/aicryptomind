import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import supportedCoins, {
  SUPPORTED_COIN_IDS,
  SUPPORTED_SYMBOLS,
  formatMarketId,
  formatTradingViewSymbol,
  GOLD_FOREX_ASSETS,
  getAssetClass,
  getTradingViewSymbol,
} from "./src/config/supportedCoins.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// GOLD & FOREX PRICE CONFIGURATION
// TwelveData Free Tier: 800 requests/day
// Yahoo Finance as fallback (free, no API key)
// ============================================

// Static fallback prices (used if all APIs fail)
const GOLD_FOREX_FALLBACK = {
  XAUUSD: { price: 2650, change24h: 0.45, name: "Gold / US Dollar" },
  XAGUSD: { price: 31.50, change24h: 0.78, name: "Silver / US Dollar" },
  EURUSD: { price: 1.0850, change24h: -0.12, name: "Euro / US Dollar" },
  GBPUSD: { price: 1.2650, change24h: 0.08, name: "British Pound / US Dollar" },
  USDJPY: { price: 154.50, change24h: 0.22, name: "US Dollar / Japanese Yen" },
};

// Live price cache (5 minute TTL)
const priceCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// TwelveData symbol mapping
const TWELVEDATA_SYMBOLS = {
  XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
};

// Yahoo Finance symbol mapping
const YAHOO_SYMBOLS = {
  XAUUSD: "GC=F", // Gold futures
  XAGUSD: "SI=F", // Silver futures
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
};

// Fetch real-time price from TwelveData (free tier: 800/day)
async function fetchTwelveDataPrice(symbol) {
  const apiKey = process.env.TWELVEDATA_API_KEY || "demo"; // Use "demo" for testing
  const tdSymbol = TWELVEDATA_SYMBOLS[symbol];
  if (!tdSymbol) return null;

  try {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(tdSymbol)}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.price) {
      return { price: parseFloat(data.price), source: "twelvedata" };
    }
  } catch (err) {
    console.warn(`TwelveData fetch failed for ${symbol}:`, err.message);
  }
  return null;
}

// Fetch from Yahoo Finance (free, no API key)
async function fetchYahooFinancePrice(symbol) {
  const ySymbol = YAHOO_SYMBOLS[symbol];
  if (!ySymbol) return null;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=1d&range=2d`;
    const res = await fetch(url, { 
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const quote = data?.chart?.result?.[0]?.meta;
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    
    if (quote?.regularMarketPrice) {
      const prevClose = closes?.[closes.length - 2] || quote.chartPreviousClose || quote.previousClose;
      const currentPrice = quote.regularMarketPrice;
      const change24h = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0;
      return { 
        price: currentPrice, 
        change24h: parseFloat(change24h.toFixed(2)),
        source: "yahoo" 
      };
    }
  } catch (err) {
    console.warn(`Yahoo Finance fetch failed for ${symbol}:`, err.message);
  }
  return null;
}

// Get live Gold/Forex price with caching
async function getLiveGoldForexPrice(symbol) {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return cached;
  }

  // Try TwelveData first, then Yahoo Finance, then fallback
  let priceData = await fetchTwelveDataPrice(symbol);
  if (!priceData) {
    priceData = await fetchYahooFinancePrice(symbol);
  }
  
  if (priceData) {
    const fallback = GOLD_FOREX_FALLBACK[symbol];
    const result = {
      price: priceData.price,
      change24h: priceData.change24h ?? fallback?.change24h ?? 0,
      source: priceData.source,
      updatedAt: Date.now(),
    };
    priceCache.set(symbol, result);
    return result;
  }

  // Use fallback with small jitter
  const fallback = GOLD_FOREX_FALLBACK[symbol];
  if (fallback) {
    const jitter = (Math.random() - 0.5) * 0.002;
    return {
      price: fallback.price * (1 + jitter),
      change24h: fallback.change24h,
      source: "fallback",
      updatedAt: Date.now(),
    };
  }
  return null;
}

// ============================================
// MIDDLEWARE
// ============================================

// CORS - Allow Vite dev server and production domains
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    /\.vercel\.app$/,
    /\.vision-ai\.app$/,
  ],
  credentials: true,
}));

// Increase URL/query string limit for large coin ID lists
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[Error Handler]", err?.message || err);
  res.status(200).json({ 
    ok: false, 
    error: "Internal server error", 
    fallback: true,
    data: [] 
  });
});

// Health check endpoint
app.get("/api/health", async (_req, res) => {
  const checks = {
    server: true,
    coingecko: false,
    binance: false,
    sentiment: false,
  };
  
  // Check CoinGecko
  try {
    const cgRes = await fetch("https://api.coingecko.com/api/v3/ping", { 
      signal: AbortSignal.timeout(3000) 
    });
    checks.coingecko = cgRes.ok;
  } catch { checks.coingecko = false; }
  
  // Check Binance
  try {
    const bnRes = await fetch("https://api.binance.com/api/v3/ping", { 
      signal: AbortSignal.timeout(3000) 
    });
    checks.binance = bnRes.ok;
  } catch { checks.binance = false; }
  
  // Check Sentiment API
  try {
    const sentRes = await fetch("https://api.alternative.me/fng/?limit=1", { 
      signal: AbortSignal.timeout(3000) 
    });
    checks.sentiment = sentRes.ok;
  } catch { checks.sentiment = false; }
  
  const allHealthy = Object.values(checks).every(Boolean);
  
  res.json({
    ok: true,
    status: allHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    coins: COIN_META.length,
    goldForex: GOLD_FOREX_ASSETS.length,
    version: "2.3.0",
    checks,
  });
});

// Request logging middleware
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

const COIN_META = supportedCoins.map((coin) => ({
  id: coin.id,
  symbol: coin.symbol.toUpperCase(),
  name: coin.name,
  rank: coin.rank,
}));

const COIN_BY_ID = new Map(COIN_META.map((coin) => [coin.id, coin]));
const COIN_BY_SYMBOL = new Map(COIN_META.map((coin) => [coin.symbol.toUpperCase(), coin]));

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "DAI", "USDS", "USDE", "SUSDS", "SUSDE", "USD1", "PYUSD", "USDT0"]);
const PRICE_HINTS = {
  BTC: 43000,
  ETH: 2400,
  SOL: 150,
  BNB: 320,
  XRP: 0.58,
  ADA: 0.48,
  DOGE: 0.08,
  AVAX: 38,
  DOT: 7.2,
  LINK: 15,
  LTC: 70,
  BCH: 260,
  TRX: 0.11,
  TON: 2.4,
  SHIB: 0.00001,
  MATIC: 0.9,
  NEAR: 3.2,
  OP: 2.1,
  ARB: 1.6,
  HBAR: 0.07,
  UNI: 7.4,
  CRO: 0.11,
  XMR: 170,
  XAUT: 2300,
  WBTC: 43000,
  WETH: 2400,
  STETH: 2400,
  WSTETH: 2400,
  WBETH: 2400,
  WEETH: 2400,
  CBBTC: 43000,
  SUI: 1.1,
  HYPE: 7.5,
  MNT: 0.6,
  WLFI: 0.12,
  CANT: 0.45,
  RAIN: 0.18,
  BGB: 0.85,
  USDT: 1,
  USDC: 1,
  DAI: 1,
  USDS: 1,
  USDE: 1,
  SUSDS: 1,
  SUSDE: 1,
  USD1: 1,
  PYUSD: 1,
  USDT0: 1,
};

const safeNumber = (value) => Number(value) || 0;
const safeFixed = (val, digits = 2) => (Number(val) || 0).toFixed(digits);
const normalizeAssetKey = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const buildIcon = (symbol) => {
  const label = symbol.toUpperCase().slice(0, 4);
  const hue = hashString(symbol) % 360;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},70%,45%)'/><stop offset='1' stop-color='hsl(${(hue + 40) % 360},70%,55%)'/></linearGradient></defs><rect width='96' height='96' rx='18' fill='url(#g)'/><text x='50%' y='54%' text-anchor='middle' font-size='28' font-family='Arial' fill='white' font-weight='700'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const resolveMeta = (idOrSymbol) => {
  if (!idOrSymbol) return null;
  const asId = String(idOrSymbol).toLowerCase();
  if (COIN_BY_ID.has(asId)) return COIN_BY_ID.get(asId);
  const symbolKey = normalizeAssetKey(idOrSymbol);
  return COIN_BY_SYMBOL.get(symbolKey) || null;
};

const resolveSupportedSymbol = (value) => {
  if (!value) return "BTC";
  const idKey = String(value).toLowerCase();
  if (COIN_BY_ID.has(idKey)) return COIN_BY_ID.get(idKey).symbol.toUpperCase();
  const normalized = normalizeAssetKey(value);
  if (!normalized) return "BTC";
  if (SUPPORTED_SYMBOLS.has(normalized)) return normalized;
  const base = normalized.replace(/USDT?$/, "").replace(/USD$/, "");
  if (SUPPORTED_SYMBOLS.has(base)) return base;
  return "BTC";
};

const computePrice = (symbol, seed) => {
  const hint = PRICE_HINTS[symbol];
  const base = Number.isFinite(hint) ? hint : STABLE_SYMBOLS.has(symbol) ? 1 : Math.max(0.01, (seed % 50000) / 100);
  const jitter = (seed % 200 - 100) / 5000;
  const price = base * (1 + jitter);
  return Number(safeFixed(price, 2));
};

const computeMarketCap = (price, symbol, seed) => {
  const supply = STABLE_SYMBOLS.has(symbol)
    ? 1e9 + (seed % 5e9)
    : price >= 1000
    ? 1e7 + (seed % 2e7)
    : 5e7 + (seed % 3e8);
  return Math.round(price * supply);
};

const computeChange24h = (seed) => Number(safeFixed(Number((seed % 1600) / 100 - 8) || 0, 2));

const buildFallbackCoin = (meta) => {
  const seed = hashString(meta.id);
  const symbol = meta.symbol.toUpperCase();
  const currentPrice = computePrice(symbol, seed);
  const change24h = computeChange24h(seed);
  const assetId = formatMarketId(symbol);
  return {
    id: meta.id,
    symbol,
    name: meta.name,
    rank: meta.rank,
    assetId,
    tvSymbol: formatTradingViewSymbol(symbol),
    image: buildIcon(symbol),
    current_price: currentPrice,
    market_cap: computeMarketCap(currentPrice, symbol, seed),
    price_change_percentage_24h: change24h,
    price: currentPrice,
    change24h,
  };
};

const COINGECKO_ENDPOINT = "https://api.coingecko.com/api/v3/coins/markets";
const fetchCoinGeckoCoins = async (ids) => {
  if (!ids.length || typeof fetch !== "function") return null;
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: ids.join(","),
    price_change_percentage: "24h",
  });
  const response = await fetch(`${COINGECKO_ENDPOINT}?${params.toString()}`, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`CoinGecko HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload)) return null;
  return payload;
};

const buildLiveCoin = (meta, live) => {
  const symbol = meta.symbol.toUpperCase();
  const assetId = formatMarketId(symbol);
  const currentPrice = safeNumber(live?.current_price);
  const marketCap = safeNumber(live?.market_cap);
  const change24h = safeNumber(live?.price_change_percentage_24h);
  return {
    id: meta.id,
    symbol,
    name: meta.name,
    rank: meta.rank,
    assetId,
    tvSymbol: formatTradingViewSymbol(symbol),
    image: live?.image || buildIcon(symbol),
    current_price: currentPrice,
    market_cap: marketCap,
    price_change_percentage_24h: change24h,
    price: currentPrice,
    change24h,
  };
};

app.get("/api/coins", async (req, res) => {
  const idsParam = String(req.query.ids || "");
  const requested = idsParam
    ? idsParam
        .split(",")
        .map((id) => String(id).trim().toLowerCase())
        .filter(Boolean)
    : [];
  const filtered = requested.length
    ? requested.filter((id) => SUPPORTED_COIN_IDS.has(id))
    : COIN_META.map((coin) => coin.id);

  const ids = filtered.length ? filtered : COIN_META.map((coin) => coin.id);

  try {
    const live = await fetchCoinGeckoCoins(ids);
    if (live?.length) {
      const liveMap = new Map(live.map((coin) => [coin.id, coin]));
      const data = COIN_META.filter((coin) => ids.includes(coin.id)).map((meta) => buildLiveCoin(meta, liveMap.get(meta.id)));
      res.json({ success: true, data, timestamp: new Date().toISOString(), source: "coingecko" });
      return;
    }
  } catch (error) {
    console.warn("[api/coins] fallback:", error?.message || error);
  }

  const data = COIN_META.filter((coin) => ids.includes(coin.id)).map((meta) => buildFallbackCoin(meta));
  res.json({ success: true, data, timestamp: new Date().toISOString(), source: "fallback" });
});

app.get("/api/ohlc", (req, res) => {
  const limit = Math.max(10, Math.min(Number(req.query.limit) || 48, 400));
  const interval = Math.max(1, Math.min(Number(req.query.interval) || 60, 1440));
  const asset = String(req.query.asset || "BTCUSD");
  const symbol = resolveSupportedSymbol(asset);
  const meta = resolveMeta(symbol) || COIN_BY_ID.get("bitcoin");
  const seed = hashString(meta?.id || symbol);
  const basePrice = computePrice(meta?.symbol?.toUpperCase() || symbol || "BTC", seed);
  const now = Date.now();
  const step = interval * 60 * 1000;
  const data = Array.from({ length: limit }, (_, idx) => {
    const t = now - (limit - idx) * step;
    const wave = Math.sin((seed + idx) / 5) * basePrice * 0.004;
    const drift = (idx - limit / 2) * basePrice * 0.0002;
    const c = Number(safeFixed(Number(basePrice + wave + drift) || 0, 2));
    const o = Number(safeFixed(Number(c - basePrice * 0.0015) || 0, 2));
    const h = Number(safeFixed(Number(c + basePrice * 0.002) || 0, 2));
    const l = Number(safeFixed(Number(c - basePrice * 0.0025) || 0, 2));
    return { t, o, h, l, c, v: Math.round(100 + idx * 3) };
  });
  res.json({ ok: true, data });
});

app.get("/api/price", async (req, res) => {
  const asset = String(req.query.asset || req.query.symbol || "BTCUSD");
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Check if Gold/Forex asset - fetch live price
  if (GOLD_FOREX_FALLBACK[normalized]) {
    try {
      const liveData = await getLiveGoldForexPrice(normalized);
      const price = liveData?.price || GOLD_FOREX_FALLBACK[normalized]?.price || 0;
      const change24h = liveData?.change24h ?? GOLD_FOREX_FALLBACK[normalized]?.change24h ?? 0;
      return res.json({
        ok: true,
        data: {
          symbol: normalized,
          value: Number(price.toFixed(normalized.includes("JPY") ? 2 : 4)),
          change24h,
          source: liveData?.source || "fallback",
          assetClass: normalized.startsWith("XA") ? "commodity" : "forex",
          tradingViewSymbol: getTradingViewSymbol(normalized),
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("Price API Gold/Forex error:", err);
    }
  }
  
  // Crypto asset
  const symbol = resolveSupportedSymbol(asset);
  const meta = resolveMeta(symbol) || COIN_BY_ID.get("bitcoin");
  const seed = hashString(meta?.id || symbol);
  const value = computePrice(symbol, seed);
  const change24h = computeChange24h(seed);
  res.json({
    ok: true,
    data: {
      symbol,
      value,
      change24h,
      source: "mock",
      assetClass: "crypto",
      tradingViewSymbol: formatTradingViewSymbol(symbol),
      updatedAt: new Date().toISOString(),
    },
  });
});

// ============================================
// GOLD & FOREX DEDICATED ENDPOINTS (Real-time via TwelveData/Yahoo)
// ============================================

app.get("/api/gold", async (_req, res) => {
  try {
    const commodities = GOLD_FOREX_ASSETS.filter((a) => a.assetClass === "commodity");
    const data = await Promise.all(
      commodities.map(async (asset) => {
        const liveData = await getLiveGoldForexPrice(asset.symbol);
        return {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          price: liveData?.price || GOLD_FOREX_FALLBACK[asset.symbol]?.price || 0,
          change24h: liveData?.change24h ?? GOLD_FOREX_FALLBACK[asset.symbol]?.change24h ?? 0,
          tradingViewSymbol: asset.tradingViewSymbol,
          assetClass: asset.assetClass,
          isSafeHaven: asset.isSafeHaven,
          source: liveData?.source || "fallback",
        };
      })
    );
    res.json({ ok: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Gold API error:", err);
    // Return fallback data on error
    const data = GOLD_FOREX_ASSETS
      .filter((a) => a.assetClass === "commodity")
      .map((asset) => ({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        price: GOLD_FOREX_FALLBACK[asset.symbol]?.price || 0,
        change24h: GOLD_FOREX_FALLBACK[asset.symbol]?.change24h || 0,
        tradingViewSymbol: asset.tradingViewSymbol,
        assetClass: asset.assetClass,
        isSafeHaven: asset.isSafeHaven,
        source: "fallback",
      }));
    res.json({ ok: true, data, timestamp: new Date().toISOString() });
  }
});

app.get("/api/forex", async (_req, res) => {
  try {
    const forexPairs = GOLD_FOREX_ASSETS.filter((a) => a.assetClass === "forex");
    const data = await Promise.all(
      forexPairs.map(async (asset) => {
        const liveData = await getLiveGoldForexPrice(asset.symbol);
        return {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          price: liveData?.price || GOLD_FOREX_FALLBACK[asset.symbol]?.price || 0,
          change24h: liveData?.change24h ?? GOLD_FOREX_FALLBACK[asset.symbol]?.change24h ?? 0,
          tradingViewSymbol: asset.tradingViewSymbol,
          assetClass: asset.assetClass,
          isSafeHaven: asset.isSafeHaven,
          source: liveData?.source || "fallback",
        };
      })
    );
    res.json({ ok: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Forex API error:", err);
    // Return fallback data on error
    const data = GOLD_FOREX_ASSETS
      .filter((a) => a.assetClass === "forex")
      .map((asset) => ({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        price: GOLD_FOREX_FALLBACK[asset.symbol]?.price || 0,
        change24h: GOLD_FOREX_FALLBACK[asset.symbol]?.change24h || 0,
        tradingViewSymbol: asset.tradingViewSymbol,
        assetClass: asset.assetClass,
        isSafeHaven: asset.isSafeHaven,
        source: "fallback",
      }));
    res.json({ ok: true, data, timestamp: new Date().toISOString() });
  }
});

// Combined all assets endpoint
app.get("/api/all-assets", async (req, res) => {
  try {
    // Fetch crypto data
    const cryptoData = await fetchCoinGeckoCoins(COIN_META.map((c) => c.id).slice(0, 20));
    const cryptoList = cryptoData?.map((coin) => {
      const meta = COIN_BY_ID.get(coin.id);
      return meta ? buildLiveCoin(meta, coin) : null;
    }).filter(Boolean) || COIN_META.slice(0, 20).map(buildFallbackCoin);
    
    // Add Gold/Forex with live prices
    const goldForexList = await Promise.all(
      GOLD_FOREX_ASSETS.map(async (asset) => {
        const liveData = await getLiveGoldForexPrice(asset.symbol);
        const price = liveData?.price || GOLD_FOREX_FALLBACK[asset.symbol]?.price || 0;
        const change24h = liveData?.change24h ?? GOLD_FOREX_FALLBACK[asset.symbol]?.change24h ?? 0;
        return {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          assetId: asset.symbol,
          tvSymbol: asset.tradingViewSymbol,
          image: null, // Will be resolved by frontend
          current_price: price,
          price: price,
          market_cap: asset.symbol === "XAUUSD" ? 15000000000000 : 1000000000,
          price_change_percentage_24h: change24h,
          change24h: change24h,
          assetClass: asset.assetClass,
          isSafeHaven: asset.isSafeHaven,
          source: liveData?.source || "fallback",
        };
      })
    );
    
    res.json({
      success: true,
      data: [...cryptoList, ...goldForexList],
      timestamp: new Date().toISOString(),
      source: "aggregated",
    });
  } catch (error) {
    console.error("[api/all-assets] Error:", error?.message);
    // Never fail - return fallback data
    const fallbackCrypto = COIN_META.slice(0, 20).map(buildFallbackCoin);
    const fallbackGoldForex = GOLD_FOREX_ASSETS.map((asset) => ({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetId: asset.symbol,
      tvSymbol: asset.tradingViewSymbol,
      image: null,
      current_price: GOLD_FOREX_FALLBACK[asset.symbol]?.price || 0,
      price: GOLD_FOREX_FALLBACK[asset.symbol]?.price || 0,
      market_cap: 0,
      price_change_percentage_24h: 0,
      change24h: 0,
      assetClass: asset.assetClass,
    }));
    res.json({
      success: true,
      data: [...fallbackCrypto, ...fallbackGoldForex],
      timestamp: new Date().toISOString(),
      source: "fallback",
    });
  }
});

const SENTIMENT_FALLBACK = 0.5;
const resolveSentimentLabel = (score) => {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
};

const buildSentimentPayload = ({ normalized, label, provider }) => {
  const combinedScore = Math.round(normalized * 100);
  const resolvedLabel = label || resolveSentimentLabel(combinedScore);
  return {
    longShortRatio: 1,
    longPercent: 50,
    shortPercent: 50,
    topTraderLongShortRatio: 1,
    openInterest: 0,
    openInterestChange: 0,
    realTimeSentiment: combinedScore,
    realTimeSentimentLabel: resolvedLabel,
    dailyFearGreed: combinedScore,
    dailyFearGreedLabel: resolvedLabel,
    combinedScore,
    combinedLabel: resolvedLabel,
    timestamp: Date.now(),
    provider: provider || "fallback",
    nextUpdate: 0,
  };
};

app.get("/api/sentiment", async (_req, res) => {
  try {
    const response = await fetch("https://api.alternative.me/fng/?limit=1&format=json");
    if (!response.ok) throw new Error(`Sentiment HTTP ${response.status}`);
    const payload = await response.json();
    const item = payload?.data?.[0];
    const value = Number(item?.value);
    const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : SENTIMENT_FALLBACK;
    const data = buildSentimentPayload({
      normalized,
      label: item?.value_classification || "Neutral",
      provider: "alternative.me",
    });
    res.json({ ok: true, data });
  } catch (error) {
    const data = buildSentimentPayload({
      normalized: SENTIMENT_FALLBACK,
      label: "Neutral",
      provider: "fallback",
    });
    res.json({ ok: true, data, fallback: true, error: error?.message || "sentiment fallback" });
  }
});

// ============================================
// VOLATILITY API (for local development)
// ============================================

app.get("/api/volatility", async (req, res) => {
  try {
    const { symbol } = req.query;
    const upperSymbol = String(symbol || "BTCUSDT").toUpperCase();
    
    // Determine asset class for appropriate volatility defaults
    let assetClass = "crypto";
    let baseVolatility = 0.65; // Default for crypto
    
    if (upperSymbol === "XAUUSD" || upperSymbol === "GOLD") {
      assetClass = "commodity";
      baseVolatility = 0.35;
    } else if (["EURUSD", "GBPUSD", "USDJPY"].includes(upperSymbol)) {
      assetClass = "forex";
      baseVolatility = 0.20;
    }
    
    // Generate realistic volatility metrics
    const noise = (Math.random() - 0.5) * 0.1;
    const volatility = Math.max(0.05, Math.min(1, baseVolatility + noise));
    
    res.json({
      ok: true,
      data: {
        symbol: upperSymbol,
        assetClass,
        atr: {
          value: baseVolatility * 100,
          normalized: volatility,
        },
        bollingerWidth: {
          value: baseVolatility * 150,
          normalized: volatility * 1.2,
        },
        historicalVolatility: {
          daily: baseVolatility * 0.8,
          weekly: baseVolatility * 1.1,
          monthly: baseVolatility * 1.3,
        },
        garchForecast: {
          h4: baseVolatility * 0.9,
          h24: baseVolatility * 1.05,
        },
        compositeScore: Math.round(volatility * 100),
        regime: volatility > 0.7 ? "high" : volatility > 0.4 ? "medium" : "low",
        timestamp: new Date().toISOString(),
        provider: "local-fallback",
      },
    });
  } catch (error) {
    console.error("[Volatility API Error]", error?.message);
    res.status(500).json({ ok: false, error: "Volatility data unavailable" });
  }
});

// ============================================
// ETF NEWS API (for local development)
// ============================================

app.get("/api/etf/news", async (_req, res) => {
  try {
    // Fallback ETF news data for local development
    const fallbackNews = [
      {
        title: "Bitcoin ETF Sees Record $500M Inflows",
        source: "Bloomberg",
        url: "https://bloomberg.com/crypto",
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        description: "Institutional interest in Bitcoin ETFs continues to grow."
      },
      {
        title: "BlackRock iShares Bitcoin Trust Leads Weekly Inflows",
        source: "CoinDesk",
        url: "https://coindesk.com/markets",
        publishedAt: new Date(Date.now() - 7200000).toISOString(),
        description: "IBIT captures majority of new institutional money flowing into crypto."
      },
      {
        title: "Fidelity FBTC Sees Strong Institutional Demand",
        source: "The Block",
        url: "https://theblock.co",
        publishedAt: new Date(Date.now() - 14400000).toISOString(),
        description: "Fidelity's Bitcoin ETF continues to attract pension fund allocations."
      },
      {
        title: "Ethereum ETF Approval Timeline Update",
        source: "Reuters",
        url: "https://reuters.com/technology",
        publishedAt: new Date(Date.now() - 21600000).toISOString(),
        description: "SEC reviewing multiple Ethereum ETF applications."
      },
    ];
    
    res.json({
      ok: true,
      data: fallbackNews,
      provider: "local-fallback",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ETF News API Error]", error?.message);
    res.status(500).json({ ok: false, error: "ETF news unavailable" });
  }
});

// ============================================
// ETF HOLDINGS API (for local development)
// ============================================

// ETF Name Helper
function getEtfName(symbol) {
  const names = {
    IBIT: "iShares Bitcoin Trust",
    FBTC: "Fidelity Wise Origin Bitcoin",
    ARKB: "ARK 21Shares Bitcoin ETF",
    BITB: "Bitwise Bitcoin ETF",
    HODL: "VanEck Bitcoin Trust",
    GBTC: "Grayscale Bitcoin Trust",
    BTCO: "Invesco Galaxy Bitcoin ETF",
    EZBC: "Franklin Bitcoin ETF",
  };
  return names[symbol] || `${symbol} Bitcoin ETF`;
}

app.get("/api/etf/holdings", async (req, res) => {
  try {
    const symbolsParam = req.query.symbols || "IBIT,FBTC,ARKB,BITB,HODL";
    const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase());
    
    // Generate realistic holdings data
    const holdingsData = symbols.map((symbol, idx) => {
      const btcHoldings = Math.floor(100000 + Math.random() * 400000);
      const btcPrice = 67500 + (Math.random() - 0.5) * 1000;
      const aum = btcHoldings * btcPrice;
      
      return {
        symbol,
        name: getEtfName(symbol),
        btcHoldings,
        btcHoldingsChange24h: Math.floor((Math.random() - 0.3) * 2000),
        aum,
        aumChange24h: (Math.random() - 0.4) * 3,
        marketShare: 25 - idx * 4 + Math.random() * 2,
        expenseRatio: 0.20 + idx * 0.05,
        timestamp: new Date().toISOString(),
      };
    });
    
    res.json({
      ok: true,
      data: holdingsData,
      summary: {
        totalBtcHoldings: holdingsData.reduce((sum, h) => sum + h.btcHoldings, 0),
        totalAum: holdingsData.reduce((sum, h) => sum + h.aum, 0),
        leadingEtf: symbols[0],
      },
      provider: "local-fallback",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ETF Holdings API Error]", error?.message);
    res.status(500).json({ ok: false, error: "ETF holdings unavailable" });
  }
});

// ============================================
// ETF FLOWS API (for local development)
// ============================================

app.get("/api/etf/flows", async (req, res) => {
  try {
    const symbolsParam = req.query.symbols || "IBIT,FBTC,ARKB,BITB,HODL";
    const symbols = symbolsParam.split(",").map(s => s.trim().toUpperCase());
    const daysParam = Math.min(Number(req.query.days) || 30, 90);
    
    // Generate realistic flows data
    const flowsData = symbols.map((symbol, idx) => {
      // Generate daily flows for the past N days
      const dailyFlows = [];
      const baseFlow = 50 - idx * 10; // IBIT gets most flows
      
      for (let i = 0; i < daysParam; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const flow = baseFlow * (Math.random() - 0.3) * 20; // Random variation
        dailyFlows.push({
          date: date.toISOString().split('T')[0],
          flow: Math.round(flow * 1000000), // In USD
          btcFlow: Math.round(flow * 15), // Approx BTC equivalent
        });
      }
      
      const totalFlow = dailyFlows.reduce((sum, d) => sum + d.flow, 0);
      const weekFlow = dailyFlows.slice(0, 7).reduce((sum, d) => sum + d.flow, 0);
      
      return {
        symbol,
        name: getEtfName(symbol),
        flows: {
          daily: dailyFlows[0]?.flow || 0,
          weekly: weekFlow,
          monthly: totalFlow,
        },
        series: dailyFlows.slice(0, 7), // Last 7 days
        trend: totalFlow > 0 ? "inflow" : "outflow",
        timestamp: new Date().toISOString(),
      };
    });
    
    const netFlow = flowsData.reduce((sum, f) => sum + f.flows.daily, 0);
    
    res.json({
      ok: true,
      data: flowsData,
      summary: {
        netDailyFlow: netFlow,
        netWeeklyFlow: flowsData.reduce((sum, f) => sum + f.flows.weekly, 0),
        netMonthlyFlow: flowsData.reduce((sum, f) => sum + f.flows.monthly, 0),
        marketSentiment: netFlow > 0 ? "bullish" : netFlow < -50000000 ? "bearish" : "neutral",
      },
      provider: "local-fallback",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ETF Flows API Error]", error?.message);
    res.status(500).json({ ok: false, error: "ETF flows unavailable" });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Vision AI Mind - Backend Server                           ║
╠════════════════════════════════════════════════════════════╣
║  Status:    ✅ RUNNING                                      ║
║  Port:      ${String(PORT).padEnd(47)}║
║  Coins:     ${String(COIN_META.length + " supported assets").padEnd(47)}║
║  Health:    http://localhost:${PORT}/api/health${" ".repeat(23 - String(PORT).length)}║
╠════════════════════════════════════════════════════════════╣
║  Starte jetzt das Frontend: npm run dev                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// ============================================
// 8-POINT SIGNAL ENGINE (PROTECTED)
// ============================================

/**
 * PROPRIETARY ALGORITHM - Server-side only
 * Frontend sends only indicators, backend computes signals
 * This protects IP from reverse engineering
 */

// Rate limiting for signal endpoint
const signalRateLimits = new Map();
const SIGNAL_RATE_LIMIT = 30; // requests per minute
const SIGNAL_RATE_WINDOW = 60000;

const checkSignalRateLimit = (ip) => {
  const now = Date.now();
  const windowStart = now - SIGNAL_RATE_WINDOW;
  const requests = (signalRateLimits.get(ip) || []).filter(t => t > windowStart);
  
  if (requests.length >= SIGNAL_RATE_LIMIT) return false;
  
  requests.push(now);
  signalRateLimits.set(ip, requests);
  return true;
};

// Algorithm parameters by volatility tier (PROTECTED)
const ALGO_PARAMS = {
  crypto: { rsiLow: 30, rsiHigh: 70, atrMult: 1.5 },
  commodity: { rsiLow: 35, rsiHigh: 65, atrMult: 1.2 },
  forex: { rsiLow: 40, rsiHigh: 60, atrMult: 1.0 },
};

app.post("/api/signal", express.json(), (req, res) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  
  if (!checkSignalRateLimit(clientIp)) {
    return res.status(429).json({ ok: false, error: "Rate limit exceeded" });
  }
  
  try {
    const { symbol, rsi, macd, histogram, ema20, ema50, atr, price } = req.body;
    
    if (!symbol || !price) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }
    
    // Determine asset class
    const upperSymbol = String(symbol).toUpperCase();
    let assetClass = "crypto";
    if (upperSymbol === "XAUUSD" || upperSymbol === "GOLD") assetClass = "commodity";
    else if (["EUR", "GBP", "JPY"].some(fx => upperSymbol.includes(fx))) assetClass = "forex";
    
    const params = ALGO_PARAMS[assetClass];
    
    // 8-Point Analysis (simplified for response)
    let buyScore = 0;
    let sellScore = 0;
    const reasons = [];
    
    // 1. RSI
    const rsiVal = Number(rsi) || 50;
    if (rsiVal <= params.rsiLow) { buyScore += 25; reasons.push("RSI oversold"); }
    else if (rsiVal >= params.rsiHigh) { sellScore += 25; reasons.push("RSI overbought"); }
    
    // 2. MACD
    const histVal = Number(histogram) || 0;
    if (histVal > 0) { buyScore += 20; reasons.push("MACD bullish"); }
    else if (histVal < 0) { sellScore += 20; reasons.push("MACD bearish"); }
    
    // 3. EMA Cross
    const ema20Val = Number(ema20) || 0;
    const ema50Val = Number(ema50) || 0;
    if (ema20Val > ema50Val) { buyScore += 15; reasons.push("EMA bullish"); }
    else if (ema20Val < ema50Val) { sellScore += 15; reasons.push("EMA bearish"); }
    
    // 4. Price action (simplified)
    const priceVal = Number(price) || 0;
    const atrVal = Number(atr) || priceVal * 0.02;
    
    // Compute signal
    const netScore = buyScore - sellScore;
    let signal = "HOLD";
    if (netScore > 30) signal = "BUY";
    if (netScore < -30) signal = "SELL";
    
    const confidence = Math.min(100, Math.abs(netScore) / 80 * 100);
    
    // Compute TP/SL
    const slDistance = atrVal * params.atrMult * 2;
    const tp1Distance = atrVal * params.atrMult * 1.5;
    const tp2Distance = atrVal * params.atrMult * 2.5;
    const tp3Distance = atrVal * params.atrMult * 4;
    
    res.json({
      ok: true,
      data: {
        symbol: upperSymbol,
        signal,
        confidence: Math.round(confidence),
        reasons: reasons.slice(0, 3),
        levels: signal !== "HOLD" ? {
          entry: priceVal,
          stopLoss: signal === "BUY" ? priceVal - slDistance : priceVal + slDistance,
          takeProfit1: signal === "BUY" ? priceVal + tp1Distance : priceVal - tp1Distance,
          takeProfit2: signal === "BUY" ? priceVal + tp2Distance : priceVal - tp2Distance,
          takeProfit3: signal === "BUY" ? priceVal + tp3Distance : priceVal - tp3Distance,
        } : null,
        assetClass,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Signal API Error]", error?.message);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

