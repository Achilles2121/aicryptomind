// Copyright (c) 2025 Vision AI Mind. All rights reserved.

/**
 * CENTRAL ASSET CONFIGURATION - Single Source of Truth
 * Maps UI labels to technical tickers for Yahoo Finance and TradingView
 * 
 * This config synchronizes with markets.ts and provides TradingView symbols
 */

export interface Asset {
  id: string;           // Internal unique ID (matches markets.ts keys)
  label: string;        // UI display name
  symbol: string;       // Yahoo Finance / Data API symbol
  tvSymbol: string;     // TradingView widget symbol
  base?: string;        // Base currency (e.g., BTC, EUR)
  quote?: string;       // Quote currency (e.g., USD, EUR)
  decimals?: number;    // Price decimal places
  icon?: string;        // Emoji or icon identifier
}

// Support both old and new AssetClass naming
export type AssetClass = "crypto" | "indices" | "commodities" | "forex" | "index" | "commodity" | "fx";
export type NormalizedAssetClass = "crypto" | "indices" | "commodities" | "forex";

export interface AssetConfig {
  crypto: Asset[];
  indices: Asset[];
  commodities: Asset[];
  forex: Asset[];
}

/**
 * Complete asset configuration with all supported trading instruments
 * IDs match exactly with markets.ts keys for seamless integration
 */
