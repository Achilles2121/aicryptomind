// Strategy Engine V3: separates setups and confidence computation.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

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
  const atrFrac = Math.min(atrPct / 100 || 0.01, 0.02);
  const riskPad = atrFrac * 0.5;
  const tp = direction === "long" ? row.close * (1 + riskPad * 2.2) : row.close * (1 - riskPad * 2.2);
  const sl = direction === "long" ? row.close * (1 - riskPad) : row.close * (1 + riskPad);
  return {
    trigger: true,
    direction,
    entryPrice: row.close,
    tp,
    sl,
    meta: {
      reason: ["Trend + MACD + VWAP + ATR filter"],
      regimeMatch: regimeLabel,
      volatilityScore: volScore,
      flowScore,
      setup: "trend",
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
  const atrFrac = Math.min(atrPct / 100 || 0.01, 0.02);
  const riskPad = atrFrac * 0.6;
  const tp = direction === "long" ? row.close * (1 + riskPad * 2.2) : row.close * (1 - riskPad * 2.2);
  const sl = direction === "long" ? row.close * (1 - riskPad) : row.close * (1 + riskPad);
  return {
    trigger: true,
    direction,
    entryPrice: row.close,
    tp,
    sl,
    meta: {
      reason: ["Donchian + Vol Spike breakout"],
      regimeMatch: regimeLabel,
      volatilityScore: volScore,
      flowScore,
      setup: "breakout",
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
  const atrFrac = Math.min(atrPct / 100 || 0.01, 0.02);
  const riskPad = atrFrac * 0.5;
  const tp = direction === "long" ? row.close * (1 + riskPad * 2.2) : row.close * (1 - riskPad * 2.2);
  const sl = direction === "long" ? row.close * (1 - riskPad) : row.close * (1 + riskPad);
  return {
    trigger: true,
    direction,
    entryPrice: row.close,
    tp,
    sl,
    meta: {
      reason: ["RSI extreme + Bollinger reversion"],
      regimeMatch: regimeLabel,
      volatilityScore: volScore,
      flowScore,
      setup: "reversion",
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
