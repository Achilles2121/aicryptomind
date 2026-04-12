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

// Kraken uses special pair formats - map common symbols
const KRAKEN_PAIR_MAP: Record<string, string> = {
  BTC: "XXBTZUSD",
  ETH: "XETHZUSD",
  XRP: "XXRPZUSD",
  SOL: "SOLUSD",
  DOGE: "XDGUSD",
  ADA: "ADAUSD",
  DOT: "DOTUSD",
  LINK: "LINKUSD",
  AVAX: "AVAXUSD",
  MATIC: "MATICUSD",
  LTC: "XLTCZUSD",
  BCH: "BCHUSD",
  SHIB: "SHIBUSD",
  UNI: "UNIUSD",
  ATOM: "ATOMUSD",
  XLM: "XXLMZUSD",
  TRX: "TRXUSD",
  NEAR: "NEARUSD",
  ARB: "ARBUSD",
  OP: "OPUSD",
  APE: "APEUSD",
  CRV: "CRVUSD",
  AAVE: "AAVEUSD",
  MKR: "MKRUSD",
  SNX: "SNXUSD",
  COMP: "COMPUSD",
  GRT: "GRTUSD",
  FIL: "FILUSD",
  SAND: "SANDUSD",
  MANA: "MANAUSD",
  AXS: "AXSUSD",
  ENJ: "ENJUSD",
  BAT: "BATUSD",
  ZEC: "XZECZUSD",
  EOS: "EOSUSD",
  XMR: "XXMRZUSD",
  XTZ: "XTZUSD",
  ALGO: "ALGOUSD",
  DASH: "DASHUSD",
  WAVES: "WAVESUSD",
  ZRX: "ZRXUSD",
  KSM: "KSMUSD",
  KAVA: "KAVAUSD",
  FLOW: "FLOWUSD",
  RUNE: "RUNEUSD",
  LUNA: "LUNAUSD",
  OSMO: "OSMOUSD",
  INJ: "INJUSD",
  IMX: "IMXUSD",
  GMT: "GMTUSD",
  APT: "APTUSD",
  SUI: "SUIUSD",
  PEPE: "PEPEUSD",
  HBAR: "HBARUSD",
  TON: "TONUSD",
  WIF: "WIFUSD",
  BONK: "BONKUSD",
  BGB: "BGBUSD",
  HYPE: "HYPEUSD",
  MNT: "MNTUSD",
};

const getKrakenPair = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  return KRAKEN_PAIR_MAP[upper] || `${upper}USD`;
};

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
      kraken: getKrakenPair(base),
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
