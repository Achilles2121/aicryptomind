export const assetSources = {
  BTC: { cg: "bitcoin", kraken: "XXBTZUSD", binance: "BTCUSDT" },
  ETH: { cg: "ethereum", kraken: "XETHZUSD", binance: "ETHUSDT" },
  SOL: { cg: "solana", kraken: "SOLUSD", binance: "SOLUSDT" },
  XRP: { cg: "ripple", kraken: "XRPUSD", binance: "XRPUSDT" },
  ADA: { cg: "cardano", kraken: "ADAUSD", binance: "ADAUSDT" },
  LTC: { cg: "litecoin", kraken: "XLTCZUSD", binance: "LTCUSDT" },
  DOGE: { cg: "dogecoin", kraken: "XDGUSD", binance: "DOGEUSDT" },
  BNB: { cg: "binancecoin", kraken: "BNBUSD", binance: "BNBUSDT" },
  AVAX: { cg: "avalanche-2", kraken: "AVAXUSD", binance: "AVAXUSDT" },
  DOT: { cg: "polkadot", kraken: "DOTUSD", binance: "DOTUSDT" },
};

export const symbolFromPair = (pair) => {
  if (!pair) return null;
  const normalized = pair.toUpperCase();
  const entry = Object.entries(assetSources).find(([, value]) => value.kraken === normalized);
  return entry ? entry[0] : null;
};
