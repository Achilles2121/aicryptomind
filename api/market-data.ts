/**
 * /api/market-data.ts - Universal Market Data API
 * 
 * Unified endpoint for all asset types: Crypto, Indices, Forex, Commodities
 * Uses Binance for crypto (faster) and Yahoo Finance for everything else
 * 
 * @author Vision AI Mind
 * @version 2.0.0
 * 
 * Usage:
 *   GET /api/market-data?symbol=BTC
 *   GET /api/market-data?symbol=DAX%2040
 *   GET /api/market-data?symbol=EUR%20/%20USD
 */

// Edge runtime - no @vercel/node types needed

// ============================================================================
// TYPES
// ============================================================================

type AssetType = 'crypto' | 'index' | 'commodity' | 'forex';

interface AssetConfig {
  ticker: string;
  type: AssetType;
  updateInterval: number;
  useBinance?: boolean;
  binanceSymbol?: string;
  displayName?: string;
  decimals?: number;
  currency?: string;
}

interface MarketDataResponse {
  ok: boolean;
  status: 'ok' | 'error' | 'cached';
  data?: {
    symbol: string;
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    previousClose: number;
    high24h: number;
    low24h: number;
    volume: number;
    timestamp: number;
    type: AssetType;
    displayName: string;
    provider: 'binance' | 'yahoo';
  };
  error?: string;
  cached?: boolean;
}

interface CacheEntry {
  data: MarketDataResponse['data'];
  timestamp: number;
  ttl: number;
}

// ============================================================================
// SYMBOL MAP (inline to avoid import issues in Vercel)
// ============================================================================

