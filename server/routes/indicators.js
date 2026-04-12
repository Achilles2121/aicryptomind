import { Router } from "express";
import { fetchKrakenOhlc } from "../../api/_lib/providers/kraken.js";
import { fetchBinanceKlines } from "../../api/_lib/providers/binance.js";
import { fetchCoingeckoOhlc } from "../../api/_lib/providers/coingecko.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { clampNumber, mapBinanceInterval, normalizeCandles } from "../../api/_lib/utils.js";
import { withCache } from "../utils/cache.js";
import { buildIndicators } from "../utils/indicators.js";

const MIN_POINTS = 30;

// Asset ID to provider symbol mapping - ALL 55 supported coins
const ASSET_CONFIG = {
  // === MAJOR CRYPTOS (Rank 1-10) ===
  BTC: { kraken: "XXBTZUSD", binance: "BTCUSDT", coingecko: "bitcoin" },
  ETH: { kraken: "XETHZUSD", binance: "ETHUSDT", coingecko: "ethereum" },
  USDT: { kraken: "USDTZUSD", binance: null, coingecko: "tether" }, // Stablecoin - use BTC chart as reference
  BNB: { kraken: null, binance: "BNBUSDT", coingecko: "binancecoin" },
  XRP: { kraken: "XXRPZUSD", binance: "XRPUSDT", coingecko: "ripple" },
  USDC: { kraken: "USDCUSD", binance: null, coingecko: "usd-coin" }, // Stablecoin
  SOL: { kraken: "SOLUSD", binance: "SOLUSDT", coingecko: "solana" },
  TRX: { kraken: "TRXUSD", binance: "TRXUSDT", coingecko: "tron" },
  STETH: { kraken: null, binance: null, coingecko: "staked-ether" }, // Use ETH as fallback
  DOGE: { kraken: "XDGUSD", binance: "DOGEUSDT", coingecko: "dogecoin" },
  
  // === MID-CAP (Rank 11-20) ===
  FHL: { kraken: null, binance: null, coingecko: "figure-heloc" },
  ADA: { kraken: "ADAUSD", binance: "ADAUSDT", coingecko: "cardano" },
  WBT: { kraken: null, binance: null, coingecko: "whitebit" },
  WSTETH: { kraken: null, binance: "WSTETHUSDT", coingecko: "wrapped-steth" },
  BCH: { kraken: "BCHUSD", binance: "BCHUSDT", coingecko: "bitcoin-cash" },
  WBTC: { kraken: "WBTCUSD", binance: "WBTCUSDT", coingecko: "wrapped-bitcoin" },
  WBETH: { kraken: null, binance: "WBETHUSDT", coingecko: "wrapped-beacon-eth" },
  USDS: { kraken: null, binance: null, coingecko: "usds" },
  WEETH: { kraken: null, binance: "WEETHUSDT", coingecko: "wrapped-eeth" },
  
  // === ALTCOINS (Rank 21-30) ===
  LINK: { kraken: "LINKUSD", binance: "LINKUSDT", coingecko: "chainlink" },
  XMR: { kraken: "XXMRZUSD", binance: null, coingecko: "monero" }, // Not on Binance (delisted)
  WETH: { kraken: null, binance: "WETHUSDT", coingecko: "weth" },
  LEO: { kraken: null, binance: null, coingecko: "leo-token" },
  XLM: { kraken: "XXLMZUSD", binance: "XLMUSDT", coingecko: "stellar" },
  ZEC: { kraken: "XZECZUSD", binance: null, coingecko: "zcash" }, // Not on Binance (delisted)
  USDE: { kraken: null, binance: "USDEUSDT", coingecko: "ethena-usde" },
  CBBTC: { kraken: null, binance: null, coingecko: "coinbase-wrapped-btc" },
  LTC: { kraken: "XLTCZUSD", binance: "LTCUSDT", coingecko: "litecoin" },
  HYPE: { kraken: null, binance: null, coingecko: "hyperliquid" },
  
  // === LAYER 1s & 2s (Rank 31-40) ===
  SUI: { kraken: "SUIUSD", binance: "SUIUSDT", coingecko: "sui" },
  AVAX: { kraken: "AVAXUSD", binance: "AVAXUSDT", coingecko: "avalanche-2" },
  HBAR: { kraken: "HBARUSD", binance: "HBARUSDT", coingecko: "hedera-hashgraph" },
  SUSDS: { kraken: null, binance: null, coingecko: "susds" },
  DAI: { kraken: "DAIUSD", binance: "DAIUSDT", coingecko: "dai" },
  USDT0: { kraken: null, binance: null, coingecko: "usdt0" },
  SHIB: { kraken: "SHIBUSD", binance: "SHIBUSDT", coingecko: "shiba-inu" },
  PYUSD: { kraken: null, binance: null, coingecko: "paypal-usd" },
  UNI: { kraken: "UNIUSD", binance: "UNIUSDT", coingecko: "uniswap" },
  CRO: { kraken: "CROUSD", binance: "CROUSDT", coingecko: "crypto-com-chain" },
  
  // === LAYER 1s & EMERGING (Rank 41-50) ===
  TON: { kraken: "TONUSD", binance: "TONUSDT", coingecko: "the-open-network" },
  WLFI: { kraken: null, binance: null, coingecko: "world-liberty-financial" },
  MNT: { kraken: null, binance: null, coingecko: "mantle" }, // Not on Binance - CoinGecko only
  SUSDE: { kraken: null, binance: null, coingecko: "ethena-staked-usde" },
  CANT: { kraken: null, binance: null, coingecko: "canton-network" },
  DOT: { kraken: "DOTUSD", binance: "DOTUSDT", coingecko: "polkadot" },
  USD1: { kraken: null, binance: null, coingecko: "usd1-wlfi" },
  RAIN: { kraken: null, binance: null, coingecko: "rain" },
  BGB: { kraken: null, binance: null, coingecko: "bitget-token" },
  XAUT: { kraken: "XAUTUSD", binance: null, coingecko: "tether-gold" }, // Gold-backed
  
  // === LAYER 2s & MEMES (Rank 51-55) ===
  ARB: { kraken: "ARBUSD", binance: "ARBUSDT", coingecko: "arbitrum" },
  OP: { kraken: "OPUSD", binance: "OPUSDT", coingecko: "optimism" },
  MATIC: { kraken: "MATICUSD", binance: "MATICUSDT", coingecko: "polygon" },
  NEAR: { kraken: "NEARUSD", binance: "NEARUSDT", coingecko: "near" },
  PEPE: { kraken: "PEPEUSD", binance: "PEPEUSDT", coingecko: "pepe" },
  
  // === ADDITIONAL LEGACY SUPPORT ===
  ATOM: { kraken: "ATOMUSD", binance: "ATOMUSDT", coingecko: "cosmos" },
  AAVE: { kraken: "AAVEUSD", binance: "AAVEUSDT", coingecko: "aave" },
  APE: { kraken: "APEUSD", binance: "APEUSDT", coingecko: "apecoin" },
  FTM: { kraken: "FTMUSD", binance: "FTMUSDT", coingecko: "fantom" },
  SAND: { kraken: "SANDUSD", binance: "SANDUSDT", coingecko: "the-sandbox" },
  MANA: { kraken: "MANAUSD", binance: "MANAUSDT", coingecko: "decentraland" },
  AXS: { kraken: "AXSUSD", binance: "AXSUSDT", coingecko: "axie-infinity" },
  ALGO: { kraken: "ALGOUSD", binance: "ALGOUSDT", coingecko: "algorand" },
  EOS: { kraken: "EOSUSD", binance: "EOSUSDT", coingecko: "eos" },
  XTZ: { kraken: "XTZUSD", binance: "XTZUSDT", coingecko: "tezos" },
  VET: { kraken: null, binance: "VETUSDT", coingecko: "vechain" },
  THETA: { kraken: "THETAUSD", binance: "THETAUSDT", coingecko: "theta-token" },
  FIL: { kraken: "FILUSD", binance: "FILUSDT", coingecko: "filecoin" },
  GRT: { kraken: "GRTUSD", binance: "GRTUSDT", coingecko: "the-graph" },
  EGLD: { kraken: "EGLDUSD", binance: "EGLDUSDT", coingecko: "elrond-erd-2" },
  ICP: { kraken: "ICPUSD", binance: "ICPUSDT", coingecko: "internet-computer" },
  APT: { kraken: "APTUSD", binance: "APTUSDT", coingecko: "aptos" },
  INJ: { kraken: "INJUSD", binance: "INJUSDT", coingecko: "injective-protocol" },
  RUNE: { kraken: "RUNEUSD", binance: "RUNEUSDT", coingecko: "thorchain" },
  IMX: { kraken: "IMXUSD", binance: "IMXUSDT", coingecko: "immutable-x" },
  SEI: { kraken: "SEIUSD", binance: "SEIUSDT", coingecko: "sei-network" },
  STX: { kraken: "STXUSD", binance: "STXUSDT", coingecko: "blockstack" },
  RENDER: { kraken: "RENDERUSD", binance: "RENDERUSDT", coingecko: "render-token" },
  TIA: { kraken: "TIAUSD", binance: "TIAUSDT", coingecko: "celestia" },
  WIF: { kraken: "WIFUSD", binance: "WIFUSDT", coingecko: "dogwifcoin" },
  BONK: { kraken: "BONKUSD", binance: "BONKUSDT", coingecko: "bonk" },
  FLOKI: { kraken: "FLOKIUSD", binance: "FLOKIUSDT", coingecko: "floki" },
  JUP: { kraken: "JUPUSD", binance: "JUPUSDT", coingecko: "jupiter-exchange-solana" },
  
  // === GOLD & FOREX (Premium Assets) ===
  GOLD: { kraken: "XAUUSD", binance: null, coingecko: null },
  XAUUSD: { kraken: "XAUUSD", binance: null, coingecko: "tether-gold" },
  EURUSD: { kraken: "EURUSD", binance: null, coingecko: null },
  GBPUSD: { kraken: "GBPUSD", binance: null, coingecko: null },
};