export const ASSETS: AssetConfig = {
  crypto: [
    { id: "BTCUSD", label: "Bitcoin", symbol: "BTC-USD", tvSymbol: "BINANCE:BTCUSDT", base: "BTC", quote: "USD", decimals: 2, icon: "₿" },
    { id: "ETHUSD", label: "Ethereum", symbol: "ETH-USD", tvSymbol: "BINANCE:ETHUSDT", base: "ETH", quote: "USD", decimals: 2, icon: "Ξ" },
    { id: "SOLUSD", label: "Solana", symbol: "SOL-USD", tvSymbol: "BINANCE:SOLUSDT", base: "SOL", quote: "USD", decimals: 2, icon: "◎" },
    { id: "XRPUSD", label: "XRP", symbol: "XRP-USD", tvSymbol: "BINANCE:XRPUSDT", base: "XRP", quote: "USD", decimals: 4, icon: "✕" },
    { id: "ADAUSD", label: "Cardano", symbol: "ADA-USD", tvSymbol: "BINANCE:ADAUSDT", base: "ADA", quote: "USD", decimals: 4, icon: "₳" },
    { id: "DOGEUSD", label: "Dogecoin", symbol: "DOGE-USD", tvSymbol: "BINANCE:DOGEUSDT", base: "DOGE", quote: "USD", decimals: 5, icon: "Ð" },
    { id: "DOTUSD", label: "Polkadot", symbol: "DOT-USD", tvSymbol: "BINANCE:DOTUSDT", base: "DOT", quote: "USD", decimals: 3, icon: "●" },
    { id: "AVAXUSD", label: "Avalanche", symbol: "AVAX-USD", tvSymbol: "BINANCE:AVAXUSDT", base: "AVAX", quote: "USD", decimals: 2, icon: "🔺" },
    { id: "LTCUSD", label: "Litecoin", symbol: "LTC-USD", tvSymbol: "BINANCE:LTCUSDT", base: "LTC", quote: "USD", decimals: 2, icon: "Ł" },
    { id: "BNBUSD", label: "BNB", symbol: "BNB-USD", tvSymbol: "BINANCE:BNBUSDT", base: "BNB", quote: "USD", decimals: 2, icon: "🔶" },
    { id: "LINKUSD", label: "Chainlink", symbol: "LINK-USD", tvSymbol: "BINANCE:LINKUSDT", base: "LINK", quote: "USD", decimals: 3, icon: "⬡" },
    { id: "MATICUSD", label: "Polygon", symbol: "MATIC-USD", tvSymbol: "BINANCE:MATICUSDT", base: "MATIC", quote: "USD", decimals: 4, icon: "⬡" },
  ],
  
  indices: [
    // IDs match markets.ts keys exactly
    { id: "DAX", label: "DAX 40", symbol: "^GDAXI", tvSymbol: "XETR:DAX", base: "DAX", quote: "EUR", decimals: 2, icon: "🇩🇪" },
    { id: "SPX", label: "S&P 500", symbol: "^GSPC", tvSymbol: "SP:SPX", base: "SPX", quote: "USD", decimals: 2, icon: "🇺🇸" },
    { id: "NDQ100", label: "NASDAQ 100", symbol: "^NDX", tvSymbol: "NASDAQ:NDX", base: "NDX", quote: "USD", decimals: 2, icon: "📊" },
    { id: "DJI", label: "Dow Jones", symbol: "^DJI", tvSymbol: "DJ:DJI", base: "DJI", quote: "USD", decimals: 2, icon: "🏛️" },
    { id: "FTSE100", label: "FTSE 100", symbol: "^FTSE", tvSymbol: "TVC:UKX", base: "FTSE", quote: "GBP", decimals: 2, icon: "🇬🇧" },
    { id: "NIKKEI225", label: "Nikkei 225", symbol: "^N225", tvSymbol: "TVC:NI225", base: "N225", quote: "JPY", decimals: 2, icon: "🇯🇵" },
    { id: "CAC40", label: "CAC 40", symbol: "^FCHI", tvSymbol: "EURONEXT:PX1", base: "CAC", quote: "EUR", decimals: 2, icon: "🇫🇷" },
    { id: "STOXX50", label: "Euro Stoxx 50", symbol: "^STOXX50E", tvSymbol: "TVC:SX5E", base: "SX5E", quote: "EUR", decimals: 2, icon: "🇪🇺" },
  ],
  
  commodities: [
    // XAUUSD matches markets.ts Gold key
    { id: "XAUUSD", label: "Gold / USD", symbol: "GC=F", tvSymbol: "TVC:GOLD", base: "XAU", quote: "USD", decimals: 2, icon: "🥇" },
    { id: "XAGUSD", label: "Silber / USD", symbol: "SI=F", tvSymbol: "TVC:SILVER", base: "XAG", quote: "USD", decimals: 3, icon: "🥈" },
    { id: "WTIUSD", label: "WTI Crude Oil", symbol: "CL=F", tvSymbol: "TVC:USOIL", base: "WTI", quote: "USD", decimals: 2, icon: "🛢️" },
    { id: "BRENTUSD", label: "Brent Crude", symbol: "BZ=F", tvSymbol: "TVC:UKOIL", base: "BRENT", quote: "USD", decimals: 2, icon: "🛢️" },
    { id: "NATGAS", label: "Erdgas", symbol: "NG=F", tvSymbol: "NYMEX:NG1!", base: "NG", quote: "USD", decimals: 3, icon: "🔥" },
    { id: "COPPER", label: "Kupfer", symbol: "HG=F", tvSymbol: "COMEX:HG1!", base: "HG", quote: "USD", decimals: 4, icon: "🔶" },
    { id: "PLATINUM", label: "Platin", symbol: "PL=F", tvSymbol: "NYMEX:PL1!", base: "PL", quote: "USD", decimals: 2, icon: "⬜" },
  ],
  
  forex: [
    { id: "EURUSD", label: "EUR / USD", symbol: "EURUSD=X", tvSymbol: "FX:EURUSD", base: "EUR", quote: "USD", decimals: 5, icon: "💶" },
    { id: "GBPUSD", label: "GBP / USD", symbol: "GBPUSD=X", tvSymbol: "FX:GBPUSD", base: "GBP", quote: "USD", decimals: 5, icon: "💷" },
    { id: "USDJPY", label: "USD / JPY", symbol: "JPY=X", tvSymbol: "FX:USDJPY", base: "USD", quote: "JPY", decimals: 3, icon: "💴" },
    { id: "USDCHF", label: "USD / CHF", symbol: "CHF=X", tvSymbol: "FX:USDCHF", base: "USD", quote: "CHF", decimals: 5, icon: "🇨🇭" },
    { id: "AUDUSD", label: "AUD / USD", symbol: "AUDUSD=X", tvSymbol: "FX:AUDUSD", base: "AUD", quote: "USD", decimals: 5, icon: "🇦🇺" },
    { id: "USDCAD", label: "USD / CAD", symbol: "CAD=X", tvSymbol: "FX:USDCAD", base: "USD", quote: "CAD", decimals: 5, icon: "🇨🇦" },
    { id: "NZDUSD", label: "NZD / USD", symbol: "NZDUSD=X", tvSymbol: "FX:NZDUSD", base: "NZD", quote: "USD", decimals: 5, icon: "🇳🇿" },
    { id: "EURGBP", label: "EUR / GBP", symbol: "EURGBP=X", tvSymbol: "FX:EURGBP", base: "EUR", quote: "GBP", decimals: 5, icon: "🇪🇺" },
    { id: "EURJPY", label: "EUR / JPY", symbol: "EURJPY=X", tvSymbol: "FX:EURJPY", base: "EUR", quote: "JPY", decimals: 3, icon: "🇪🇺" },
    { id: "GBPJPY", label: "GBP / JPY", symbol: "GBPJPY=X", tvSymbol: "FX:GBPJPY", base: "GBP", quote: "JPY", decimals: 3, icon: "🇬🇧" },
  ],
};

