// Strategy Engine V3: separates setups and confidence computation.
// Vision AI Mind - Enhanced with MTF Confirmation, Volume Analysis, Dynamic TP/SL

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ============================================
// MULTI-TIMEFRAME (MTF) ALIGNMENT
// ============================================

/**
 * Checks if multiple timeframes align for signal confirmation.
 * Returns a score from 0 (no alignment) to 1 (full alignment).
 * @param {Object} mtfData - Object containing regime labels for 1h, 4h, 1d
 * @param {string} signalDirection - 'long' or 'short'
 */
export const computeMTFAlignment = (mtfData = {}, signalDirection) => {
  if (!signalDirection) return { score: 0, aligned: false, breakdown: {} };
  
  const regimes = {
    htf1h: mtfData.htf1h || null,
    htf4h: mtfData.htf4h || null,
    htf1d: mtfData.htf1d || null,
  };
  
  const bullishRegimes = ['Bull'];
  const bearishRegimes = ['Bear'];
  const neutralRegimes = ['Crab', 'Choppy'];
  
  let alignedCount = 0;
  let totalChecked = 0;
  const breakdown = {};
  
  for (const [tf, regime] of Object.entries(regimes)) {
    if (!regime) continue;
    totalChecked++;
    
    let isAligned = false;
    if (signalDirection === 'long') {
      isAligned = bullishRegimes.includes(regime) || neutralRegimes.includes(regime);
    } else if (signalDirection === 'short') {
      isAligned = bearishRegimes.includes(regime) || neutralRegimes.includes(regime);
    }
    
    if (isAligned) alignedCount++;
    breakdown[tf] = { regime, aligned: isAligned };
  }
  
  const score = totalChecked > 0 ? alignedCount / totalChecked : 0;
  const aligned = score >= 0.66; // At least 2 of 3 timeframes must align
  
  return { score, aligned, breakdown, alignedCount, totalChecked };
};

// ============================================
// ENHANCED VOLUME CONFIRMATION
// ============================================

/**
 * Computes volume confirmation score with multiple checks:
 * 1. Volume spike detection (current vs 20-period average)
 * 2. Volume trend (increasing/decreasing)
 * 3. Price-Volume divergence detection
 */
export const computeVolumeConfirmation = (row, prevRows = []) => {
  if (!row || !Number.isFinite(row.volume)) {
    return { score: 0.5, confirmed: false, spike: false, trend: 'neutral' };
  }
  
  // Volume spike check
  const volumeSpike = row.volumeSpike && row.volumeSpike >= 1.3;
  const strongSpike = row.volumeSpike && row.volumeSpike >= 2.0;
  
  // Volume trend (last 5 bars if available)
  let volTrend = 'neutral';
  let trendScore = 0.5;
  if (prevRows.length >= 5) {
    const recent5 = prevRows.slice(-5);
    const volChange = recent5.reduce((acc, r, i) => {
      if (i === 0 || !Number.isFinite(r.volume) || !Number.isFinite(recent5[i-1].volume)) return acc;
      return acc + (r.volume > recent5[i-1].volume ? 1 : -1);
    }, 0);
    
    if (volChange >= 2) {
      volTrend = 'increasing';
      trendScore = 0.8;
    } else if (volChange <= -2) {
      volTrend = 'decreasing';
      trendScore = 0.3;
    }
  }
  
  // Price-Volume divergence (bearish divergence = price up, volume down)
  let divergence = 'none';
  if (prevRows.length >= 3) {
    const priceUp = row.close > prevRows[prevRows.length - 3].close;
    const volDown = row.volume < prevRows[prevRows.length - 3].volume;
    const priceDown = row.close < prevRows[prevRows.length - 3].close;
    const volUp = row.volume > prevRows[prevRows.length - 3].volume;
    
    if (priceUp && volDown) divergence = 'bearish';
    if (priceDown && volUp) divergence = 'bullish';
  }
  
  // Calculate final score
  let score = 0.5;
  if (volumeSpike) score += 0.2;
  if (strongSpike) score += 0.15;
  score += (trendScore - 0.5) * 0.3;
  
  const confirmed = volumeSpike || (volTrend === 'increasing' && divergence !== 'bearish');
  
  return {
    score: clamp01(score),
    confirmed,
    spike: volumeSpike,
    strongSpike,
    trend: volTrend,
    divergence,
  };
};