// Resolve asset ID to provider symbols
const resolveAssetSymbols = (assetId) => {
  const normalized = String(assetId || "BTC").toUpperCase().replace(/USD$/, "");
  const config = ASSET_CONFIG[normalized];
  if (config) return config;
  
  // Fallback for unknown assets
  return {
    kraken: `${normalized}USD`,
    binance: `${normalized}USDT`,
    coingecko: normalized.toLowerCase(),
  };
};

const fetchCandles = async ({ asset, pair, binanceSymbol, coingeckoId, interval, limit, cacheMs }) => {
  const cacheKey = `indicators:${asset}:${interval}:${limit}`;

  return withCache(cacheKey, cacheMs, async () => {
    const tracker = createHealthTracker();

    try {
      if (pair) {
        const kraken = await fetchKrakenOhlc(pair, interval, limit);
        if (kraken.length >= MIN_POINTS) {
          tracker.set("kraken", "ok");
          return { candles: normalizeCandles(kraken), health: tracker.toArray() };
        }
        tracker.set("kraken", kraken.length ? "degraded" : "error", "kraken sample too small");
      }
    } catch (err) {
      tracker.set("kraken", "error", err?.message || "kraken failed");
    }

    try {
      if (binanceSymbol) {
        const binance = await fetchBinanceKlines(binanceSymbol, { limit, interval: mapBinanceInterval(interval) });
        if (binance.length >= MIN_POINTS) {
          tracker.set("binance", "ok");
          return { candles: normalizeCandles(binance), health: tracker.toArray() };
        }
        tracker.set("binance", binance.length ? "degraded" : "error", "binance sample too small");
      }
    } catch (err) {
      tracker.set("binance", "error", err?.message || "binance failed");
    }

    try {
      const cgId = coingeckoId || "bitcoin";
      const cg = await fetchCoingeckoOhlc(cgId, { days: interval >= 1440 ? 30 : 7 });
      if (cg.length >= MIN_POINTS) {
        tracker.set("coingecko", "ok");
        return { candles: normalizeCandles(cg), health: tracker.toArray() };
      }
      tracker.set("coingecko", cg.length ? "degraded" : "error", "coingecko sample too small");
    } catch (err) {
      tracker.set("coingecko", "error", err?.message || "coingecko failed");
    }

    return { candles: [], health: tracker.toArray() };
  });
};