/**
 * Alias map for backward compatibility with older asset IDs
 */
const ASSET_ALIASES: Record<string, string> = {
  // Short crypto forms
  "BTC": "BTCUSD",
  "ETH": "ETHUSD",
  "SOL": "SOLUSD",
  "XRP": "XRPUSD",
  "ADA": "ADAUSD",
  "DOGE": "DOGEUSD",
  "DOT": "DOTUSD",
  "AVAX": "AVAXUSD",
  "LTC": "LTCUSD",
  "BNB": "BNBUSD",
  "LINK": "LINKUSD",
  "MATIC": "MATICUSD",
  // Gold aliases
  "GOLD": "XAUUSD",
  "XAU": "XAUUSD",
  // Silver aliases
  "SILVER": "XAGUSD",
  "XAG": "XAGUSD",
  // Oil aliases
  "OIL": "WTIUSD",
  "WTI": "WTIUSD",
  "BRENT": "BRENTUSD",
  // Index aliases
  "NDX": "NDQ100",
  "NASDAQ": "NDQ100",
  "FTSE": "FTSE100",
  "NIKKEI": "NIKKEI225",
  "N225": "NIKKEI225",
  "CAC": "CAC40",
  "STOXX": "STOXX50",
  "SX5E": "STOXX50",
};

/**
 * Normalize asset class names (maps old names to new standard)
 */
export function normalizeAssetClass(assetClass: AssetClass): NormalizedAssetClass {
  const mapping: Record<string, NormalizedAssetClass> = {
    "crypto": "crypto",
    "index": "indices",
    "indices": "indices",
    "commodity": "commodities",
    "commodities": "commodities",
    "fx": "forex",
    "forex": "forex",
  };
  return mapping[assetClass] || "crypto";
}

/**
 * Get all assets as a flat array
 */
export function getAllAssets(): Asset[] {
  return [
    ...ASSETS.crypto,
    ...ASSETS.indices,
    ...ASSETS.commodities,
    ...ASSETS.forex,
  ];
}

/**
 * Find asset by ID (case-insensitive, supports aliases)
 */
