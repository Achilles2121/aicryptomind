// Copyright (c) 2025 Vision AI Mind. All rights reserved.
// Multi-TP/SL Engine - Calculates multiple take profits based on Fibonacci Extensions
// and ATR-based dynamic stop losses with timezone awareness

import { RISK_CONFIG } from './riskEngine';

/**
 * Fibonacci Extension Levels for Take Profit calculations
 * These are based on classic Fibonacci ratios used in trading
 */
export const FIB_EXTENSIONS = {
  tp1: 1.0,      // 100% extension (conservative)
  tp2: 1.618,    // Golden ratio (moderate)
  tp3: 2.618,    // Extended target (aggressive)
  tp4: 4.236,    // Extreme extension (rare)
};

/**
 * Risk allocation per TP level (total = 100%)
 * Determines how much of the position to close at each target
 */
export const TP_ALLOCATION = {
  tp1: 0.40,  // 40% - Secure profits early
  tp2: 0.35,  // 35% - Main profit taking
  tp3: 0.20,  // 20% - Let winners run
  tp4: 0.05,  // 5%  - Moonbag for extreme moves
};

/**
 * Timezone-aware session detection
 * Returns the current trading session based on timezone
 */
export const getMarketSession = (timezone = 'Europe/Berlin') => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(now), 10);
  
  // Major trading sessions
  if (hour >= 8 && hour < 16) return { session: 'EU', label: 'Europa', volatilityMult: 1.0 };
  if (hour >= 14 && hour < 22) return { session: 'US', label: 'USA', volatilityMult: 1.2 };
  if (hour >= 0 && hour < 8) return { session: 'ASIA', label: 'Asien', volatilityMult: 0.8 };
  return { session: 'OFF', label: 'Nach-Börse', volatilityMult: 0.6 };
};

/**
 * Calculate volatility category from ATR percentage
 */
const getVolatilityCategory = (atrPct) => {
  if (!Number.isFinite(atrPct)) return 'medium';
  if (atrPct < 0.5) return 'low';
  if (atrPct <= 2) return 'medium';
  if (atrPct <= 3.5) return 'high';
  return 'extreme';
};

/**
 * Multi-TP/SL Calculation Engine
 * Generates multiple take profit levels based on:
 * - Fibonacci extensions from the entry point
 * - ATR-based dynamic stop loss
 * - Market regime adjustments
 * - Volatility scaling
 * - Session-aware timing
 */
