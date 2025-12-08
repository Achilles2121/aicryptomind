// Unified risk utilities used by signals, backtests, and TP/SL helpers.

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
};

const normalizeAtrFrac = (atrPct) => {
  const raw = Number.isFinite(atrPct) ? atrPct / 100 : 0.01;
  return Math.max(RISK_CONFIG.minAtrFrac, Math.min(RISK_CONFIG.maxAtrFrac, raw));
};

export const computeStopAndTarget = ({ entry, direction, atrPct, regimeLabel, setupType }) => {
  if (!Number.isFinite(entry) || (direction !== "long" && direction !== "short")) {
    return { sl: null, tp: null, rr: null, riskPad: null, atrFrac: null };
  }
  const atrFrac = normalizeAtrFrac(atrPct);
  const basePad = RISK_CONFIG.atrPad[setupType] ?? RISK_CONFIG.atrPad.default;
  const regimeAdjust =
    regimeLabel === "Crab" || regimeLabel === "Choppy"
      ? 0.9
      : regimeLabel === "Bear" || regimeLabel === "Bull"
      ? 1
      : 0.95;
  const riskPad = basePad * regimeAdjust;
  const tpDelta = riskPad * RISK_CONFIG.tpMultiplier;

  if (direction === "long") {
    const sl = entry * (1 - riskPad);
    const tp = entry * (1 + tpDelta);
    const rr = riskPad > 0 ? (tp - entry) / (entry - sl) : null;
    return { sl, tp, rr, riskPad, atrFrac };
  }
  const sl = entry * (1 + riskPad);
  const tp = entry * (1 - tpDelta);
  const rr = riskPad > 0 ? (entry - tp) / (sl - entry) : null;
  return { sl, tp, rr, riskPad, atrFrac };
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
