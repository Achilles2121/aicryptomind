// Copyright (c) 2025 Vision AI Mind. All rights reserved.

/**
 * TradingView Symbol Mapping
 * Maps UI display names to TradingView ticker symbols
 * 
 * Priorität: Realtime-Daten (CFD Provider) > Börsen-Daten (oft verzögert)
 */

export interface TVAssetConfig {
  tvSymbol: string;       // TradingView Widget Symbol
  displayName: string;    // Formatierter Anzeigename für Header
  shortName: string;      // Kurzform
  assetClass: "crypto" | "index" | "forex" | "commodity";
}

/**
 * Mapping von UI-Labels zu TradingView Symbolen
 * Key: So wie das Asset in der Sidebar/UI angezeigt wird
 * Value: TradingView-kompatibles Symbol
 */
export const TRADINGVIEW_SYMBOL_MAP: Record<string, TVAssetConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // INDIZES - CFD Provider für Realtime, Börsen oft 15min verzögert
  // ═══════════════════════════════════════════════════════════════════════════
  "DAX": { tvSymbol: "XETR:DAX", displayName: "DAX 40 (GER40)", shortName: "DAX", assetClass: "index" },
  "DAX 40": { tvSymbol: "XETR:DAX", displayName: "DAX 40 (GER40)", shortName: "DAX", assetClass: "index" },
  "SPX": { tvSymbol: "SP:SPX", displayName: "S&P 500 (US500)", shortName: "SPX", assetClass: "index" },
  "S&P 500": { tvSymbol: "SP:SPX", displayName: "S&P 500 (US500)", shortName: "SPX", assetClass: "index" },
  "NDQ100": { tvSymbol: "NASDAQ:NDX", displayName: "NASDAQ 100 (US100)", shortName: "NDX", assetClass: "index" },
  "Nasdaq 100": { tvSymbol: "NASDAQ:NDX", displayName: "NASDAQ 100 (US100)", shortName: "NDX", assetClass: "index" },
  "NASDAQ": { tvSymbol: "NASDAQ:NDX", displayName: "NASDAQ 100 (US100)", shortName: "NDX", assetClass: "index" },
  "DJI": { tvSymbol: "DJ:DJI", displayName: "Dow Jones (US30)", shortName: "DJI", assetClass: "index" },
  "Dow Jones": { tvSymbol: "DJ:DJI", displayName: "Dow Jones (US30)", shortName: "DJI", assetClass: "index" },
  "FTSE100": { tvSymbol: "TVC:UKX", displayName: "FTSE 100 (UK100)", shortName: "FTSE", assetClass: "index" },
  "FTSE 100": { tvSymbol: "TVC:UKX", displayName: "FTSE 100 (UK100)", shortName: "FTSE", assetClass: "index" },
  "NIKKEI225": { tvSymbol: "TVC:NI225", displayName: "Nikkei 225 (JP225)", shortName: "NI225", assetClass: "index" },
  "Nikkei 225": { tvSymbol: "TVC:NI225", displayName: "Nikkei 225 (JP225)", shortName: "NI225", assetClass: "index" },
  "CAC40": { tvSymbol: "EURONEXT:PX1", displayName: "CAC 40 (FRA40)", shortName: "CAC", assetClass: "index" },
  "CAC 40": { tvSymbol: "EURONEXT:PX1", displayName: "CAC 40 (FRA40)", shortName: "CAC", assetClass: "index" },
  "STOXX50": { tvSymbol: "TVC:SX5E", displayName: "Euro Stoxx 50", shortName: "SX5E", assetClass: "index" },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOREX - FX/OANDA für beste Realtime-Daten
  // ═══════════════════════════════════════════════════════════════════════════
  "EURUSD": { tvSymbol: "FX:EURUSD", displayName: "EUR/USD", shortName: "EURUSD", assetClass: "forex" },
  "EUR / USD": { tvSymbol: "FX:EURUSD", displayName: "EUR/USD", shortName: "EURUSD", assetClass: "forex" },
  "EUR/USD": { tvSymbol: "FX:EURUSD", displayName: "EUR/USD", shortName: "EURUSD", assetClass: "forex" },
  "GBPUSD": { tvSymbol: "FX:GBPUSD", displayName: "GBP/USD", shortName: "GBPUSD", assetClass: "forex" },
  "GBP / USD": { tvSymbol: "FX:GBPUSD", displayName: "GBP/USD", shortName: "GBPUSD", assetClass: "forex" },
  "GBP/USD": { tvSymbol: "FX:GBPUSD", displayName: "GBP/USD", shortName: "GBPUSD", assetClass: "forex" },
  "USDJPY": { tvSymbol: "FX:USDJPY", displayName: "USD/JPY", shortName: "USDJPY", assetClass: "forex" },
  "USD / JPY": { tvSymbol: "FX:USDJPY", displayName: "USD/JPY", shortName: "USDJPY", assetClass: "forex" },
  "USD/JPY": { tvSymbol: "FX:USDJPY", displayName: "USD/JPY", shortName: "USDJPY", assetClass: "forex" },
  "USDCHF": { tvSymbol: "FX:USDCHF", displayName: "USD/CHF", shortName: "USDCHF", assetClass: "forex" },
  "USD / CHF": { tvSymbol: "FX:USDCHF", displayName: "USD/CHF", shortName: "USDCHF", assetClass: "forex" },
  "AUDUSD": { tvSymbol: "FX:AUDUSD", displayName: "AUD/USD", shortName: "AUDUSD", assetClass: "forex" },
  "AUD / USD": { tvSymbol: "FX:AUDUSD", displayName: "AUD/USD", shortName: "AUDUSD", assetClass: "forex" },
  "USDCAD": { tvSymbol: "FX:USDCAD", displayName: "USD/CAD", shortName: "USDCAD", assetClass: "forex" },
  "USD / CAD": { tvSymbol: "FX:USDCAD", displayName: "USD/CAD", shortName: "USDCAD", assetClass: "forex" },
  "NZDUSD": { tvSymbol: "FX:NZDUSD", displayName: "NZD/USD", shortName: "NZDUSD", assetClass: "forex" },
  "NZD / USD": { tvSymbol: "FX:NZDUSD", displayName: "NZD/USD", shortName: "NZDUSD", assetClass: "forex" },
  "EURGBP": { tvSymbol: "FX:EURGBP", displayName: "EUR/GBP", shortName: "EURGBP", assetClass: "forex" },
  "EUR / GBP": { tvSymbol: "FX:EURGBP", displayName: "EUR/GBP", shortName: "EURGBP", assetClass: "forex" },
  "EURJPY": { tvSymbol: "FX:EURJPY", displayName: "EUR/JPY", shortName: "EURJPY", assetClass: "forex" },
  "EUR / JPY": { tvSymbol: "FX:EURJPY", displayName: "EUR/JPY", shortName: "EURJPY", assetClass: "forex" },
  "GBPJPY": { tvSymbol: "FX:GBPJPY", displayName: "GBP/JPY", shortName: "GBPJPY", assetClass: "forex" },
  "GBP / JPY": { tvSymbol: "FX:GBPJPY", displayName: "GBP/JPY", shortName: "GBPJPY", assetClass: "forex" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ROHSTOFFE - OANDA/TVC für Realtime (Futures sind oft verzögert)
  // ═══════════════════════════════════════════════════════════════════════════
  "XAUUSD": { tvSymbol: "OANDA:XAUUSD", displayName: "GOLD (XAU/USD)", shortName: "GOLD", assetClass: "commodity" },
  "Gold": { tvSymbol: "OANDA:XAUUSD", displayName: "GOLD (XAU/USD)", shortName: "GOLD", assetClass: "commodity" },
  "Gold / USD": { tvSymbol: "OANDA:XAUUSD", displayName: "GOLD (XAU/USD)", shortName: "GOLD", assetClass: "commodity" },
  "GOLD": { tvSymbol: "OANDA:XAUUSD", displayName: "GOLD (XAU/USD)", shortName: "GOLD", assetClass: "commodity" },
  "XAGUSD": { tvSymbol: "OANDA:XAGUSD", displayName: "SILBER (XAG/USD)", shortName: "SILVER", assetClass: "commodity" },
  "Silver": { tvSymbol: "OANDA:XAGUSD", displayName: "SILBER (XAG/USD)", shortName: "SILVER", assetClass: "commodity" },
  "Silber": { tvSymbol: "OANDA:XAGUSD", displayName: "SILBER (XAG/USD)", shortName: "SILVER", assetClass: "commodity" },
  "Silber / USD": { tvSymbol: "OANDA:XAGUSD", displayName: "SILBER (XAG/USD)", shortName: "SILVER", assetClass: "commodity" },
  "SILVER": { tvSymbol: "OANDA:XAGUSD", displayName: "SILBER (XAG/USD)", shortName: "SILVER", assetClass: "commodity" },
  "WTIUSD": { tvSymbol: "TVC:USOIL", displayName: "WTI OIL (CL)", shortName: "WTI", assetClass: "commodity" },
  "WTI Crude Oil": { tvSymbol: "TVC:USOIL", displayName: "WTI OIL (CL)", shortName: "WTI", assetClass: "commodity" },
  "OIL": { tvSymbol: "TVC:USOIL", displayName: "WTI OIL (CL)", shortName: "WTI", assetClass: "commodity" },
  "BRENTUSD": { tvSymbol: "TVC:UKOIL", displayName: "BRENT OIL", shortName: "BRENT", assetClass: "commodity" },
  "Brent Crude": { tvSymbol: "TVC:UKOIL", displayName: "BRENT OIL", shortName: "BRENT", assetClass: "commodity" },
  "NATGAS": { tvSymbol: "PEPPERSTONE:NATGAS", displayName: "ERDGAS (NG)", shortName: "NATGAS", assetClass: "commodity" },
  "Erdgas": { tvSymbol: "PEPPERSTONE:NATGAS", displayName: "ERDGAS (NG)", shortName: "NATGAS", assetClass: "commodity" },
  "COPPER": { tvSymbol: "TVC:COPPER", displayName: "KUPFER (HG)", shortName: "COPPER", assetClass: "commodity" },
  "Kupfer": { tvSymbol: "TVC:COPPER", displayName: "KUPFER (HG)", shortName: "COPPER", assetClass: "commodity" },
  "PLATINUM": { tvSymbol: "TVC:PLATINUM", displayName: "PLATIN (PL)", shortName: "PLAT", assetClass: "commodity" },
  "Platin": { tvSymbol: "TVC:PLATINUM", displayName: "PLATIN (PL)", shortName: "PLAT", assetClass: "commodity" },

  // ═══════════════════════════════════════════════════════════════════════════
  // KRYPTO - Binance für beste Liquidität & Realtime
  // ═══════════════════════════════════════════════════════════════════════════
  "BTCUSD": { tvSymbol: "BINANCE:BTCUSDT", displayName: "Bitcoin (BTC/USD)", shortName: "BTC", assetClass: "crypto" },
  "Bitcoin": { tvSymbol: "BINANCE:BTCUSDT", displayName: "Bitcoin (BTC/USD)", shortName: "BTC", assetClass: "crypto" },
  "BTC / USD": { tvSymbol: "BINANCE:BTCUSDT", displayName: "Bitcoin (BTC/USD)", shortName: "BTC", assetClass: "crypto" },
  "BTC": { tvSymbol: "BINANCE:BTCUSDT", displayName: "Bitcoin (BTC/USD)", shortName: "BTC", assetClass: "crypto" },
  "ETHUSD": { tvSymbol: "BINANCE:ETHUSDT", displayName: "Ethereum (ETH/USD)", shortName: "ETH", assetClass: "crypto" },
  "Ethereum": { tvSymbol: "BINANCE:ETHUSDT", displayName: "Ethereum (ETH/USD)", shortName: "ETH", assetClass: "crypto" },
  "ETH / USD": { tvSymbol: "BINANCE:ETHUSDT", displayName: "Ethereum (ETH/USD)", shortName: "ETH", assetClass: "crypto" },
  "ETH": { tvSymbol: "BINANCE:ETHUSDT", displayName: "Ethereum (ETH/USD)", shortName: "ETH", assetClass: "crypto" },
  "SOLUSD": { tvSymbol: "BINANCE:SOLUSDT", displayName: "Solana (SOL/USD)", shortName: "SOL", assetClass: "crypto" },
  "Solana": { tvSymbol: "BINANCE:SOLUSDT", displayName: "Solana (SOL/USD)", shortName: "SOL", assetClass: "crypto" },
  "SOL / USD": { tvSymbol: "BINANCE:SOLUSDT", displayName: "Solana (SOL/USD)", shortName: "SOL", assetClass: "crypto" },
  "SOL": { tvSymbol: "BINANCE:SOLUSDT", displayName: "Solana (SOL/USD)", shortName: "SOL", assetClass: "crypto" },
  "XRPUSD": { tvSymbol: "BINANCE:XRPUSDT", displayName: "XRP (XRP/USD)", shortName: "XRP", assetClass: "crypto" },
  "XRP": { tvSymbol: "BINANCE:XRPUSDT", displayName: "XRP (XRP/USD)", shortName: "XRP", assetClass: "crypto" },
  "XRP / USD": { tvSymbol: "BINANCE:XRPUSDT", displayName: "XRP (XRP/USD)", shortName: "XRP", assetClass: "crypto" },
  "ADAUSD": { tvSymbol: "BINANCE:ADAUSDT", displayName: "Cardano (ADA/USD)", shortName: "ADA", assetClass: "crypto" },
  "Cardano": { tvSymbol: "BINANCE:ADAUSDT", displayName: "Cardano (ADA/USD)", shortName: "ADA", assetClass: "crypto" },
  "ADA / USD": { tvSymbol: "BINANCE:ADAUSDT", displayName: "Cardano (ADA/USD)", shortName: "ADA", assetClass: "crypto" },
  "ADA": { tvSymbol: "BINANCE:ADAUSDT", displayName: "Cardano (ADA/USD)", shortName: "ADA", assetClass: "crypto" },
  "DOGEUSD": { tvSymbol: "BINANCE:DOGEUSDT", displayName: "Dogecoin (DOGE/USD)", shortName: "DOGE", assetClass: "crypto" },
  "Dogecoin": { tvSymbol: "BINANCE:DOGEUSDT", displayName: "Dogecoin (DOGE/USD)", shortName: "DOGE", assetClass: "crypto" },
  "DOGE / USD": { tvSymbol: "BINANCE:DOGEUSDT", displayName: "Dogecoin (DOGE/USD)", shortName: "DOGE", assetClass: "crypto" },
  "DOGE": { tvSymbol: "BINANCE:DOGEUSDT", displayName: "Dogecoin (DOGE/USD)", shortName: "DOGE", assetClass: "crypto" },
  "DOTUSD": { tvSymbol: "BINANCE:DOTUSDT", displayName: "Polkadot (DOT/USD)", shortName: "DOT", assetClass: "crypto" },
  "Polkadot": { tvSymbol: "BINANCE:DOTUSDT", displayName: "Polkadot (DOT/USD)", shortName: "DOT", assetClass: "crypto" },
  "DOT": { tvSymbol: "BINANCE:DOTUSDT", displayName: "Polkadot (DOT/USD)", shortName: "DOT", assetClass: "crypto" },
  "AVAXUSD": { tvSymbol: "BINANCE:AVAXUSDT", displayName: "Avalanche (AVAX/USD)", shortName: "AVAX", assetClass: "crypto" },
  "Avalanche": { tvSymbol: "BINANCE:AVAXUSDT", displayName: "Avalanche (AVAX/USD)", shortName: "AVAX", assetClass: "crypto" },
  "AVAX": { tvSymbol: "BINANCE:AVAXUSDT", displayName: "Avalanche (AVAX/USD)", shortName: "AVAX", assetClass: "crypto" },
  "LTCUSD": { tvSymbol: "BINANCE:LTCUSDT", displayName: "Litecoin (LTC/USD)", shortName: "LTC", assetClass: "crypto" },
  "Litecoin": { tvSymbol: "BINANCE:LTCUSDT", displayName: "Litecoin (LTC/USD)", shortName: "LTC", assetClass: "crypto" },
  "LTC": { tvSymbol: "BINANCE:LTCUSDT", displayName: "Litecoin (LTC/USD)", shortName: "LTC", assetClass: "crypto" },
  "BNBUSD": { tvSymbol: "BINANCE:BNBUSDT", displayName: "BNB (BNB/USD)", shortName: "BNB", assetClass: "crypto" },
  "BNB": { tvSymbol: "BINANCE:BNBUSDT", displayName: "BNB (BNB/USD)", shortName: "BNB", assetClass: "crypto" },
  "LINKUSD": { tvSymbol: "BINANCE:LINKUSDT", displayName: "Chainlink (LINK/USD)", shortName: "LINK", assetClass: "crypto" },
  "Chainlink": { tvSymbol: "BINANCE:LINKUSDT", displayName: "Chainlink (LINK/USD)", shortName: "LINK", assetClass: "crypto" },
  "LINK": { tvSymbol: "BINANCE:LINKUSDT", displayName: "Chainlink (LINK/USD)", shortName: "LINK", assetClass: "crypto" },
  "MATICUSD": { tvSymbol: "BINANCE:MATICUSDT", displayName: "Polygon (MATIC/USD)", shortName: "MATIC", assetClass: "crypto" },
  "Polygon": { tvSymbol: "BINANCE:MATICUSDT", displayName: "Polygon (MATIC/USD)", shortName: "MATIC", assetClass: "crypto" },
  "MATIC": { tvSymbol: "BINANCE:MATICUSDT", displayName: "Polygon (MATIC/USD)", shortName: "MATIC", assetClass: "crypto" },
};

