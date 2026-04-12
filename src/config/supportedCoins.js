const normalizeSymbol = (symbol) => String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export const formatTradingViewSymbol = (symbol) => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return "BINANCE:BTCUSDT";
  const base = normalized.endsWith("USDT")
    ? normalized.slice(0, -4)
    : normalized.endsWith("USD")
    ? normalized.slice(0, -3)
    : normalized;
  return `BINANCE:${base}USDT`;
};

export const formatMarketId = (symbol) => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return "BTCUSD";
  const base = normalized.endsWith("USDT")
    ? normalized.slice(0, -4)
    : normalized.endsWith("USD")
    ? normalized.slice(0, -3)
    : normalized;
  return `${base}USD`;
};

const supportedCoins = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", rank: 1 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", rank: 2 },
  { id: "tether", symbol: "USDT", name: "Tether", rank: 3 },
  { id: "binancecoin", symbol: "BNB", name: "BNB", rank: 4 },
  { id: "ripple", symbol: "XRP", name: "XRP", rank: 5 },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin", rank: 6 },
  { id: "solana", symbol: "SOL", name: "Solana", rank: 7 },
  { id: "tron", symbol: "TRX", name: "TRON", rank: 8 },
  { id: "staked-ether", symbol: "STETH", name: "Lido Staked Ether", rank: 9 },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", rank: 10 },
  { id: "figure-heloc", symbol: "FHL", name: "Figure Heloc", rank: 11 },
  { id: "cardano", symbol: "ADA", name: "Cardano", rank: 12 },
  { id: "whitebit", symbol: "WBT", name: "WhiteBIT", rank: 13 },
  { id: "wrapped-steth", symbol: "WSTETH", name: "Wrapped Staked Ether", rank: 14 },
  { id: "bitcoin-cash", symbol: "BCH", name: "Bitcoin Cash", rank: 15 },
  { id: "wrapped-bitcoin", symbol: "WBTC", name: "Wrapped Bitcoin", rank: 16 },
  { id: "wrapped-beacon-eth", symbol: "WBETH", name: "Wrapped Beacon ETH", rank: 17 },
  { id: "usds", symbol: "USDS", name: "USDS", rank: 18 },
  { id: "wrapped-eeth", symbol: "WEETH", name: "Wrapped eETH", rank: 19 },
  { id: "binance-bridged-usdt-bnb-smart-chain", symbol: "USDT", name: "Binance-Peg USDT", rank: 20 },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", rank: 21 },
  { id: "monero", symbol: "XMR", name: "Monero", rank: 22 },
  { id: "weth", symbol: "WETH", name: "Wrapped Ether", rank: 23 },
  { id: "leo-token", symbol: "LEO", name: "LEO Token", rank: 24 },
  { id: "stellar", symbol: "XLM", name: "Stellar", rank: 25 },
  { id: "zcash", symbol: "ZEC", name: "Zcash", rank: 26 },
  { id: "ethena-usde", symbol: "USDE", name: "Ethena USDe", rank: 27 },
  { id: "coinbase-wrapped-btc", symbol: "CBBTC", name: "Coinbase Wrapped BTC", rank: 28 },
  { id: "litecoin", symbol: "LTC", name: "Litecoin", rank: 29 },
  { id: "hyperliquid", symbol: "HYPE", name: "Hyperliquid", rank: 30 },
  { id: "sui", symbol: "SUI", name: "Sui", rank: 31 },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", rank: 32 },
  { id: "hedera-hashgraph", symbol: "HBAR", name: "Hedera", rank: 33 },
  { id: "susds", symbol: "SUSDS", name: "sUSDS", rank: 34 },
  { id: "dai", symbol: "DAI", name: "Dai", rank: 35 },
  { id: "usdt0", symbol: "USDT0", name: "USDT0", rank: 36 },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", rank: 37 },
  { id: "paypal-usd", symbol: "PYUSD", name: "PayPal USD", rank: 38 },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", rank: 39 },
  { id: "crypto-com-chain", symbol: "CRO", name: "Cronos", rank: 40 },
  { id: "the-open-network", symbol: "TON", name: "Toncoin", rank: 41 },
  { id: "world-liberty-financial", symbol: "WLFI", name: "World Liberty Financial", rank: 42 },
  { id: "mantle", symbol: "MNT", name: "Mantle", rank: 43 },
  { id: "ethena-staked-usde", symbol: "SUSDE", name: "Ethena Staked USDe", rank: 44 },
  { id: "canton-network", symbol: "CANT", name: "Canton Network", rank: 45 },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", rank: 46 },
  { id: "usd1-wlfi", symbol: "USD1", name: "USD1 WLFI", rank: 47 },
  { id: "rain", symbol: "RAIN", name: "Rain", rank: 48 },
  { id: "bitget-token", symbol: "BGB", name: "Bitget Token", rank: 49 },
  { id: "tether-gold", symbol: "XAUT", name: "Tether Gold", rank: 50 },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", rank: 51 },
  { id: "optimism", symbol: "OP", name: "Optimism", rank: 52 },
  { id: "polygon", symbol: "MATIC", name: "Polygon", rank: 53 },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol", rank: 54 },
  { id: "pepe", symbol: "PEPE", name: "Pepe", rank: 55 },
];

// ============================================
// GOLD & FOREX ASSETS (Premium Assets)
// ============================================