// ============================================
// VOLATILITY SCORE (Enhanced)
// ============================================

export const computeVolatilityScore = (atrPct) => {
  if (!Number.isFinite(atrPct)) return 0.3;
  if (atrPct <= 0.3) return 0.2;
  if (atrPct >= 4) return 0.2;
  if (atrPct >= 0.5 && atrPct <= 2.5) return 0.9;
  if (atrPct > 2.5 && atrPct < 4) return 0.6;
  return 0.4;
};

export const computeFlowScore = (smartMoney = {}) => {
  if (smartMoney.pct === undefined || smartMoney.pct === null) return 0.5;
  return clamp01((smartMoney.pct + 100) / 200);
};

const matchesRegime = (regimeLabel, allowed = []) => {
  if (!regimeLabel) return false;
  return allowed.includes(regimeLabel);
};

export const evaluateTrendSetup = (row, meta) => {
  const { regimeLabel, smartMoney, volatilityScoreOverride } = meta || {};
  if (!matchesRegime(regimeLabel, ["Bull", "Bear"])) return { trigger: false };
  const atrPct = row.atrPct;
  const volScore = volatilityScoreOverride ?? computeVolatilityScore(atrPct);
  const flowScore = computeFlowScore(smartMoney);
  const macdDiff =
    Number.isFinite(row.macd) && Number.isFinite(row.macdSignal) ? row.macd - row.macdSignal : null;
  const vwap = row.vwap;
  const trendUp = row.ema200 && row.close ? row.close > row.ema200 : false;
  const baseCond =
    macdDiff !== null && vwap && atrPct && atrPct < 3 && ((trendUp && macdDiff > 0 && row.close > vwap) || (!trendUp && macdDiff < 0 && row.close < vwap));
  if (!baseCond) return { trigger: false };
  const direction = trendUp ? "long" : "short";
  const stops = computeStopAndTarget({ entry: row.close, direction, atrPct, regimeLabel, setupType: "trend" });
  return {
    trigger: true,
    direction,
    entryPrice: row.close,
    tp: stops.tp,
    sl: stops.sl,
    meta: {
      reason: ["Trend + MACD + VWAP + ATR filter"],
      regimeMatch: regimeLabel,
      volatilityScore: volScore,
      flowScore,
      setup: "trend",
      riskPad: stops.riskPad,
      atrFrac: stops.atrFrac,
    },
  };
};

export const evaluateBreakoutSetup = (row, meta) => {
  const { regimeLabel, smartMoney, volatilityScoreOverride } = meta || {};
  const atrPct = row.atrPct;
  const bbw =
    Number.isFinite(row.bollUpper) && Number.isFinite(row.bollLower) && Number.isFinite(row.bollBasis) && row.bollBasis
      ? ((row.bollUpper - row.bollLower) / row.bollBasis) * 100
      : null;
  if (bbw !== null && bbw < 4) return { trigger: false };
  const volScore = volatilityScoreOverride ?? computeVolatilityScore(atrPct);
  const flowScore = computeFlowScore(smartMoney);
  const volSpike = row.volumeSpike && row.volumeSpike >= 1.3;
  const dirLong = row.donchianHigh && row.close > row.donchianHigh && volSpike;
  const dirShort = row.donchianLow && row.close < row.donchianLow && volSpike;
  if (!dirLong && !dirShort) return { trigger: false };
  const direction = dirLong ? "long" : "short";
  if (regimeLabel && !matchesRegime(regimeLabel, ["Bull", "Bear", "Choppy", "Crab"])) return { trigger: false };
  const stops = computeStopAndTarget({ entry: row.close, direction, atrPct, regimeLabel, setupType: "breakout" });
  return {
    trigger: true,
    direction,
    entryPrice: row.close,
    tp: stops.tp,
    sl: stops.sl,
    meta: {
      reason: ["Donchian + Vol Spike breakout"],
      regimeMatch: regimeLabel,
      volatilityScore: volScore,
      flowScore,
      setup: "breakout",
      riskPad: stops.riskPad,
      atrFrac: stops.atrFrac,
    },
  };
};