/**
 * Holt das TradingView-Symbol für einen Asset-Namen
 * Unterstützt verschiedene Schreibweisen und Formate
 */
export function getTVSymbol(assetName: string): string {
  if (!assetName) return "BINANCE:BTCUSDT";
  
  // Direkter Lookup
  const config = TRADINGVIEW_SYMBOL_MAP[assetName];
  if (config) return config.tvSymbol;
  
  // Normalisiert versuchen (ohne Leerzeichen, uppercase)
  const normalized = assetName.trim().toUpperCase();
  const normalizedConfig = TRADINGVIEW_SYMBOL_MAP[normalized];
  if (normalizedConfig) return normalizedConfig.tvSymbol;
  
  // Fallback: Wenn es wie ein TradingView-Symbol aussieht, direkt verwenden
  if (assetName.includes(":")) return assetName;
  
  // Crypto-Fallback für unbekannte Assets
  console.warn(`[TradingView] Unknown asset: "${assetName}", falling back to BTC`);
  return "BINANCE:BTCUSDT";
}

/**
 * Holt die vollständige Config für einen Asset-Namen
 */
export function getTVConfig(assetName: string): TVAssetConfig {
  if (!assetName) {
    return TRADINGVIEW_SYMBOL_MAP["BTCUSD"];
  }
  
  // Direkter Lookup
  let config = TRADINGVIEW_SYMBOL_MAP[assetName];
  if (config) return config;
  
  // Normalisiert versuchen
  const normalized = assetName.trim().toUpperCase();
  config = TRADINGVIEW_SYMBOL_MAP[normalized];
  if (config) return config;
  
  // Fallback
  return TRADINGVIEW_SYMBOL_MAP["BTCUSD"];
}

/**
 * Holt den formatierten Header-Titel für ein Asset
 */
export function getAssetDisplayName(assetName: string): string {
  const config = getTVConfig(assetName);
  return config?.displayName || assetName;
}

/**
 * Asset-Klassen-Farben für UI
 */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  crypto: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  index: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  forex: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  commodity: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
};

export default TRADINGVIEW_SYMBOL_MAP;
