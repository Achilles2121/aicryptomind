export type AssetClass = "crypto" | "index" | "commodity" | "fx";

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

export const MARKETS: Record<string, MarketConfig> = {
  BTCUSD: {
    id: "BTCUSD",
    label: "BTC / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "BTC",
    quote: "USD",
    providerSymbols: {
      coingecko: "bitcoin",
      binance: "BTCUSDT",
      kraken: "XXBTZUSD",
      coinapi: "BTC/USD",
    },
    supportsIntraday: true,
  },
  ETHUSD: {
    id: "ETHUSD",
    label: "ETH / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "ETH",
    quote: "USD",
    providerSymbols: {
      coingecko: "ethereum",
      binance: "ETHUSDT",
      kraken: "XETHZUSD",
      coinapi: "ETH/USD",
    },
    supportsIntraday: true,
  },
  SOLUSD: {
    id: "SOLUSD",
    label: "SOL / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "SOL",
    quote: "USD",
    providerSymbols: {
      coingecko: "solana",
      binance: "SOLUSDT",
      kraken: "SOLUSD",
      coinapi: "SOL/USD",
    },
    supportsIntraday: true,
  },
  XRPUSD: {
    id: "XRPUSD",
    label: "XRP / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "XRP",
    quote: "USD",
    providerSymbols: {
      coingecko: "ripple",
      binance: "XRPUSDT",
      kraken: "XRPUSD",
      coinapi: "XRP/USD",
    },
    supportsIntraday: true,
  },
  ADAUSD: {
    id: "ADAUSD",
    label: "ADA / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "ADA",
    quote: "USD",
    providerSymbols: {
      coingecko: "cardano",
      binance: "ADAUSDT",
      kraken: "ADAUSD",
      coinapi: "ADA/USD",
    },
    supportsIntraday: true,
  },
  LTCUSD: {
    id: "LTCUSD",
    label: "LTC / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "LTC",
    quote: "USD",
    providerSymbols: {
      coingecko: "litecoin",
      binance: "LTCUSDT",
      kraken: "XLTCZUSD",
      coinapi: "LTC/USD",
    },
    supportsIntraday: true,
  },
  DOGEUSD: {
    id: "DOGEUSD",
    label: "DOGE / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "DOGE",
    quote: "USD",
    providerSymbols: {
      coingecko: "dogecoin",
      binance: "DOGEUSDT",
      kraken: "XDGUSD",
      coinapi: "DOGE/USD",
    },
    supportsIntraday: true,
  },
  BNBUSD: {
    id: "BNBUSD",
    label: "BNB / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "BNB",
    quote: "USD",
    providerSymbols: {
      coingecko: "binancecoin",
      binance: "BNBUSDT",
      kraken: "BNBUSD",
      coinapi: "BNB/USD",
    },
    supportsIntraday: true,
  },
  AVAXUSD: {
    id: "AVAXUSD",
    label: "AVAX / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "AVAX",
    quote: "USD",
    providerSymbols: {
      coingecko: "avalanche-2",
      binance: "AVAXUSDT",
      kraken: "AVAXUSD",
      coinapi: "AVAX/USD",
    },
    supportsIntraday: true,
  },
  DOTUSD: {
    id: "DOTUSD",
    label: "DOT / USD",
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base: "DOT",
    quote: "USD",
    providerSymbols: {
      coingecko: "polkadot",
      binance: "DOTUSDT",
      kraken: "DOTUSD",
      coinapi: "DOT/USD",
    },
    supportsIntraday: true,
  },
  DAX: {
    id: "DAX",
    label: "DAX 40",
    assetClass: "index",
    defaultProvider: "STOOQ",
    base: "DAX",
    quote: "EUR",
    providerSymbols: {
      STOOQ: "^DAX",
    },
    supportsIntraday: false,
    notes: "Daily OHLC from Stooq",
  },
  SPX: {
    id: "SPX",
    label: "S&P 500",
    assetClass: "index",
    defaultProvider: "STOOQ",
    base: "SPX",
    quote: "USD",
    providerSymbols: {
      STOOQ: "^SPX",
    },
    supportsIntraday: false,
  },
  NDQ100: {
    id: "NDQ100",
    label: "Nasdaq 100",
    assetClass: "index",
    defaultProvider: "STOOQ",
    base: "NDQ100",
    quote: "USD",
    providerSymbols: {
      STOOQ: "^NDQ",
    },
    supportsIntraday: false,
  },
  DJI: {
    id: "DJI",
    label: "Dow Jones",
    assetClass: "index",
    defaultProvider: "STOOQ",
    base: "DJI",
    quote: "USD",
    providerSymbols: {
      STOOQ: "^DJI",
    },
    supportsIntraday: false,
  },
  FTSE100: {
    id: "FTSE100",
    label: "FTSE 100",
    assetClass: "index",
    defaultProvider: "STOOQ",
    base: "FTSE100",
    quote: "GBP",
    providerSymbols: {
      STOOQ: "^FTSE",
    },
    supportsIntraday: false,
  },
  NIKKEI225: {
    id: "NIKKEI225",
    label: "Nikkei 225",
    assetClass: "index",
    defaultProvider: "STOOQ",
    base: "NIKKEI225",
    quote: "JPY",
    providerSymbols: {
      STOOQ: "^NIKKEI",
    },
    supportsIntraday: false,
  },
  XAUUSD: {
    id: "XAUUSD",
    label: "Gold / USD",
    assetClass: "commodity",
    defaultProvider: "FX_PROVIDER",
    base: "XAU",
    quote: "USD",
    providerSymbols: {
      FX_PROVIDER: "XAUUSD",
    },
    supportsIntraday: false,
  },
  EURUSD: {
    id: "EURUSD",
    label: "EUR / USD",
    assetClass: "fx",
    defaultProvider: "FX_PROVIDER",
    base: "EUR",
    quote: "USD",
    providerSymbols: {
      FX_PROVIDER: "EURUSD",
    },
    supportsIntraday: true,
  },
  GBPUSD: {
    id: "GBPUSD",
    label: "GBP / USD",
    assetClass: "fx",
    defaultProvider: "FX_PROVIDER",
    base: "GBP",
    quote: "USD",
    providerSymbols: {
      FX_PROVIDER: "GBPUSD",
    },
    supportsIntraday: true,
  },
  USDJPY: {
    id: "USDJPY",
    label: "USD / JPY",
    assetClass: "fx",
    defaultProvider: "FX_PROVIDER",
    base: "USD",
    quote: "JPY",
    providerSymbols: {
      FX_PROVIDER: "USDJPY",
    },
    supportsIntraday: true,
  },
  USDCHF: {
    id: "USDCHF",
    label: "USD / CHF",
    assetClass: "fx",
    defaultProvider: "FX_PROVIDER",
    base: "USD",
    quote: "CHF",
    providerSymbols: {
      FX_PROVIDER: "USDCHF",
    },
    supportsIntraday: true,
  },
  AUDUSD: {
    id: "AUDUSD",
    label: "AUD / USD",
    assetClass: "fx",
    defaultProvider: "FX_PROVIDER",
    base: "AUD",
    quote: "USD",
    providerSymbols: {
      FX_PROVIDER: "AUDUSD",
    },
    supportsIntraday: true,
  },
  USDCAD: {
    id: "USDCAD",
    label: "USD / CAD",
    assetClass: "fx",
    defaultProvider: "FX_PROVIDER",
    base: "USD",
    quote: "CAD",
    providerSymbols: {
      FX_PROVIDER: "USDCAD",
    },
    supportsIntraday: true,
  },
};

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
