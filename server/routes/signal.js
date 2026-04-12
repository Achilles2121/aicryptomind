/**
 * Vision AI Mind - 8-Point Signal API Router
 * Provides real-time trading signals based on the proprietary 8-point algorithm.
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { Router } from "express";
import { compute8PointSignal, getPublicParams } from "../signalEngine.js";
import { withCache } from "../utils/cache.js";

const router = Router();
const CACHE_TTL = 10000; // 10 seconds for fresh signals

// Kraken trading pair mapping
const KRAKEN_PAIR_MAP = {
  BTCUSD: "XXBTZUSD",
  ETHUSD: "XETHZUSD",
  XRPUSD: "XXRPZUSD",
  SOLUSD: "SOLUSD",
  ADAUSD: "ADAUSD",
  DOGEUSD: "XDGUSD",
  DOTUSD: "DOTUSD",
  LINKUSD: "LINKUSD",
  MATICUSD: "MATICUSD",
  AVAXUSD: "AVAXUSD",
  LTCUSD: "XLTCZUSD",
  BNBUSD: "BNBUSD",
  UNIUSD: "UNIUSD",
  XLMUSD: "XXLMZUSD",
  ATOMUSD: "ATOMUSD",
  NEARUSD: "NEARUSD",
  ARBUSD: "ARBUSD",
  OPUSD: "OPUSD",
  SUIUSD: "SUIUSD",
  PEPEUSD: "PEPEUSD",
  SHIBUSD: "SHIBUSD",
  TRXUSD: "TRXUSD",
  TONUSD: "TONUSD",
};

const BINANCE_SYMBOL_MAP = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  XRPUSD: "XRPUSDT",
  SOLUSD: "SOLUSDT",
  ADAUSD: "ADAUSDT",
  DOGEUSD: "DOGEUSDT",
  DOTUSD: "DOTUSDT",
  LINKUSD: "LINKUSDT",
  MATICUSD: "MATICUSDT",
  AVAXUSD: "AVAXUSDT",
  LTCUSD: "LTCUSDT",
  BNBUSD: "BNBUSDT",
  UNIUSD: "UNIUSDT",
  XLMUSD: "XLMUSDT",
  ATOMUSD: "ATOMUSDT",
  NEARUSD: "NEARUSDT",
  ARBUSD: "ARBUSDT",
  OPUSD: "OPUSDT",
  SUIUSD: "SUIUSDT",
  PEPEUSD: "PEPEUSDT",
  SHIBUSD: "SHIBUSDT",
  TRXUSD: "TRXUSDT",
  TONUSD: "TONUSDT",
};

// Normalize asset symbol to internal format (e.g., "BTC" -> "BTCUSD")
const normalizeSymbol = (input) => {
  const raw = String(input || "BTC").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.endsWith("USDT")) return raw.slice(0, -1); // BTCUSDT -> BTCUSD
  if (raw.endsWith("USD")) return raw;
  return `${raw}USD`;
};

// Fetch OHLC data from Kraken
const fetchOHLC = async (pair, interval = 60, limit = 240, signal) => {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`;
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  
  if (!response.ok) {
    throw new Error(`Kraken API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error?.length) {
    throw new Error(data.error.join(", "));
  }
  
  const resultKey = Object.keys(data.result || {}).find((k) => k !== "last");
  const candles = data.result?.[resultKey] || [];
  
  return candles.slice(-limit).map((c) => ({
    t: Number(c[0]) * 1000,
    o: parseFloat(c[1]),
    h: parseFloat(c[2]),
    l: parseFloat(c[3]),
    c: parseFloat(c[4]),
    v: parseFloat(c[6]),
  }));
};

// Calculate technical indicators from OHLC
const calculateIndicators = (candles) => {
  if (!candles?.length || candles.length < 50) {
    return null;
  }
  
  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const volumes = candles.map((c) => c.v);
  const lastPrice = closes[closes.length - 1];
  
  // RSI (14 period)
  const rsi = calculateRSI(closes, 14);
  
  // MACD (12, 26, 9)
  const { macdLine, signalLine, histogram } = calculateMACD(closes, 12, 26, 9);
  
  // Bollinger Bands (20, 2)
  const { upper, middle, lower } = calculateBollingerBands(closes, 20, 2);
  
  // EMAs
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const prevEma20 = calculateEMA(closes.slice(0, -1), 20);
  const prevEma50 = calculateEMA(closes.slice(0, -1), 50);
  
  // Volume
  const volume = volumes[volumes.length - 1];
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  
  // Price change
  const priceChange = closes.length >= 2 ? closes[closes.length - 1] / closes[closes.length - 2] - 1 : 0;
  
  // Support/Resistance
  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);
  
  // Fibonacci levels as array with ratio and price
  const fibLevels = [
    { ratio: 0, price: support },
    { ratio: 0.236, price: support + (resistance - support) * 0.236 },
    { ratio: 0.382, price: support + (resistance - support) * 0.382 },
    { ratio: 0.5, price: support + (resistance - support) * 0.5 },
    { ratio: 0.618, price: support + (resistance - support) * 0.618 },
    { ratio: 0.786, price: support + (resistance - support) * 0.786 },
    { ratio: 1, price: resistance },
  ];
  
  // ATR (14 period)
  const atr = calculateATR(highs, lows, closes, 14);
  const avgAtr = calculateATR(highs.slice(0, -14), lows.slice(0, -14), closes.slice(0, -14), 14);
  
  // Trend
  const trend = ema20 > ema50 ? "bullish" : ema20 < ema50 ? "bearish" : "neutral";
  
  return {
    price: lastPrice,
    rsi,
    macdLine,
    signalLine,
    histogram,
    bollingerUpper: upper,
    bollingerMiddle: middle,
    bollingerLower: lower,
    ema20,
    ema50,
    prevEma20,
    prevEma50,
    volume,
    avgVolume,
    priceChange,
    support,
    resistance,
    fibLevels,
    atr,
    avgAtr,
    trend,
  };
};

// RSI calculation
const calculateRSI = (closes, period = 14) => {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

// EMA calculation
const calculateEMA = (data, period) => {
  if (data.length < period) return data[data.length - 1] || 0;
  
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  
  return ema;
};

// MACD calculation
const calculateMACD = (closes, fast = 12, slow = 26, signal = 9) => {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = emaFast - emaSlow;
  
  // Build MACD history for signal line
  const macdHistory = [];
  for (let i = slow; i < closes.length; i++) {
    const emaF = calculateEMA(closes.slice(0, i + 1), fast);
    const emaS = calculateEMA(closes.slice(0, i + 1), slow);
    macdHistory.push(emaF - emaS);
  }
  
  const signalLine = calculateEMA(macdHistory, signal);
  const histogram = macdLine - signalLine;
  
  return { macdLine, signalLine, histogram };
};

// Bollinger Bands calculation
const calculateBollingerBands = (closes, period = 20, stdDev = 2) => {
  if (closes.length < period) {
    return { upper: closes[closes.length - 1], middle: closes[closes.length - 1], lower: closes[closes.length - 1] };
  }
  
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: middle + stdDev * std,
    middle,
    lower: middle - stdDev * std,
  };
};

// ATR calculation
const calculateATR = (highs, lows, closes, period = 14) => {
  if (closes.length < period + 1) return 0;
  
  let trSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trSum += tr;
  }
  
  return trSum / period;
};

// GET /api/signal?symbol=BTCUSD or /api/signal?asset=BTC
router.get("/", async (req, res) => {
  const startTime = Date.now();
  const rawInput = req.query.asset || req.query.symbol || "BTC";
  const symbol = normalizeSymbol(rawInput);
  const interval = parseInt(req.query.interval) || 60;
  const assetClass = req.query.assetClass || "crypto";
  
  try {
    const krakenPair = KRAKEN_PAIR_MAP[symbol] || symbol.replace("USD", "ZUSD");
    
    const result = await withCache(`signal:${symbol}:${interval}`, CACHE_TTL, async () => {
      // Fetch OHLC data
      const candles = await fetchOHLC(krakenPair, interval, 240, AbortSignal.timeout(10000));
      
      if (!candles?.length) {
        throw new Error("No candle data received");
      }
      
      // Calculate indicators
      const indicators = calculateIndicators(candles);
      
      if (!indicators) {
        throw new Error("Failed to calculate indicators");
      }
      
      // Compute 8-point signal
      const signal = compute8PointSignal(indicators, assetClass);
      
      return {
        symbol,
        ...signal,
        indicators: {
          price: indicators.price,
          rsi: Math.round(indicators.rsi * 10) / 10,
          macd: Math.round(indicators.macdLine * 100) / 100,
          histogram: Math.round(indicators.histogram * 100) / 100,
          trend: indicators.trend,
          support: Math.round(indicators.support * 100) / 100,
          resistance: Math.round(indicators.resistance * 100) / 100,
        },
        candles: candles.length,
      };
    });
    
    return res.json({
      ok: true,
      data: result,
      meta: {
        symbol,
        interval,
        assetClass,
        processingMs: Date.now() - startTime,
        algorithm: "8-point-ohlc",
      },
      generatedAt: new Date().toISOString(),
    });
    
  } catch (err) {
    console.error("[signal] Error:", err.message);
    return res.status(200).json({
      ok: false,
      error: err.message,
      symbol,
      data: {
        signal: "HOLD",
        confidence: 0,
        reasons: ["Error fetching data"],
        levels: {},
      },
      generatedAt: new Date().toISOString(),
    });
  }
});

// GET /api/signal/params/:symbol - Public algorithm parameters
router.get("/params/:symbol", (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol);
  const params = getPublicParams(symbol);
  
  res.json({
    ok: true,
    symbol,
    params,
  });
});

export default router;
