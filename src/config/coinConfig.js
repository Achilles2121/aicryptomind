// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import supportedCoins, { GOLD_FOREX_ASSETS, getAssetClass, getTradingViewSymbol } from "./supportedCoins";

const normalizeSymbol = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const buildTicker = (symbol) => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return "BTCUSDT";
  return normalized.endsWith("USDT") ? normalized : `${normalized}USDT`;
};

export const COIN_TV_TICKERS = supportedCoins.reduce((acc, coin) => {
  acc[coin.id] = buildTicker(coin.symbol);
  return acc;
}, {});

// Gold/Forex TradingView symbols (with exchange prefix)
export const GOLD_FOREX_TV_SYMBOLS = GOLD_FOREX_ASSETS.reduce((acc, asset) => {
  acc[asset.symbol] = asset.tradingViewSymbol;
  acc[asset.id] = asset.tradingViewSymbol;
  return acc;
}, {});

export const COIN_IDS = new Set(Object.keys(COIN_TV_TICKERS));
export const COIN_SYMBOLS = new Set(supportedCoins.map((coin) => normalizeSymbol(coin.symbol)));
export const COIN_TICKERS = new Set(Object.values(COIN_TV_TICKERS));
export const GOLD_FOREX_SYMBOLS = new Set(GOLD_FOREX_ASSETS.map((a) => a.symbol));

/**
 * Resolve TradingView ticker with full exchange prefix
 * Returns: "BINANCE:BTCUSDT" for crypto, "OANDA:XAUUSD" for gold, "FX:EURUSD" for forex
 */
export const resolveTradingViewTicker = (value) => {
  if (!value) return "BTCUSDT";
  const normalized = normalizeSymbol(value);
  
  // Check for Gold/Forex first - return full symbol with exchange
  if (GOLD_FOREX_TV_SYMBOLS[normalized]) {
    return GOLD_FOREX_TV_SYMBOLS[normalized].replace(/^[A-Z]+:/, ""); // Remove exchange prefix for backward compat
  }
  if (GOLD_FOREX_TV_SYMBOLS[String(value).toLowerCase()]) {
    return GOLD_FOREX_TV_SYMBOLS[String(value).toLowerCase()].replace(/^[A-Z]+:/, "");
  }
  
  // Crypto asset
  const idKey = String(value).toLowerCase();
  if (COIN_TV_TICKERS[idKey]) return COIN_TV_TICKERS[idKey];
  if (!normalized) return "BTCUSDT";
  if (normalized.endsWith("USDT")) return normalized;
  const base = normalized.endsWith("USD") ? normalized.slice(0, -3) : normalized;
  if (COIN_SYMBOLS.has(base)) return `${base}USDT`;
  return buildTicker(base);
};

/**
 * Resolve FULL TradingView symbol including exchange prefix
 * Use this for TradingView widgets
 */
export const resolveFullTradingViewSymbol = (value) => {
  if (!value) return "BINANCE:BTCUSDT";
  const normalized = normalizeSymbol(value);
  
  // Check for Gold/Forex - return full symbol with exchange prefix
  if (GOLD_FOREX_TV_SYMBOLS[normalized]) {
    return GOLD_FOREX_TV_SYMBOLS[normalized];
  }
  const idKey = String(value).toLowerCase();
  if (GOLD_FOREX_TV_SYMBOLS[idKey]) {
    return GOLD_FOREX_TV_SYMBOLS[idKey];
  }
  
  // For crypto, add BINANCE: prefix
  const ticker = resolveTradingViewTicker(value);
  return `BINANCE:${ticker}`;
};

export default COIN_TV_TICKERS;
