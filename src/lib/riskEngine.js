// Unified risk utilities used by signals, backtests, and TP/SL helpers.
// Vision AI Mind - Enhanced Dynamic TP/SL with ATR-based calculations

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const RISK_CONFIG = {
  riskPctDefault: 0.01,
  dailyLossLimitPct: -0.03, // -3% default intraday cutoff
  tpMultiplier: 2.2,
  maxAtrFrac: 0.02,
  minAtrFrac: 0.005,
  atrPad: {
    trend: 0.5,
    breakout: 0.6,
    reversion: 0.5,
    default: 0.5,
  },
  // New: Enhanced multipliers for different market conditions
  regimeMultipliers: {
    Bull: { tp: 2.5, sl: 0.9 },    // Wider TP in bullish markets
    Bear: { tp: 2.0, sl: 1.1 },    // Tighter TP, wider SL in bearish
    Crab: { tp: 1.8, sl: 0.8 },    // Tight range, smaller targets
    Choppy: { tp: 1.5, sl: 1.0 },  // Very tight, quick exits
    default: { tp: 2.2, sl: 1.0 },
  },
  // New: Volatility-adjusted multipliers
  volatilityAdjust: {
    low: { tp: 0.8, sl: 0.9 },     // ATR < 0.5%: smaller moves expected
    medium: { tp: 1.0, sl: 1.0 },  // ATR 0.5-2%: normal
    high: { tp: 1.2, sl: 1.2 },    // ATR 2-3.5%: wider stops needed
    extreme: { tp: 0.7, sl: 1.5 }, // ATR > 3.5%: reduce risk, wide SL
  },
};

/**
 * Determines volatility category from ATR percentage
 */
const getVolatilityCategory = (atrPct) => {
  if (!Number.isFinite(atrPct)) return 'medium';
  if (atrPct < 0.5) return 'low';
  if (atrPct <= 2) return 'medium';
  if (atrPct <= 3.5) return 'high';
  return 'extreme';
};

const normalizeAtrFrac = (atrPct) => {
  const raw = Number.isFinite(atrPct) ? atrPct / 100 : 0.01;
  return Math.max(RISK_CONFIG.minAtrFrac, Math.min(RISK_CONFIG.maxAtrFrac, raw));
};

/**
 * Enhanced TP/SL calculation with:
 * - ATR-based dynamic stops
 * - Regime-aware adjustments
 * - Volatility category adjustments
 * - Minimum R:R enforcement (target 2:1 or better)
 */
export const computeStopAndTarget = ({ entry, direction, atrPct, regimeLabel, setupType, mtfAlignment, volumeConfirmed }) => {
  if (!Number.isFinite(entry) || (direction !== "long" && direction !== "short")) {
    return { sl: null, tp: null, rr: null, riskPad: null, atrFrac: null };
  }
  
  const atrFrac = normalizeAtrFrac(atrPct);
  const basePad = RISK_CONFIG.atrPad[setupType] ?? RISK_CONFIG.atrPad.default;
  
  // Get regime multipliers
  const regimeMult = RISK_CONFIG.regimeMultipliers[regimeLabel] ?? RISK_CONFIG.regimeMultipliers.default;
  
  // Get volatility adjustments
  const volCategory = getVolatilityCategory(atrPct);
  const volAdjust = RISK_CONFIG.volatilityAdjust[volCategory];
  
  // Calculate regime adjustment with direction bias
  let regimeAdjust = 1;
  if (regimeLabel === "Crab" || regimeLabel === "Choppy") {
    regimeAdjust = 0.9;
  } else if (regimeLabel === "Bear" && direction === "short") {
    regimeAdjust = 1.1; // Favor shorts in bear market
  } else if (regimeLabel === "Bull" && direction === "long") {
    regimeAdjust = 1.1; // Favor longs in bull market
  }
  
  // MTF alignment bonus (tighter stops if aligned)
  const mtfBonus = mtfAlignment && mtfAlignment >= 0.66 ? 0.95 : 1.0;
  
  // Volume confirmation bonus (more aggressive if confirmed)
  const volConfBonus = volumeConfirmed ? 1.05 : 1.0;
  
  // Calculate final risk pad and TP delta
  const riskPad = basePad * regimeAdjust * mtfBonus * volAdjust.sl;
  const tpMultiplier = regimeMult.tp * volAdjust.tp * volConfBonus;
  const tpDelta = riskPad * tpMultiplier;
  
  // Ensure minimum 2:1 R:R ratio
  const minRR = 2.0;
  const adjustedTpDelta = Math.max(tpDelta, riskPad * minRR);

  if (direction === "long") {
    const sl = entry * (1 - riskPad);
    const tp = entry * (1 + adjustedTpDelta);
    const rr = riskPad > 0 ? (tp - entry) / (entry - sl) : null;
    return { sl, tp, rr, riskPad, atrFrac, volCategory, regimeMult };
  }
  
  const sl = entry * (1 + riskPad);
  const tp = entry * (1 - adjustedTpDelta);
  const rr = riskPad > 0 ? (entry - tp) / (sl - entry) : null;
  return { sl, tp, rr, riskPad, atrFrac, volCategory, regimeMult };
};

export const computePositionSize = ({ equity, riskPct = RISK_CONFIG.riskPctDefault, entry, sl }) => {
  if (!Number.isFinite(equity) || !Number.isFinite(entry) || !Number.isFinite(sl)) return 0;
  const stopDistance = Math.abs(entry - sl);
  if (stopDistance === 0) return 0;
  const riskBudget = equity * riskPct;
  return riskBudget / stopDistance;
};

/**
 * Computes whether trading is allowed based on daily PnL in percent.
 * Accepts either a direct dayPnlPct or a small trade list with pnlPct values.
 */
export const computeDailyRiskGate = ({ dayPnlPct, trades = [], limitPct = RISK_CONFIG.dailyLossLimitPct }) => {
  let pnl = Number.isFinite(dayPnlPct) ? dayPnlPct : null;
  if (pnl === null && Array.isArray(trades) && trades.length) {
    const sum = trades
      .map((t) => (Number.isFinite(t.pnlPct) ? t.pnlPct : null))
      .filter((v) => v !== null)
      .reduce((a, b) => a + b, 0);
    pnl = trades.length ? sum : null;
  }
  const safePnl = Number.isFinite(pnl) ? pnl : 0;
  return { dayPnlPct: safePnl, allowed: safePnl >= limitPct };
};

export const clampConfidence = (value, max = 0.99) => clamp01(Math.min(value ?? 0, max));
