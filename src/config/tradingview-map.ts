// Copyright (c) 2025 Vision AI Mind. All rights reserved.

/**
 * TradingView Symbol Mapping (Crypto + Gold + Forex)
 * Maps UI display names to TradingView ticker symbols.
 */

import supportedCoins, { formatMarketId, GOLD_FOREX_ASSETS, getTradingViewSymbol } from "./supportedCoins";
import { COIN_TV_TICKERS } from "./coinConfig";

export interface TVAssetConfig {
  tvSymbol: string;
  displayName: string;
  shortName: string;
  assetClass: "crypto" | "commodity" | "forex";
}

// Type-safe accessor for COIN_TV_TICKERS
const getCoinTvTicker = (coinId: string): string | undefined => {
  return (COIN_TV_TICKERS as Record<string, string>)[coinId];
};

const buildConfig = (coin: { id: string; symbol: string; name?: string }): TVAssetConfig => {
  const symbol = String(coin.symbol || "").toUpperCase();
  const tvTicker = getCoinTvTicker(coin.id) || `${symbol}USDT`;
  return {
    tvSymbol: `BINANCE:${tvTicker}`,
    displayName: `${coin.name || symbol} (${symbol}/USD)`,
    shortName: symbol,
    assetClass: "crypto",
  };
};

const addKey = (map: Record<string, TVAssetConfig>, key: string | undefined, config: TVAssetConfig) => {
  if (!key) return;
  if (!map[key]) {
    map[key] = config;
  }
};

export const TRADINGVIEW_SYMBOL_MAP: Record<string, TVAssetConfig> = supportedCoins.reduce((acc, coin) => {
  const config = buildConfig(coin);
  const symbol = String(coin.symbol || "").toUpperCase();
  const id = formatMarketId(symbol);
  addKey(acc, symbol, config);
  addKey(acc, id, config);
  addKey(acc, coin.id, config);
  addKey(acc, coin.name, config);
  addKey(acc, `${symbol}USD`, config);
  addKey(acc, `${symbol}USDT`, config);
  addKey(acc, `${symbol} / USD`, config);
  addKey(acc, `${symbol}/USD`, config);
  return acc;
}, {} as Record<string, TVAssetConfig>);

// Add Gold and Forex assets to the map
GOLD_FOREX_ASSETS.forEach((asset) => {
  const config: TVAssetConfig = {
    tvSymbol: asset.tradingViewSymbol,
    displayName: asset.name,
    shortName: asset.symbol,
    assetClass: asset.assetClass as "commodity" | "forex",
  };
  TRADINGVIEW_SYMBOL_MAP[asset.symbol] = config;
  TRADINGVIEW_SYMBOL_MAP[asset.id] = config;
  TRADINGVIEW_SYMBOL_MAP[asset.name] = config;
});

export function getTVSymbol(assetName: string): string {
  if (!assetName) return "BINANCE:BTCUSDT";

  const config = TRADINGVIEW_SYMBOL_MAP[assetName];
  if (config) return config.tvSymbol;

  const normalized = assetName.trim().toUpperCase();
  const normalizedConfig = TRADINGVIEW_SYMBOL_MAP[normalized];
  if (normalizedConfig) return normalizedConfig.tvSymbol;

  // Check if it's a Gold/Forex asset
  const goldForexSymbol = getTradingViewSymbol(normalized);
  if (goldForexSymbol && goldForexSymbol !== `BINANCE:${normalized}USDT`) {
    return goldForexSymbol;
  }

  if (assetName.includes(":")) return assetName;

  return "BINANCE:BTCUSDT";
}

export function getTVConfig(assetName: string): TVAssetConfig {
  if (!assetName) {
    return TRADINGVIEW_SYMBOL_MAP["BTCUSD"];
  }

  let config = TRADINGVIEW_SYMBOL_MAP[assetName];
  if (config) return config;

  const normalized = assetName.trim().toUpperCase();
  config = TRADINGVIEW_SYMBOL_MAP[normalized];
  if (config) return config;

  return TRADINGVIEW_SYMBOL_MAP["BTCUSD"];
}

export function getAssetDisplayName(assetName: string): string {
  const config = getTVConfig(assetName);
  return config?.displayName || assetName;
}

export const ASSET_CLASS_COLORS: Record<string, string> = {
  crypto: "text-amber-400 bg-amber-500/10 border-amber-500/30",
};

export default TRADINGVIEW_SYMBOL_MAP;