const router = Router();

router.get("/", async (req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  
  // Support both legacy (pair/symbol) and new (asset) parameter formats
  const rawAsset = req.query.asset || req.query.pair?.replace(/^X+|Z?USD$/g, "") || "BTC";
  const assetSymbols = resolveAssetSymbols(rawAsset);
  
  const pair = req.query.pair ? String(req.query.pair).toUpperCase() : assetSymbols.kraken;
  const binanceSymbol = req.query.symbol || req.query.binance 
    ? String(req.query.symbol || req.query.binance).toUpperCase() 
    : assetSymbols.binance;
  const coingeckoId = assetSymbols.coingecko;
  
  const interval = clampNumber(req.query.interval || 60, { min: 1, max: 1440 });
  const limit = clampNumber(req.query.limit || 240, { min: 60, max: 720 });
  const cacheMs = clampNumber(req.query.cacheMs || 500, { min: 0, max: 5000 });
  const type = String(req.query.type || "all").toLowerCase();
  const params = {};
  ["period", "fast", "slow", "signal", "fastPeriod", "slowPeriod", "smoothK", "smoothD"].forEach((key) => {
    const value = Number(req.query[key]);
    if (Number.isFinite(value)) params[key] = value;
  });

  try {
    const { candles, health } = await fetchCandles({ 
      asset: rawAsset, 
      pair, 
      binanceSymbol, 
      coingeckoId,
      interval, 
      limit, 
      cacheMs 
    });
    if (!candles?.length) {
      return res.status(502).json({ error: "indicator_source_unavailable", health, generatedAt: new Date().toISOString() });
    }
    const indicator = buildIndicators(candles, { type, params });
    const payload = {
      ok: true,
      data: indicator,
      meta: {
        asset: rawAsset,
        pair,
        binanceSymbol,
        interval,
        limit,
        type,
        params,
      },
      health,
      generatedAt: new Date().toISOString(),
    };
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

export default router;
