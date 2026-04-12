// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import supportedCoins, { GOLD_FOREX_ASSETS, getAssetClass, getTradingViewSymbol } from "./supportedCoins";

const normalizeSymbol = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Special TradingView symbol overrides for coins not on Binance or with different tickers
const TV_SYMBOL_OVERRIDES = {
  // Stablecoins - use USDT chart as proxy (they're pegged)
  "tether": "BINANCE:USDCUSDT",
  "usd-coin": "BINANCE:USDCUSDT", 
  "usds": "BINANCE:USDCUSDT",
  "dai": "BINANCE:DAIUSDT",
  "paypal-usd": "BINANCE:USDCUSDT",
  "usdt0": "BINANCE:USDCUSDT",
  "ethena-usde": "BINANCE:USDCUSDT",
  
  // Wrapped coins - use underlying asset
  "staked-ether": "BINANCE:ETHUSDT",
  "wrapped-steth": "BINANCE:ETHUSDT", 
  "wrapped-beacon-eth": "BINANCE:ETHUSDT",
  "wrapped-eeth": "BINANCE:ETHUSDT",
  "weth": "BINANCE:ETHUSDT",
  "wrapped-bitcoin": "BINANCE:BTCUSDT",
  "coinbase-wrapped-btc": "BINANCE:BTCUSDT",
  
  // Not on Binance - use alternatives
  "monero": "KRAKEN:XMRUSD", // XMR delisted from Binance
  "zcash": "KRAKEN:ZECUSD",  // ZEC delisted from Binance
  "leo-token": "BITFINEX:LEOUSD",
  
  // Newer/smaller coins with correct Binance tickers
  "hyperliquid": "BINANCE:HYPEUSDT",
  "sui": "BINANCE:SUIUSDT",
  "arbitrum": "BINANCE:ARBUSDT",
  "optimism": "BINANCE:OPUSDT",
  "near": "BINANCE:NEARUSDT",
  "pepe": "BINANCE:PEPEUSDT",
  "shiba-inu": "BINANCE:SHIBUSDT",
  "toncoin": "BINANCE:TONUSDT",
  "the-open-network": "BINANCE:TONUSDT",
  "hedera-hashgraph": "BINANCE:HBARUSDT",
  "mantle": "BINANCE:MNTUSDT",
  "bitget-token": "BINANCE:BGBUSDT",
  
  // Tether Gold - use Gold spot
  "tether-gold": "OANDA:XAUUSD",
  
  // Coins that may not exist on Binance
  "figure-heloc": "BINANCE:BTCUSDT", // Fallback
  "whitebit": "BINANCE:BTCUSDT", // Fallback
  "canton-network": "BINANCE:BTCUSDT", // Fallback
  "world-liberty-financial": "BINANCE:BTCUSDT", // Fallback
  "usd1-wlfi": "BINANCE:USDCUSDT", // Fallback
  "rain": "BINANCE:BTCUSDT", // Fallback
  "susds": "BINANCE:USDCUSDT", // Fallback
  "ethena-staked-usde": "BINANCE:USDCUSDT", // Fallback
  "binance-bridged-usdt-bnb-smart-chain": "BINANCE:USDCUSDT", // Fallback
};

const buildTicker = (symbol) => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return "BTCUSDT";
  return normalized.endsWith("USDT") ? normalized : `${normalized}USDT`;
};

export const COIN_TV_TICKERS = supportedCoins.reduce((acc, coin) => {
  // Check for override first
  if (TV_SYMBOL_OVERRIDES[coin.id]) {
    acc[coin.id] = TV_SYMBOL_OVERRIDES[coin.id].replace(/^[A-Z]+:/, "");
  } else {
    acc[coin.id] = buildTicker(coin.symbol);
  }
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
  
  // Check for special overrides (includes exchange prefix)
  if (TV_SYMBOL_OVERRIDES[idKey]) {
    return TV_SYMBOL_OVERRIDES[idKey];
  }
  
  // For crypto, add BINANCE: prefix
  const ticker = resolveTradingViewTicker(value);
  
  // If ticker already has exchange prefix, return as-is
  if (ticker.includes(":")) return ticker;
  
  return `BINANCE:${ticker}`;
};

export default COIN_TV_TICKERS;
