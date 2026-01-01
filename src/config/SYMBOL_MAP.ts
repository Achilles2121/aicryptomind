/**
 * SYMBOL_MAP - Crypto Asset Configuration
 * Maps UI display names to provider-specific tickers
 */

import supportedCoins from "./supportedCoins";

export type AssetType = "crypto";

export interface AssetConfig {
  ticker: string;
  type: AssetType;
  updateInterval: number;
  useBinance?: boolean;
  binanceSymbol?: string;
  displayName?: string;
  decimals?: number;
  currency?: string;
}

const normalizeKey = (value: string): string =>
  value.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");

const addKey = (map: Record<string, AssetConfig>, key: string | undefined, config: AssetConfig) => {
  if (!key) return;
  if (!map[key]) {
    map[key] = config;
  }
};

const buildConfig = (coin: { id: string; symbol: string; name?: string }): AssetConfig => {
  const symbol = normalizeKey(coin.symbol);
  return {
    ticker: `${symbol}-USD`,
    type: "crypto",
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: `${symbol}USDT`,
    displayName: coin.name || symbol,
    decimals: 2,
    currency: "$",
  };
};

export const SYMBOL_MAP: Record<string, AssetConfig> = supportedCoins.reduce((acc, coin) => {
  const config = buildConfig(coin);
  const symbol = normalizeKey(coin.symbol);
  addKey(acc, symbol, config);
  addKey(acc, coin.id, config);
  addKey(acc, `${symbol}USD`, config);
  addKey(acc, `${symbol}USDT`, config);
  return acc;
}, {} as Record<string, AssetConfig>);

export function getAssetConfig(symbol: string): AssetConfig | null {
  if (!symbol) return null;
  if (SYMBOL_MAP[symbol]) return SYMBOL_MAP[symbol];

  const normalized = symbol.toUpperCase();
  if (SYMBOL_MAP[normalized]) return SYMBOL_MAP[normalized];

  const cleaned = normalizeKey(symbol);
  return SYMBOL_MAP[cleaned] || null;
}

export function getSymbolsByType(type: AssetType): string[] {
  return Object.entries(SYMBOL_MAP)
    .filter(([_, config]) => config.type === type)
    .map(([symbol]) => symbol);
}

export function usesBinance(symbol: string): boolean {
  const config = getAssetConfig(symbol);
  return config?.useBinance === true;
}

export function getUpdateInterval(symbol: string): number {
  const config = getAssetConfig(symbol);
  return config?.updateInterval ?? 1000;
}

export function formatPrice(symbol: string, price: number): string {
  const config = getAssetConfig(symbol);
  const decimals = config?.decimals ?? 2;
  const currency = config?.currency ?? "$";

  const formatted = price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return currency ? `${currency}${formatted}` : formatted;
}

export default SYMBOL_MAP;