export const computeMultiTpSl = ({
  entry,
  direction,
  atrPct,
  regimeLabel = 'Neutral',
  volatilityData: _volatilityData = null,
  timezone = 'Europe/Berlin',
  customFibLevels = null,
  includeTrailingSL = true,
}) => {
  if (!Number.isFinite(entry) || (direction !== 'long' && direction !== 'short')) {
    return {
      entry: null,
      stopLoss: null,
      takeProfits: [],
      trailingSL: null,
      riskReward: null,
      session: null,
      volatilityCategory: null,
    };
  }

  // Get current session
  const session = getMarketSession(timezone);
  
  // Get volatility category
  const volCategory = getVolatilityCategory(atrPct);
  const volAdjust = RISK_CONFIG.volatilityAdjust[volCategory] || RISK_CONFIG.volatilityAdjust.medium;
  
  // Get regime multipliers
  const regimeMult = RISK_CONFIG.regimeMultipliers[regimeLabel] || RISK_CONFIG.regimeMultipliers.default;
  
  // Normalize ATR fraction
  const atrFrac = Math.max(0.005, Math.min(0.02, (atrPct || 1) / 100));
  
  // Base risk padding (SL distance from entry)
  const basePad = 0.5;
  const slMultiplier = regimeMult.sl * volAdjust.sl * session.volatilityMult;
  const riskPad = basePad * atrFrac * slMultiplier;
  
  // Use custom Fib levels if provided, otherwise defaults
  const fibLevels = customFibLevels || FIB_EXTENSIONS;
  
  // Calculate Stop Loss
  let stopLoss;
  if (direction === 'long') {
    stopLoss = entry * (1 - riskPad);
  } else {
    stopLoss = entry * (1 + riskPad);
  }
  
  // Calculate risk amount (entry to SL)
  const riskAmount = Math.abs(entry - stopLoss);
  
  // Calculate Take Profit levels
  const takeProfits = [];
  const tpMultiplier = regimeMult.tp * volAdjust.tp;
  
  Object.entries(fibLevels).forEach(([key, fibRatio]) => {
    const tpDistance = riskAmount * fibRatio * tpMultiplier;
    let tpPrice;
    
    if (direction === 'long') {
      tpPrice = entry + tpDistance;
    } else {
      tpPrice = entry - tpDistance;
    }
    
    const allocation = TP_ALLOCATION[key] || 0.25;
    const rr = tpDistance / riskAmount;
    const pctFromEntry = ((tpPrice - entry) / entry) * 100;
    
    takeProfits.push({
      level: key.toUpperCase(),
      price: tpPrice,
      fibRatio,
      allocation,
      allocationPct: Math.round(allocation * 100),
      riskReward: rr,
      pctFromEntry: direction === 'long' ? pctFromEntry : -pctFromEntry,
      hit: false, // Will be updated during trade management
    });
  });
  
  // Calculate Trailing Stop Loss (moves up after TP1 hit)
  let trailingSL = null;
  if (includeTrailingSL && takeProfits.length > 0) {
    const tp1Price = takeProfits[0].price;
    // After TP1 hit, trail SL to breakeven + small buffer
    const breakEvenBuffer = riskAmount * 0.1;
    if (direction === 'long') {
      trailingSL = {
        activationPrice: tp1Price,
        trailPrice: entry + breakEvenBuffer,
        trailDistance: riskAmount * 0.3, // Trail 30% of original risk
        description: 'Nach TP1: SL auf Einstand + 10%',
      };
    } else {
      trailingSL = {
        activationPrice: tp1Price,
        trailPrice: entry - breakEvenBuffer,
        trailDistance: riskAmount * 0.3,
        description: 'Nach TP1: SL auf Einstand - 10%',
      };
    }
  }
  
  // Calculate overall R:R (using weighted average of TPs)
  const weightedRR = takeProfits.reduce((sum, tp) => sum + (tp.riskReward * tp.allocation), 0);
  
  // SL percentage from entry
  const slPctFromEntry = ((stopLoss - entry) / entry) * 100;
  
  return {
    entry,
    direction,
    stopLoss: {
      price: stopLoss,
      pctFromEntry: direction === 'long' ? slPctFromEntry : -slPctFromEntry,
      distance: riskAmount,
    },
    takeProfits,
    trailingSL,
    riskReward: weightedRR,
    session,
    volatilityCategory: volCategory,
    regimeLabel,
    atrPct,
    calculatedAt: new Date().toISOString(),
  };
};

/**
 * Calculate Fibonacci Retracement levels for support/resistance
 */
export const computeFibRetracements = (high, low, direction = 'up') => {
  if (!Number.isFinite(high) || !Number.isFinite(low) || high <= low) {
    return [];
  }
  
  const range = high - low;
  const fibRatios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
  
  return fibRatios.map(ratio => {
    const label = `${(ratio * 100).toFixed(1)}%`;
    let price;
    
    if (direction === 'up') {
      // Retracement from high to low (bearish retracement)
      price = high - (range * ratio);
    } else {
      // Retracement from low to high (bullish retracement)
      price = low + (range * ratio);
    }
    
    // Identify key zones
    let zone = 'neutral';
    if (ratio === 0.618 || ratio === 0.5) zone = 'golden';
    if (ratio === 0.786) zone = 'deep';
    if (ratio === 0.236) zone = 'shallow';
    
    return {
      label,
      ratio,
      price,
      zone,
      isGoldenZone: ratio >= 0.5 && ratio <= 0.786,
    };
  });
};

/**
 * Format price based on asset type and size
 */
export const formatTradePrice = (price, assetClass = 'crypto') => {
  if (!Number.isFinite(price)) return '—';
  
  if (assetClass === 'crypto') {
    if (price >= 10000) return price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 100) return price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  }
  
  if (assetClass === 'forex' || assetClass === 'fx') {
    return price.toFixed(5);
  }
  
  if (assetClass === 'index') {
    return price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  // Commodities (Gold, Silver, Oil)
  return price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default {
  computeMultiTpSl,
  computeFibRetracements,
  formatTradePrice,
  getMarketSession,
  FIB_EXTENSIONS,
  TP_ALLOCATION,
};
