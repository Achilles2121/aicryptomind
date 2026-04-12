// Copyright (c) 2025 Vision AI Mind. All rights reserved.

/**
 * CENTRAL ASSET CONFIGURATION - Crypto + Gold + Forex
 * Maps UI labels to technical tickers for Yahoo Finance and TradingView
 */

import supportedCoins, { formatMarketId, formatTradingViewSymbol, GOLD_FOREX_ASSETS, getAssetClass as getAssetClassFromCoins } from "./supportedCoins";

export interface Asset {
  id: string;
  label: string;
  symbol: string;
  tvSymbol: string;
  base?: string;
  quote?: string;
  decimals?: number;
  icon?: string;
  assetClass?: AssetClass;
}

export type AssetClass = "crypto" | "commodity" | "forex" | "index";
export type NormalizedAssetClass = "crypto" | "commodity" | "forex" | "index";

export interface AssetConfig {
  crypto: Asset[];
  commodity: Asset[];
  forex: Asset[];
  index: Asset[];
}

const normalizeKey = (value: string): string =>
  value.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");

const buildAsset = (coin: { id: string; symbol: string; name?: string }): Asset => {
  const base = String(coin.symbol || "").toUpperCase();
  return {
    id: formatMarketId(base),
    label: coin.name || base,
    symbol: `${base}-USD`,
    tvSymbol: formatTradingViewSymbol(base),
    base,
    quote: "USD",
    decimals: 2,
    assetClass: "crypto",
  };
};

// Build Gold/Forex assets
const buildGoldForexAsset = (asset: typeof GOLD_FOREX_ASSETS[0]): Asset => ({
  id: asset.id,
  label: asset.name,
  symbol: asset.symbol,
  tvSymbol: asset.tradingViewSymbol,
  base: asset.symbol,
  quote: "USD",
  decimals: asset.assetClass === "commodity" ? 2 : 5,
  assetClass: asset.assetClass as AssetClass,
});

export const ASSETS: AssetConfig = {
  crypto: supportedCoins.reduce((acc, coin) => {
    const base = normalizeKey(coin.symbol || "");
    const id = formatMarketId(base);
    if (!base || acc.some((asset) => asset.id === id)) return acc;
    acc.push(buildAsset(coin));
    return acc;
  }, [] as Asset[]),
  commodity: GOLD_FOREX_ASSETS.filter(a => a.assetClass === "commodity").map(buildGoldForexAsset),
  forex: GOLD_FOREX_ASSETS.filter(a => a.assetClass === "forex").map(buildGoldForexAsset),
  index: GOLD_FOREX_ASSETS.filter(a => a.assetClass === "index").map(buildGoldForexAsset),
};

// Build aliases for all asset classes
const buildAliases = (): Record<string, string> => {
  const aliases: Record<string, string> = {};
  
  // Crypto aliases
  ASSETS.crypto.forEach((asset) => {
    const base = asset.base ? normalizeKey(asset.base) : "";
    const id = normalizeKey(asset.id);
    if (base) {
      aliases[base] = id;
      aliases[`${base}USD`] = id;
      aliases[`${base}USDT`] = id;
      aliases[`${base}-USD`] = id;
    }
    aliases[id] = id;
  });
  
  // Commodity/Forex aliases
  [...ASSETS.commodity, ...ASSETS.forex].forEach((asset) => {
    const sym = normalizeKey(asset.symbol);
    aliases[sym] = asset.id;
    aliases[asset.id] = asset.id;
  });
  
  return aliases;
};

const ASSET_ALIASES: Record<string, string> = buildAliases();

export function normalizeAssetClass(assetClass: AssetClass): NormalizedAssetClass {
  if (assetClass === "commodity" || assetClass === "forex" || assetClass === "index") return assetClass;
  return "crypto";
}

export function getAllAssets(): Asset[] {
  return [...ASSETS.crypto, ...ASSETS.commodity, ...ASSETS.forex, ...ASSETS.index];
}

export function getAssetById(id: string): Asset | undefined {
  if (!id) return undefined;
  const normalized = normalizeKey(id);
  const aliasedId = ASSET_ALIASES[normalized] || normalized;
  
  // Search all asset classes
  const allAssets = getAllAssets();
  return allAssets.find((asset) => 
    normalizeKey(asset.id) === aliasedId || 
    normalizeKey(asset.base || "") === aliasedId ||
    normalizeKey(asset.symbol) === aliasedId
  );
}

export function getAssetByLabel(label: string): Asset | undefined {
  const normalized = label.toLowerCase().trim();
  const allAssets = getAllAssets();
  return allAssets.find((asset) => 
    asset.label.toLowerCase() === normalized || 
    asset.label.toLowerCase().includes(normalized)
  );
}

export function getTVSymbolForAsset(id: string): string {
  const asset = getAssetById(id);
  return asset?.tvSymbol || "BINANCE:BTCUSDT";
}

export function getYahooSymbolForAsset(id: string): string {
  const asset = getAssetById(id);
  return asset?.symbol || "BTC-USD";
}

export function getAssetClass(id: string): NormalizedAssetClass {
  const asset = getAssetById(id);
  if (asset?.assetClass) return asset.assetClass;
  // Use supportedCoins detector as fallback
  return getAssetClassFromCoins(id) as NormalizedAssetClass;
}

export function getAssetsByClass(assetClass: AssetClass): Asset[] {
  switch (assetClass) {
    case "commodity":
      return ASSETS.commodity;
    case "forex":
      return ASSETS.forex;
    case "index":
      return ASSETS.index;
    default:
      return ASSETS.crypto;
  }
}

export const ASSET_CLASS_LABELS: Record<NormalizedAssetClass, string> = {
  crypto: "Crypto",
  commodity: "Commodity",
  forex: "Forex",
  index: "Indices",
};

export const ASSET_CLASS_ICONS: Record<NormalizedAssetClass, string> = {
  crypto: "₿",
  commodity: "🥇",
  forex: "💱",
  index: "📊",
};

export const DEFAULT_ASSETS: Record<NormalizedAssetClass, string> = {
  crypto: "BTCUSD",
  commodity: "XAUUSD",
  forex: "EURUSD",
  index: "SP500",
};

// Dashboard asset selector items
export const DASHBOARD_ASSETS = [
  // Crypto
  { id: "BTCUSD", label: "BTC", assetClass: "crypto" as const },
  { id: "ETHUSD", label: "ETH", assetClass: "crypto" as const },
  { id: "SOLUSD", label: "SOL", assetClass: "crypto" as const },
  { id: "XRPUSD", label: "XRP", assetClass: "crypto" as const },
  { id: "BNBUSD", label: "BNB", assetClass: "crypto" as const },
  // Gold & Silver & Oil
  { id: "gold-xauusd", label: "GOLD", assetClass: "commodity" as const },
  { id: "silver-xagusd", label: "SILVER", assetClass: "commodity" as const },
  { id: "oil-wti", label: "OIL (WTI)", assetClass: "commodity" as const },
  // Forex
  { id: "forex-eurusd", label: "EUR/USD", assetClass: "forex" as const },
  { id: "forex-gbpusd", label: "GBP/USD", assetClass: "forex" as const },
  { id: "forex-usdjpy", label: "USD/JPY", assetClass: "forex" as const },
  // Indices
  { id: "index-dax", label: "DAX", assetClass: "index" as const },
  { id: "index-sp500", label: "S&P 500", assetClass: "index" as const },
  { id: "index-nasdaq", label: "NASDAQ", assetClass: "index" as const },
];

export default ASSETS;