const SYMBOL_MAP: Record<string, AssetConfig> = {
  // CRYPTO
  'BTC': { ticker: 'BTC-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'BTCUSDT', decimals: 2, currency: '$' },
  'ETH': { ticker: 'ETH-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'ETHUSDT', decimals: 2, currency: '$' },
  'SOL': { ticker: 'SOL-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'SOLUSDT', decimals: 2, currency: '$' },
  'XRP': { ticker: 'XRP-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'XRPUSDT', decimals: 4, currency: '$' },
  'ADA': { ticker: 'ADA-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'ADAUSDT', decimals: 4, currency: '$' },
  'LTC': { ticker: 'LTC-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'LTCUSDT', decimals: 2, currency: '$' },
  'DOGE': { ticker: 'DOGE-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'DOGEUSDT', decimals: 5, currency: '$' },
  'BNB': { ticker: 'BNB-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'BNBUSDT', decimals: 2, currency: '$' },
  'AVAX': { ticker: 'AVAX-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'AVAXUSDT', decimals: 2, currency: '$' },
  'DOT': { ticker: 'DOT-USD', type: 'crypto', updateInterval: 1000, useBinance: true, binanceSymbol: 'DOTUSDT', decimals: 3, currency: '$' },
  
  // INDICES
  'DAX 40': { ticker: '^GDAXI', type: 'index', updateInterval: 5000, displayName: 'DAX 40', decimals: 2, currency: '€' },
  'DAX': { ticker: '^GDAXI', type: 'index', updateInterval: 5000, displayName: 'DAX 40', decimals: 2, currency: '€' },
  'S&P 500': { ticker: '^GSPC', type: 'index', updateInterval: 5000, displayName: 'S&P 500', decimals: 2, currency: '$' },
  'SPX': { ticker: '^GSPC', type: 'index', updateInterval: 5000, displayName: 'S&P 500', decimals: 2, currency: '$' },
  'Nasdaq 100': { ticker: '^NDX', type: 'index', updateInterval: 5000, displayName: 'NASDAQ 100', decimals: 2, currency: '$' },
  'NASDAQ': { ticker: '^IXIC', type: 'index', updateInterval: 5000, displayName: 'NASDAQ Composite', decimals: 2, currency: '$' },
  'Dow Jones': { ticker: '^DJI', type: 'index', updateInterval: 5000, displayName: 'Dow Jones', decimals: 2, currency: '$' },
  'DJI': { ticker: '^DJI', type: 'index', updateInterval: 5000, displayName: 'Dow Jones', decimals: 2, currency: '$' },
  'FTSE 100': { ticker: '^FTSE', type: 'index', updateInterval: 5000, displayName: 'FTSE 100', decimals: 2, currency: '£' },
  'Nikkei 225': { ticker: '^N225', type: 'index', updateInterval: 5000, displayName: 'Nikkei 225', decimals: 2, currency: '¥' },
  
  // COMMODITIES
  'Gold': { ticker: 'GC=F', type: 'commodity', updateInterval: 3000, displayName: 'Gold (COMEX)', decimals: 2, currency: '$' },
  'GOLD': { ticker: 'GC=F', type: 'commodity', updateInterval: 3000, displayName: 'Gold (COMEX)', decimals: 2, currency: '$' },
  'XAUUSD': { ticker: 'GC=F', type: 'commodity', updateInterval: 3000, displayName: 'Gold/USD', decimals: 2, currency: '$' },
  'Silver': { ticker: 'SI=F', type: 'commodity', updateInterval: 3000, displayName: 'Silver (COMEX)', decimals: 3, currency: '$' },
  'Oil': { ticker: 'CL=F', type: 'commodity', updateInterval: 3000, displayName: 'Crude Oil (WTI)', decimals: 2, currency: '$' },
  
  // FOREX
  'EUR / USD': { ticker: 'EURUSD=X', type: 'forex', updateInterval: 3000, displayName: 'EUR/USD', decimals: 5, currency: '' },
  'EURUSD': { ticker: 'EURUSD=X', type: 'forex', updateInterval: 3000, displayName: 'EUR/USD', decimals: 5, currency: '' },
  'GBP / USD': { ticker: 'GBPUSD=X', type: 'forex', updateInterval: 3000, displayName: 'GBP/USD', decimals: 5, currency: '' },
  'GBPUSD': { ticker: 'GBPUSD=X', type: 'forex', updateInterval: 3000, displayName: 'GBP/USD', decimals: 5, currency: '' },
  'USD / JPY': { ticker: 'JPY=X', type: 'forex', updateInterval: 3000, displayName: 'USD/JPY', decimals: 3, currency: '' },
  'USDJPY': { ticker: 'JPY=X', type: 'forex', updateInterval: 3000, displayName: 'USD/JPY', decimals: 3, currency: '' },
  'USD / CHF': { ticker: 'CHF=X', type: 'forex', updateInterval: 3000, displayName: 'USD/CHF', decimals: 5, currency: '' },
  'USDCHF': { ticker: 'CHF=X', type: 'forex', updateInterval: 3000, displayName: 'USD/CHF', decimals: 5, currency: '' },
  'AUD / USD': { ticker: 'AUDUSD=X', type: 'forex', updateInterval: 3000, displayName: 'AUD/USD', decimals: 5, currency: '' },
  'AUDUSD': { ticker: 'AUDUSD=X', type: 'forex', updateInterval: 3000, displayName: 'AUD/USD', decimals: 5, currency: '' },
  'USD / CAD': { ticker: 'CAD=X', type: 'forex', updateInterval: 3000, displayName: 'USD/CAD', decimals: 5, currency: '' },
  'USDCAD': { ticker: 'CAD=X', type: 'forex', updateInterval: 3000, displayName: 'USD/CAD', decimals: 5, currency: '' },
};

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

const cache: Record<string, CacheEntry> = {};

function getCacheKey(symbol: string): string {
  return `market_${symbol.toUpperCase().replaceAll(/\s+/g, '_')}`;
}

function getCachedData(symbol: string): CacheEntry | null {
  const key = getCacheKey(symbol);
  const entry = cache[key];
  
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    delete cache[key];
    return null;
  }
  
  return entry;
}

function setCacheData(symbol: string, data: MarketDataResponse['data'], ttl: number): void {
  const key = getCacheKey(symbol);
  cache[key] = {
    data,
    timestamp: Date.now(),
    ttl
  };
}

// ============================================================================
// GET ASSET CONFIG
// ============================================================================

function getAssetConfig(symbol: string): AssetConfig | null {
  // Direct match
  if (SYMBOL_MAP[symbol]) {
    return SYMBOL_MAP[symbol];
  }
  
  // Case-insensitive match
  const upperSymbol = symbol.toUpperCase();
  for (const [key, config] of Object.entries(SYMBOL_MAP)) {
    if (key.toUpperCase() === upperSymbol) {
      return config;
    }
  }
  
  return null;
}

// ============================================================================
// BINANCE API (for Crypto - faster updates)
// ============================================================================

async function fetchBinanceData(binanceSymbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high24h: number;
  low24h: number;
  volume: number;
} | null> {
  try {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VisionAIMind/2.0'
      }
    });
    
    if (!response.ok) {
      console.error(`[Binance] Error ${response.status} for ${binanceSymbol}`);
      return null;
    }
    
    const data = await response.json();
    
    return {
      price: Number.parseFloat(data.lastPrice) || 0,
      change: Number.parseFloat(data.priceChange) || 0,
      changePercent: Number.parseFloat(data.priceChangePercent) || 0,
      previousClose: Number.parseFloat(data.prevClosePrice) || 0,
      high24h: Number.parseFloat(data.highPrice) || 0,
      low24h: Number.parseFloat(data.lowPrice) || 0,
      volume: Number.parseFloat(data.volume) || 0
    };
  } catch (error) {
    console.error(`[Binance] Fetch error for ${binanceSymbol}:`, error);
    return null;
  }
}

// ============================================================================
// YAHOO FINANCE API (for Indices, Forex, Commodities)
// ============================================================================

async function fetchYahooData(ticker: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high24h: number;
  low24h: number;
  volume: number;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`[Yahoo] Error ${response.status} for ${ticker}`);
      return null;
    }
    
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    
    if (!result) {
      console.error(`[Yahoo] No result for ${ticker}`);
      return null;
    }
    
    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    
    // Get latest price
    const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    
    // Calculate change
    const change = price - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
    
    // Get high/low from quotes or meta
    let high24h = meta.regularMarketDayHigh ?? 0;
    let low24h = meta.regularMarketDayLow ?? 0;
    let volume = meta.regularMarketVolume ?? 0;
    
    // If meta doesn't have it, calculate from quotes
    if (quote && (!high24h || !low24h)) {
      const highs = (quote.high || []).filter((h: number | null) => h !== null);
      const lows = (quote.low || []).filter((l: number | null) => l !== null);
      if (highs.length) high24h = Math.max(...highs);
      if (lows.length) low24h = Math.min(...lows);
    }
    
    return {
      price,
      change,
      changePercent,
      previousClose,
      high24h,
      low24h,
      volume
    };
  } catch (error) {
    console.error(`[Yahoo] Fetch error for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate=5');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({
      ok: false,
      status: 'error',
      error: 'Method not allowed'
    });
    return;
  }
  
  // Get symbol from query
  const symbol = (req.query.symbol as string) || '';
  
  if (!symbol) {
    res.status(400).json({
      ok: false,
      status: 'error',
      error: 'Missing required parameter: symbol'
    });
    return;
  }
  
  // Get asset config
  const config = getAssetConfig(symbol);
  
  if (!config) {
    res.status(404).json({
      ok: false,
      status: 'error',
      error: `Unknown symbol: ${symbol}. Supported: BTC, ETH, DAX 40, S&P 500, EUR / USD, Gold, etc.`
    });
    return;
  }
  
  // Check cache first
  const cached = getCachedData(symbol);
  if (cached) {
    console.log(`[Cache HIT] ${symbol}`);
    res.status(200).json({
      ok: true,
      status: 'cached',
      data: cached.data,
      cached: true
    });
    return;
  }
  
  console.log(`[Cache MISS] ${symbol} - fetching fresh data`);
  
  // Fetch data based on asset type
  let marketData: {
    price: number;
    change: number;
    changePercent: number;
    previousClose: number;
    high24h: number;
    low24h: number;
    volume: number;
  } | null = null;
  
  let provider: 'binance' | 'yahoo' = 'yahoo';
  
  // Try Binance first for crypto
  if (config.useBinance && config.binanceSymbol) {
    provider = 'binance';
    marketData = await fetchBinanceData(config.binanceSymbol);
    
    // Fallback to Yahoo if Binance fails
    if (!marketData) {
      console.log(`[Fallback] ${symbol}: Binance failed, trying Yahoo`);
      provider = 'yahoo';
      marketData = await fetchYahooData(config.ticker);
    }
  } else {
    // Use Yahoo for non-crypto
    marketData = await fetchYahooData(config.ticker);
  }
  
  // Handle fetch failure
  if (!marketData) {
    // Try to return stale cache
    const staleKey = getCacheKey(symbol);
    const staleEntry = cache[staleKey];
    
    if (staleEntry) {
      console.log(`[Stale Cache] ${symbol} - returning expired data`);
      res.status(200).json({
        ok: true,
        status: 'cached',
        data: staleEntry.data,
        cached: true
      });
      return;
    }
    
    res.status(503).json({
      ok: false,
      status: 'error',
      error: `Failed to fetch data for ${symbol}. Please try again.`
    });
    return;
  }
  
  // Build response data
  const responseData: MarketDataResponse['data'] = {
    symbol,
    ticker: config.ticker,
    price: marketData.price,
    change: marketData.change,
    changePercent: marketData.changePercent,
    previousClose: marketData.previousClose,
    high24h: marketData.high24h,
    low24h: marketData.low24h,
    volume: marketData.volume,
    timestamp: Date.now(),
    type: config.type,
    displayName: config.displayName || symbol,
    provider
  };
  
  // Cache TTL based on asset type
  const ttlMap: Record<AssetType, number> = {
    crypto: 1000,      // 1 second
    index: 5000,       // 5 seconds
    forex: 3000,       // 3 seconds
    commodity: 3000    // 3 seconds
  };
  
  const ttl = ttlMap[config.type] || 5000;
  setCacheData(symbol, responseData, ttl);
  
  console.log(`[Success] ${symbol}: ${marketData.price} via ${provider}`);
  
  res.status(200).json({
    ok: true,
    status: 'ok',
    data: responseData,
    cached: false
  });
}
