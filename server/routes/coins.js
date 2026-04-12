import { Router } from "express";
import { withCache } from "../utils/cache.js";

const router = Router();

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 60000; // 1 minute

// Supported coins mapping for icons and binance symbols
const COIN_CONFIG = {
  bitcoin: { symbol: "BTC", binance: "BTCUSDT" },
  ethereum: { symbol: "ETH", binance: "ETHUSDT" },
  binancecoin: { symbol: "BNB", binance: "BNBUSDT" },
  solana: { symbol: "SOL", binance: "SOLUSDT" },
  ripple: { symbol: "XRP", binance: "XRPUSDT" },
  cardano: { symbol: "ADA", binance: "ADAUSDT" },
  avalanche: { symbol: "AVAX", binance: "AVAXUSDT" },
  dogecoin: { symbol: "DOGE", binance: "DOGEUSDT" },
  polkadot: { symbol: "DOT", binance: "DOTUSDT" },
  chainlink: { symbol: "LINK", binance: "LINKUSDT" },
  tron: { symbol: "TRX", binance: "TRXUSDT" },
  polygon: { symbol: "MATIC", binance: "MATICUSDT" },
  litecoin: { symbol: "LTC", binance: "LTCUSDT" },
  uniswap: { symbol: "UNI", binance: "UNIUSDT" },
  stellar: { symbol: "XLM", binance: "XLMUSDT" },
  cosmos: { symbol: "ATOM", binance: "ATOMUSDT" },
  monero: { symbol: "XMR", binance: "XMRUSDT" },
  "ethereum-classic": { symbol: "ETC", binance: "ETCUSDT" },
  filecoin: { symbol: "FIL", binance: "FILUSDT" },
  hedera: { symbol: "HBAR", binance: "HBARUSDT" },
  "internet-computer": { symbol: "ICP", binance: "ICPUSDT" },
  aptos: { symbol: "APT", binance: "APTUSDT" },
  arbitrum: { symbol: "ARB", binance: "ARBUSDT" },
  optimism: { symbol: "OP", binance: "OPUSDT" },
  near: { symbol: "NEAR", binance: "NEARUSDT" },
  injective: { symbol: "INJ", binance: "INJUSDT" },
  render: { symbol: "RNDR", binance: "RNDRUSDT" },
  sui: { symbol: "SUI", binance: "SUIUSDT" },
  pepe: { symbol: "PEPE", binance: "PEPEUSDT" },
  bonk: { symbol: "BONK", binance: "BONKUSDT" },
};

router.get("/", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  
  const vs = String(req.query.vs || "usd").toLowerCase();
  const limit = Math.min(parseInt(req.query.limit) || 100, 250);
  
  try {
    const data = await withCache(`coins:${vs}:${limit}`, CACHE_TTL, async () => {
      const url = `${COINGECKO_API}/coins/markets?vs_currency=${vs}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h,7d`;
      
      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      
      const coins = await response.json();
      
      return coins.map((coin) => {
        const config = COIN_CONFIG[coin.id] || {};
        return {
          id: coin.id,
          symbol: coin.symbol?.toUpperCase() || config.symbol,
          name: coin.name,
          image: coin.image,
          current_price: coin.current_price,
          price_change_percentage_24h: coin.price_change_percentage_24h,
          price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          total_volume: coin.total_volume,
          circulating_supply: coin.circulating_supply,
          total_supply: coin.total_supply,
          max_supply: coin.max_supply,
          ath: coin.ath,
          ath_change_percentage: coin.ath_change_percentage,
          sparkline_in_7d: coin.sparkline_in_7d,
          binanceSymbol: config.binance || `${coin.symbol?.toUpperCase()}USDT`,
          price_source: "coingecko",
        };
      });
    });
    
    return res.status(200).json({
      success: true,
      ok: true,
      data,
      count: data.length,
      vs_currency: vs,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[coins] Error:", err.message);
    return res.status(200).json({
      success: false,
      ok: false,
      error: err.message || "Failed to fetch coins",
      data: [],
      generatedAt: new Date().toISOString(),
    });
  }
});

export default router;
