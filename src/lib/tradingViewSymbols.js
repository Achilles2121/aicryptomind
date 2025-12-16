// Copyright (c) 2025 Vision AI Mind. All rights reserved.

/**
 * TradingView Symbol Mapping
 * Maps our internal asset IDs to TradingView symbols
 */

// Crypto symbols (Binance preferred for liquidity)
const CRYPTO_SYMBOLS = {
  BTC: "BINANCE:BTCUSDT",
  BTCUSD: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  ETHUSD: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
  SOLUSD: "BINANCE:SOLUSDT",
  XRP: "BINANCE:XRPUSDT",
  DOGE: "BINANCE:DOGEUSDT",
  ADA: "BINANCE:ADAUSDT",
  DOT: "BINANCE:DOTUSDT",
  AVAX: "BINANCE:AVAXUSDT",
  MATIC: "BINANCE:MATICUSDT",
  LINK: "BINANCE:LINKUSDT",
  UNI: "BINANCE:UNIUSDT",
  LTC: "BINANCE:LTCUSDT",
  ATOM: "BINANCE:ATOMUSDT",
  NEAR: "BINANCE:NEARUSDT",
  APT: "BINANCE:APTUSDT",
  ARB: "BINANCE:ARBUSDT",
  OP: "BINANCE:OPUSDT",
};

// Forex symbols
const FOREX_SYMBOLS = {
  EURUSD: "FX:EURUSD",
  GBPUSD: "FX:GBPUSD",
  USDJPY: "FX:USDJPY",
  USDCHF: "FX:USDCHF",
  AUDUSD: "FX:AUDUSD",
  USDCAD: "FX:USDCAD",
  NZDUSD: "FX:NZDUSD",
  EURGBP: "FX:EURGBP",
  EURJPY: "FX:EURJPY",
  GBPJPY: "FX:GBPJPY",
};

// Index symbols
const INDEX_SYMBOLS = {
  SPX: "FOREXCOM:SPXUSD",
  SP500: "FOREXCOM:SPXUSD",
  GSPC: "SP:SPX",
  DAX: "XETR:DAX",
  GDAXI: "XETR:DAX",
  NASDAQ: "NASDAQ:NDX",
  NDX: "NASDAQ:NDX",
  DJI: "DJ:DJI",
  DOW: "DJ:DJI",
  NIKKEI: "TVC:NI225",
  N225: "TVC:NI225",
  FTSE: "TVC:UKX",
  CAC40: "EURONEXT:PX1",
  STOXX50: "TVC:SX5E",
};

// Commodity symbols
const COMMODITY_SYMBOLS = {
  GOLD: "TVC:GOLD",
  XAUUSD: "TVC:GOLD",
  GC: "COMEX:GC1!",
  SILVER: "TVC:SILVER",
  XAGUSD: "TVC:SILVER",
  SI: "COMEX:SI1!",
  OIL: "TVC:USOIL",
  WTI: "TVC:USOIL",
  CL: "NYMEX:CL1!",
  BRENT: "TVC:UKOIL",
  NATGAS: "NYMEX:NG1!",
  NG: "NYMEX:NG1!",
  COPPER: "COMEX:HG1!",
  PLATINUM: "NYMEX:PL1!",
};

// Combined lookup
const ALL_SYMBOLS = {
  ...CRYPTO_SYMBOLS,
  ...FOREX_SYMBOLS,
  ...INDEX_SYMBOLS,
  ...COMMODITY_SYMBOLS,
};

/**
 * Get TradingView symbol from internal asset ID
 * @param {string} assetId - Internal asset ID (e.g., "BTC", "EURUSD", "SPX")
 * @param {string} assetClass - Optional asset class hint
 * @returns {string} TradingView symbol
 */
export function getTradingViewSymbol(assetId, assetClass) {
  if (!assetId) return "BINANCE:BTCUSDT";
  
  const normalized = assetId.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Direct lookup
  if (ALL_SYMBOLS[normalized]) {
    return ALL_SYMBOLS[normalized];
  }
  
  // Try with common suffixes removed
  const withoutSuffix = normalized.replace(/(USD|USDT|EUR|GBP)$/, "");
  if (ALL_SYMBOLS[withoutSuffix]) {
    return ALL_SYMBOLS[withoutSuffix];
  }
  
  // Fallback based on asset class
  if (assetClass === "crypto") {
    return `BINANCE:${normalized}USDT`;
  }
  if (assetClass === "fx" || assetClass === "forex") {
    return `FX:${normalized}`;
  }
  if (assetClass === "index") {
    return `TVC:${normalized}`;
  }
  if (assetClass === "commodity") {
    return `TVC:${normalized}`;
  }
  
  // Default to Binance for unknown
  return `BINANCE:${normalized}USDT`;
}

/**
 * Get interval string for TradingView
 * @param {number|string} minutes - Interval in minutes
 * @returns {string} TradingView interval
 */
export function getTradingViewInterval(minutes) {
  const mins = Number(minutes) || 60;
  
  if (mins >= 1440) return "D"; // Daily
  if (mins >= 240) return "240"; // 4H
  if (mins >= 60) return "60"; // 1H
  if (mins >= 15) return "15"; // 15M
  if (mins >= 5) return "5"; // 5M
  return "1"; // 1M
}

/**
 * Get ticker symbols for TradingView Ticker Tape
 * @param {string} assetClass - Filter by asset class (optional)
 * @returns {Array} Array of ticker objects
 */
export function getTickerSymbols(assetClass) {
  const cryptoTickers = [
    { proName: "BINANCE:BTCUSDT", title: "Bitcoin" },
    { proName: "BINANCE:ETHUSDT", title: "Ethereum" },
    { proName: "BINANCE:SOLUSDT", title: "Solana" },
    { proName: "BINANCE:XRPUSDT", title: "XRP" },
    { proName: "BINANCE:ADAUSDT", title: "Cardano" },
  ];
  
  const forexTickers = [
    { proName: "FX:EURUSD", title: "EUR/USD" },
    { proName: "FX:GBPUSD", title: "GBP/USD" },
    { proName: "FX:USDJPY", title: "USD/JPY" },
  ];
  
  const indexTickers = [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "XETR:DAX", title: "DAX" },
    { proName: "NASDAQ:NDX", title: "NASDAQ" },
  ];
  
  const commodityTickers = [
    { proName: "TVC:GOLD", title: "Gold" },
    { proName: "TVC:SILVER", title: "Silver" },
    { proName: "TVC:USOIL", title: "Oil" },
  ];
  
  if (assetClass === "crypto") return cryptoTickers;
  if (assetClass === "fx" || assetClass === "forex") return forexTickers;
  if (assetClass === "index") return indexTickers;
  if (assetClass === "commodity") return commodityTickers;
  
  // Return mixed selection
  return [
    ...cryptoTickers.slice(0, 3),
    ...forexTickers.slice(0, 1),
    ...commodityTickers.slice(0, 1),
    ...indexTickers.slice(0, 1),
  ];
}

export default {
  getTradingViewSymbol,
  getTradingViewInterval,
  getTickerSymbols,
  CRYPTO_SYMBOLS,
  FOREX_SYMBOLS,
  INDEX_SYMBOLS,
  COMMODITY_SYMBOLS,
};