export const evaluateReversionSetup = (row, meta) => {
  const { regimeLabel, smartMoney, volatilityScoreOverride } = meta || {};
  const atrPct = row.atrPct;
  const volScore = volatilityScoreOverride ?? computeVolatilityScore(atrPct);
  const flowScore = computeFlowScore(smartMoney);
  const rsi = Number.isFinite(row.rsi) ? row.rsi : null;
  const upper = row.bollUpper;
  const lower = row.bollLower;
  const allow = regimeLabel ? matchesRegime(regimeLabel, ["Crab", "Choppy", "Bull", "Bear"]) : true;
  if (!allow) return { trigger: false };
  const longCond = rsi !== null && rsi < 30 && lower && row.close <= lower;
  const shortCond = rsi !== null && rsi > 70 && upper && row.close >= upper;
  if (!longCond && !shortCond) return { trigger: false };
  const direction = longCond ? "long" : "short";
  const stops = computeStopAndTarget({ entry: row.close, direction, atrPct, regimeLabel, setupType: "reversion" });
  return {
    trigger: true,
    direction,
    entryPrice: row.close,
    tp: stops.tp,
    sl: stops.sl,
    meta: {
      reason: ["RSI extreme + Bollinger reversion"],
      regimeMatch: regimeLabel,
      volatilityScore: volScore,
      flowScore,
      setup: "reversion",
      riskPad: stops.riskPad,
      atrFrac: stops.atrFrac,
    },
  };
};

export const computeConfidenceFromBacktest = ({ setupWinrate, regimeWinrate, volatilityScore, flowScore }) => {
  const base = {
    setupWinrate: Number.isFinite(setupWinrate) ? setupWinrate : 0.55,
    regimeWinrate: Number.isFinite(regimeWinrate) ? regimeWinrate : 0.55,
    volatilityScore: Number.isFinite(volatilityScore) ? volatilityScore : 0.5,
    flowScore: Number.isFinite(flowScore) ? flowScore : 0.5,
  };
  const conf =
    0.35 * base.setupWinrate +
    0.25 * base.regimeWinrate +
    0.2 * base.volatilityScore +
    0.2 * base.flowScore;
  return clamp01(conf);
};

export const computeEdgeScore = ({ technical, fundamental, liquidity }) => {
  const tech = clamp01(technical ?? 0.5);
  const fund = clamp01(fundamental ?? 0.5);
  const liq = clamp01(liquidity ?? 0.5);
  return clamp01(0.5 * tech + 0.35 * fund + 0.15 * liq);
};

export const isUltraSignal = ({ setupWinrate, regimeWinrate, volatilityScore, flowScore, atrPct, socialBias }) => {
  const socialOk = socialBias === undefined || Math.abs(socialBias) >= 0.7 ? true : false;
  return (
    (setupWinrate ?? 0) >= 0.75 &&
    (regimeWinrate ?? 0) >= 0.8 &&
    (flowScore ?? 0) >= 0.7 &&
    (volatilityScore ?? 0) >= 0.7 &&
    Number.isFinite(atrPct) &&
    atrPct < 3 &&
    socialOk
  );
};
// Vision AI Mind – Crypto Risk Engine
// (c) Vision AI – All rights reserved.
// Do not remove this header.
import { computeStopAndTarget } from "./riskEngine.js";