export const GOLD_FOREX_ASSETS = [
  {
    id: "gold-xauusd",
    symbol: "XAUUSD",
    name: "Gold / US Dollar",
    rank: 100,
    assetClass: "commodity",
    tradingViewSymbol: "OANDA:XAUUSD",
    metatraderSymbol: "XAUUSD",
    isSafeHaven: true,
    volatilityProfile: "low",
  },
  {
    id: "forex-eurusd",
    symbol: "EURUSD",
    name: "Euro / US Dollar",
    rank: 101,
    assetClass: "forex",
    tradingViewSymbol: "FX:EURUSD",
    metatraderSymbol: "EURUSD",
    isSafeHaven: false,
    volatilityProfile: "low",
  },
  {
    id: "forex-gbpusd",
    symbol: "GBPUSD",
    name: "British Pound / US Dollar",
    rank: 102,
    assetClass: "forex",
    tradingViewSymbol: "FX:GBPUSD",
    metatraderSymbol: "GBPUSD",
    isSafeHaven: false,
    volatilityProfile: "medium",
  },
  {
    id: "forex-usdjpy",
    symbol: "USDJPY",
    name: "US Dollar / Japanese Yen",
    rank: 103,
    assetClass: "forex",
    tradingViewSymbol: "FX:USDJPY",
    metatraderSymbol: "USDJPY",
    isSafeHaven: true,
    volatilityProfile: "low",
  },
  {
    id: "silver-xagusd",
    symbol: "XAGUSD",
    name: "Silver / US Dollar",
    rank: 104,
    assetClass: "commodity",
    tradingViewSymbol: "OANDA:XAGUSD",
    metatraderSymbol: "XAGUSD",
    isSafeHaven: true,
    volatilityProfile: "medium",
  },
  {
    id: "oil-wti",
    symbol: "WTIUSD",
    name: "Oil (WTI Crude)",
    rank: 105,
    assetClass: "commodity",
    tradingViewSymbol: "TVC:USOIL",
    metatraderSymbol: "USOIL",
    isSafeHaven: false,
    volatilityProfile: "medium",
  },
  {
    id: "index-dax",
    symbol: "DAX",
    name: "DAX 40",
    rank: 200,
    assetClass: "index",
    tradingViewSymbol: "XETR:DAX",
    metatraderSymbol: "GER40",
    isSafeHaven: false,
    volatilityProfile: "medium",
  },
  {
    id: "index-sp500",
    symbol: "SP500",
    name: "S&P 500",
    rank: 201,
    assetClass: "index",
    tradingViewSymbol: "SP:SPX",
    metatraderSymbol: "US500",
    isSafeHaven: false,
    volatilityProfile: "medium",
  },
  {
    id: "index-nasdaq",
    symbol: "NASDAQ",
    name: "NASDAQ Composite",
    rank: 202,
    assetClass: "index",
    tradingViewSymbol: "NASDAQ:IXIC",
    metatraderSymbol: "USTEC",
    isSafeHaven: false,
    volatilityProfile: "medium",
  },
];

// Combined assets for full market coverage
export const ALL_ASSETS = [...supportedCoins, ...GOLD_FOREX_ASSETS];

// Asset class detection
export const getAssetClass = (symbolOrId) => {
  const normalized = String(symbolOrId || "").toUpperCase();
  const goldForex = GOLD_FOREX_ASSETS.find(
    (a) => a.symbol === normalized || a.id === symbolOrId
  );
  if (goldForex) return goldForex.assetClass;
  return "crypto";
};

// Safe Haven detection for risk analysis
export const isSafeHavenAsset = (symbolOrId) => {
  const normalized = String(symbolOrId || "").toUpperCase();
  const asset = GOLD_FOREX_ASSETS.find(
    (a) => a.symbol === normalized || a.id === symbolOrId
  );
  return asset?.isSafeHaven ?? false;
};

// Volatility profile for algorithm adjustment
export const getVolatilityProfile = (symbolOrId) => {
  const normalized = String(symbolOrId || "").toUpperCase();
  const goldForex = GOLD_FOREX_ASSETS.find(
    (a) => a.symbol === normalized || a.id === symbolOrId
  );
  if (goldForex) return goldForex.volatilityProfile;
  // Crypto defaults to high volatility
  return "high";
};

// TradingView symbol resolution
export const getTradingViewSymbol = (symbolOrId) => {
  const normalized = String(symbolOrId || "").toUpperCase();
  
  // Check Gold/Forex first
  const goldForex = GOLD_FOREX_ASSETS.find(
    (a) => a.symbol === normalized || a.id === symbolOrId
  );
  if (goldForex) return goldForex.tradingViewSymbol;
  
  // Crypto - use Binance
  return formatTradingViewSymbol(normalized);
};

// MetaTrader symbol resolution
export const getMetaTraderSymbol = (symbolOrId) => {
  const normalized = String(symbolOrId || "").toUpperCase();
  const goldForex = GOLD_FOREX_ASSETS.find(
    (a) => a.symbol === normalized || a.id === symbolOrId
  );
  if (goldForex) return goldForex.metatraderSymbol;
  // Crypto uses symbol directly
  return normalized.replace(/USD$/, "");
};

export const SUPPORTED_COIN_IDS = new Set(supportedCoins.map((coin) => coin.id));
export const SUPPORTED_SYMBOLS = new Set(supportedCoins.map((coin) => coin.symbol.toUpperCase()));
export const SUPPORTED_TICKERS = new Set(supportedCoins.map((coin) => formatMarketId(coin.symbol)));

// Extended sets including Gold/Forex
export const ALL_ASSET_IDS = new Set([...SUPPORTED_COIN_IDS, ...GOLD_FOREX_ASSETS.map((a) => a.id)]);
export const ALL_SYMBOLS = new Set([...SUPPORTED_SYMBOLS, ...GOLD_FOREX_ASSETS.map((a) => a.symbol)]);

export default supportedCoins;