export function getAssetById(id: string): Asset | undefined {
  if (!id) return undefined;
  const normalized = id.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  
  // Check aliases first
  const aliasedId = ASSET_ALIASES[normalized];
  const searchId = aliasedId || normalized;
  
  return getAllAssets().find(
    (a) => a.id.toUpperCase() === searchId || 
           a.id.toUpperCase().replaceAll(/[^A-Z0-9]/g, "") === searchId ||
           a.base?.toUpperCase() === searchId
  );
}

/**
 * Find asset by label (fuzzy match)
 */
export function getAssetByLabel(label: string): Asset | undefined {
  const normalized = label.toLowerCase().trim();
  return getAllAssets().find(
    (a) => a.label.toLowerCase() === normalized ||
           a.label.toLowerCase().includes(normalized)
  );
}

/**
 * Get TradingView symbol for an asset ID
 */
export function getTVSymbolForAsset(id: string): string {
  const asset = getAssetById(id);
  if (asset?.tvSymbol) {
    return asset.tvSymbol;
  }
  
  // Fallback: check aliases
  const normalized = id?.toUpperCase().replaceAll(/[^A-Z0-9]/g, "") || "";
  const aliasedId = ASSET_ALIASES[normalized];
  if (aliasedId) {
    const aliasedAsset = getAssetById(aliasedId);
    if (aliasedAsset?.tvSymbol) return aliasedAsset.tvSymbol;
  }
  
  return "BINANCE:BTCUSDT";
}

/**
 * Get Yahoo Finance symbol for an asset ID
 */
export function getYahooSymbolForAsset(id: string): string {
  const asset = getAssetById(id);
  return asset?.symbol || "BTC-USD";
}

/**
 * Determine asset class from ID
 */
export function getAssetClass(id: string): NormalizedAssetClass {
  const normalized = id?.toUpperCase().replaceAll(/[^A-Z0-9]/g, "") || "";
  
  // Check aliases
  const aliasedId = ASSET_ALIASES[normalized];
  const searchId = aliasedId || normalized;
  
  if (ASSETS.crypto.some((a) => a.id === searchId || a.base === searchId)) return "crypto";
  if (ASSETS.indices.some((a) => a.id === searchId)) return "indices";
  if (ASSETS.commodities.some((a) => a.id === searchId || a.base === searchId)) return "commodities";
  if (ASSETS.forex.some((a) => a.id === searchId)) return "forex";
  
  // Fallback heuristics
  if (["DAX", "SPX", "NDX", "DJI", "FTSE", "NIKKEI", "NDQ100", "FTSE100", "NIKKEI225", "CAC40", "STOXX50"].includes(searchId)) return "indices";
  if (["GOLD", "SILVER", "OIL", "GAS", "COPPER", "XAUUSD", "XAGUSD", "WTIUSD", "BRENTUSD", "NATGAS", "PLATINUM"].includes(searchId)) return "commodities";
  if (["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY"].includes(searchId)) return "forex";
  
  return "crypto"; // Default
}

/**
 * Get assets by class (supports both old and new naming)
 */
export function getAssetsByClass(assetClass: AssetClass): Asset[] {
  const normalized = normalizeAssetClass(assetClass);
  return ASSETS[normalized] || [];
}

/**
 * Asset class display names (German)
 */
export const ASSET_CLASS_LABELS: Record<NormalizedAssetClass, string> = {
  crypto: "Kryptowährungen",
  indices: "Indizes",
  commodities: "Rohstoffe",
  forex: "Devisen (Forex)",
};

/**
 * Asset class icons
 */
export const ASSET_CLASS_ICONS: Record<NormalizedAssetClass, string> = {
  crypto: "₿",
  indices: "📈",
  commodities: "🥇",
  forex: "💱",
};

/**
 * Default asset for each class
 */
export const DEFAULT_ASSETS: Record<NormalizedAssetClass, string> = {
  crypto: "BTCUSD",
  indices: "DAX",
  commodities: "XAUUSD",
  forex: "EURUSD",
};

export default ASSETS;
