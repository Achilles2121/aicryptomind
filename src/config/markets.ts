import supportedCoins, { formatMarketId } from "./supportedCoins";

export type AssetClass = "crypto";

export type MarketConfig = {
  id: string;
  label: string;
  assetClass: AssetClass;
  defaultProvider: string;
  providerSymbols: Record<string, string>;
  supportsIntraday?: boolean;
  notes?: string;
  base?: string;
  quote?: string;
};

export const DEFAULT_MARKET_ID = "BTCUSD";

const buildMarket = (coin: { id: string; symbol: string; name?: string }): MarketConfig => {
  const base = String(coin.symbol || "").toUpperCase();
  const id = formatMarketId(base);
  return {
    id,
    label: `${base} / USD`,
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base,
    quote: "USD",
    providerSymbols: {
      coingecko: coin.id,
      binance: `${base}USDT`,
    },
    supportsIntraday: true,
  };
};

export const MARKETS: Record<string, MarketConfig> = supportedCoins.reduce((acc, coin) => {
  const base = String(coin.symbol || "").toUpperCase();
  const id = formatMarketId(base);
  if (!id || acc[id]) return acc;
  acc[id] = buildMarket(coin);
  return acc;
}, {} as Record<string, MarketConfig>);

const normalizeKey = (id?: string) => (id || "").trim().toUpperCase();

export function getMarketById(id?: string): MarketConfig {
  const key = normalizeKey(id) || DEFAULT_MARKET_ID;
  return MARKETS[key] || MARKETS[DEFAULT_MARKET_ID];
}

export function findMarketById(id?: string): MarketConfig | undefined {
  const key = normalizeKey(id);
  if (!key) return undefined;
  return MARKETS[key];
}
