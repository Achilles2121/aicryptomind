// Signal builders extracted from the legacy App.jsx logic.

const defaultT = (key) => key;

export const buildAISignal = ({ indicatorSeries = [], indicators = {}, displayPrice, takeProfitPrice, stopLossPrice }) => {
  if (!indicatorSeries.length || !displayPrice) {
    return { action: "Warten", reason: "Zu wenige Daten", confidence: 0.5, tp: null, sl: null };
  }
  const rsi = indicators.rsi;
  const macdDiff =
    Number.isFinite(indicators.macd) && Number.isFinite(indicators.signal) ? indicators.macd - indicators.signal : null;
  const last = indicatorSeries[indicatorSeries.length - 1];
  const close = last?.close;
  const upper = last?.bollUpper;
  const lower = last?.bollLower;
  let action = "Warten";
  let reason = "Neutral";
  let confidence = 0.55;
  let tp = takeProfitPrice;
  let sl = stopLossPrice;
  if (rsi !== null && rsi < 30 && macdDiff !== null && macdDiff > 0) {
    action = "Kaufen";
    reason = "RSI < 30 und MACD bullisch";
    confidence = 0.68;
    tp = tp || close * 1.05;
    sl = sl || close * 0.975;
  } else if (rsi !== null && rsi > 70 && macdDiff !== null && macdDiff < 0) {
    action = "Verkaufen";
    reason = "RSI > 70 und MACD baerisch";
    confidence = 0.66;
    tp = tp || close * 0.97;
    sl = sl || close * 1.03;
  } else if (upper && close && close >= upper) {
    action = "Take Profit";
    reason = "Preis am oberen Band";
    confidence = 0.6;
    tp = tp || close;
    sl = sl || close * 0.985;
  } else if (lower && close && close <= lower) {
    action = "Stop Loss pruefen";
    reason = "Preis am unteren Band";
    confidence = 0.6;
    tp = tp || close * 1.015;
    sl = sl || close;
  }
  return { action, reason, confidence, tp, sl };
};

export const buildProSignal = ({ indicatorSeries = [], indicators = {}, smartMoney = {}, marketRegime = {}, t = defaultT }) => {
  if (!indicatorSeries.length) {
    return { action: "wait", reason: "no data", confidence: 0.5, tp: null, sl: null, meta: {} };
  }
  const last = indicatorSeries[indicatorSeries.length - 1];
  const atrPct = Number.isFinite(last.atrPct) ? last.atrPct : null;
  const vwap = last.vwap;
  const donHigh = last.donchianHigh;
  const donLow = last.donchianLow;
  const volSpike = last.volumeSpike && last.volumeSpike >= 1.3;
  const macdDiff =
    Number.isFinite(indicators.macd) && Number.isFinite(indicators.signal) ? indicators.macd - indicators.signal : null;
  const rsi = Number.isFinite(indicators.rsi) ? indicators.rsi : null;
  const close = last.close;
  const bollUpper = last.bollUpper;
  const bollLower = last.bollLower;
  const trendUp = last.ema200 && close ? close > last.ema200 : false;
  const trendBias = trendUp ? 1 : close && last.ema200 ? (close > last.ema200 * 0.995 ? 0.5 : -0.5) : 0;
  const flowBias = smartMoney.net >= 0 ? 0.5 : -0.5;
  const volQuality = atrPct ? (atrPct >= 0.5 && atrPct <= 2.5 ? 0.5 : 0.1) : 0.2;
  const momentum = macdDiff !== null ? (macdDiff > 0 ? 0.5 : -0.5) : 0;
  const regimeLabel = marketRegime.label;
  const regimeIntent = marketRegime.intent;

  let setup = "wait";
  let action = "wait";
  let reason = "neutral";
  let confidence = 0.55;
  let tp = null;
  let sl = null;

  const breakoutLong = donHigh && close > donHigh && volSpike;
  const breakoutShort = donLow && close < donLow && volSpike;
  const reversionLong = rsi !== null && rsi < 30 && bollLower && close <= bollLower;
  const reversionShort = rsi !== null && rsi > 70 && bollUpper && close >= bollUpper;

  if (trendUp && macdDiff !== null && macdDiff > 0 && vwap && close > vwap && atrPct && atrPct < 3) {
    setup = "trend";
    action = "long";
    reason = "trend up & MACD bull & above VWAP";
    confidence = 0.64;
  }
  if (!trendUp && macdDiff !== null && macdDiff < 0 && vwap && close < vwap && atrPct && atrPct < 3) {
    setup = "trend";
    action = "short";
    reason = "trend down & MACD bear & below VWAP";
    confidence = 0.62;
  }
  if (breakoutLong) {
    setup = "breakout";
    action = "long";
    reason = "breakout above Donchian + volume spike";
    confidence = Math.max(confidence, 0.7);
  }
  if (breakoutShort) {
    setup = "breakout";
    action = "short";
    reason = "breakdown below Donchian + volume spike";
    confidence = Math.max(confidence, 0.7);
  }
  if (reversionLong) {
    setup = "reversion";
    action = "long";
    reason = "mean reversion near lower band with RSI<30";
    confidence = Math.max(confidence, 0.63);
  }
  if (reversionShort) {
    setup = "reversion";
    action = "short";
    reason = "mean reversion near upper band with RSI>70";
    confidence = Math.max(confidence, 0.63);
  }
  if (flowBias < 0 && action === "long") confidence -= 0.05;
  if (flowBias > 0 && action === "short") confidence -= 0.05;

  if (action !== "wait" && atrPct && close) {
    const atrFrac = Math.min(atrPct / 100, 0.02);
    const riskPad = setup === "breakout" ? atrFrac * 0.6 : atrFrac * 0.5;
    if (action === "long") {
      sl = close * (1 - riskPad);
      tp = close * (1 + riskPad * 2.2);
    } else {
      sl = close * (1 + riskPad);
      tp = close * (1 - riskPad * 2.2);
    }
  }

  const scoreParts = [trendBias, momentum, flowBias, volQuality].map((v) => (Number.isFinite(v) ? v : 0));
  const score = Math.min(0.99, Math.max(-0.99, scoreParts.reduce((a, b) => a + b, 0)));
  const checks = {
    trend: trendBias > 0 ? "ok" : trendBias < 0 ? "warn" : "neutral",
    momentum: momentum > 0 ? "ok" : momentum < 0 ? "warn" : "neutral",
    flow: flowBias > 0 ? "ok" : flowBias < 0 ? "warn" : "neutral",
    vol: volQuality > 0.3 ? "ok" : "neutral",
  };

  let setupLabel = t("setupWait");
  if (setup === "trend") setupLabel = t("setupTrend");
  else if (setup === "breakout") setupLabel = t("setupBreakout");
  else if (setup === "reversion") setupLabel = t("setupReversion");

  return {
    action,
    reason,
    confidence,
    tp,
    sl,
    setup,
    setupLabel,
    regimeLabel,
    regimeIntent,
    score,
    meta: {
      atrPct,
      vwap,
      donHigh,
      donLow,
      volSpike: !!volSpike,
      macdDiff,
      checks,
    },
  };
};

const inferRegime = (row) => {
  const emaBias = row.ema200 && row.close ? (row.close - row.ema200) / row.ema200 : null;
  const bbw =
    Number.isFinite(row.bollUpper) && Number.isFinite(row.bollLower) && Number.isFinite(row.bollBasis) && row.bollBasis
      ? ((row.bollUpper - row.bollLower) / row.bollBasis) * 100
      : null;
  const adxVal = Number.isFinite(row.adx) ? row.adx : null;
  const strongTrend = adxVal !== null ? adxVal > 25 : false;
  if (emaBias !== null && strongTrend && bbw !== null && bbw > 5) {
    return emaBias > 0 ? "Bull" : "Bear";
  }
  if (bbw !== null && bbw < 3) return "Crab";
  return "Choppy";
};

export const buildBacktestSignals = (indicatorSeries = []) => {
  const signals = [];
  for (let i = 1; i < indicatorSeries.length; i += 1) {
    const row = indicatorSeries[i];
    const macdDiff =
      Number.isFinite(row.macd) && Number.isFinite(row.macdSignal) ? row.macd - row.macdSignal : null;
    const trendUp = row.ema200 && row.close ? row.close > row.ema200 : false;
    const atrPct = row.atrPct;
    const vwap = row.vwap;
    const volumeSpike = row.volumeSpike && row.volumeSpike >= 1.3;
    const donHigh = row.donchianHigh;
    const donLow = row.donchianLow;
    const rsi = Number.isFinite(row.rsi) ? row.rsi : null;
    const bollUpper = row.bollUpper;
    const bollLower = row.bollLower;

    let direction = null;
    let setup = null;

    if (donHigh && row.close > donHigh && volumeSpike) {
      direction = "long";
      setup = "breakout";
    } else if (donLow && row.close < donLow && volumeSpike) {
      direction = "short";
      setup = "breakout";
    } else if (trendUp && macdDiff !== null && macdDiff > 0 && vwap && row.close > vwap && atrPct && atrPct < 3) {
      direction = "long";
      setup = "trend";
    } else if (!trendUp && macdDiff !== null && macdDiff < 0 && vwap && row.close < vwap && atrPct && atrPct < 3) {
      direction = "short";
      setup = "trend";
    } else if (rsi !== null && rsi < 30 && bollLower && row.close <= bollLower) {
      direction = "long";
      setup = "reversion";
    } else if (rsi !== null && rsi > 70 && bollUpper && row.close >= bollUpper) {
      direction = "short";
      setup = "reversion";
    }

    if (!direction || !row.close) continue;

    const atrFrac = atrPct ? Math.min(atrPct / 100, 0.02) : 0.01;
    const riskPad = (setup === "breakout" ? atrFrac * 0.6 : atrFrac * 0.5) || 0.005;
    let tp = null;
    let sl = null;
    if (direction === "long") {
      sl = row.close * (1 - riskPad);
      tp = row.close * (1 + riskPad * 2.2);
    } else {
      sl = row.close * (1 + riskPad);
      tp = row.close * (1 - riskPad * 2.2);
    }
    signals.push({
      index: i,
      direction,
      entryPrice: row.close,
      tp,
      sl,
      meta: { setup, atrPct, riskPad, regime: inferRegime(row) },
    });
  }
  return signals;
};

import {
  evaluateTrendSetup,
  evaluateBreakoutSetup,
  evaluateReversionSetup,
  computeConfidenceFromBacktest,
  isUltraSignal,
  computeVolatilityScore,
  computeFlowScore,
} from "./strategyEngineV3";

const deriveSetupWinrate = (backtestStats, setup) => {
  if (!backtestStats) return 0.55;
  const global = backtestStats.winRate ? backtestStats.winRate / 100 : 0.55;
  const perSetup = backtestStats.setupWinrates?.[setup];
  return Number.isFinite(perSetup) ? perSetup : global;
};

const deriveRegimeWinrate = (backtestStats, regimeLabel) => {
  if (!backtestStats) return 0.55;
  const perRegime = backtestStats.regimeWinrates?.[regimeLabel];
  return Number.isFinite(perRegime) ? perRegime : backtestStats.winRate ? backtestStats.winRate / 100 : 0.55;
};

const normalizeSocial = (sentimentMetrics) => {
  if (!sentimentMetrics || sentimentMetrics.score === null || sentimentMetrics.score === undefined) return 0;
  const score = sentimentMetrics.score;
  if (Math.abs(score) <= 1) return score;
  if (score > 1000 || score < -1000) return Math.tanh(score / 1000);
  return Math.max(-1, Math.min(1, (score - 50) / 50));
};

export const buildSignalsV3 = ({ indicatorSeries = [], marketRegime, smartMoney, sentimentMetrics, backtestStats, htfRegime, derivativesRisk }) => {
  if (!indicatorSeries.length) {
    return { action: "wait", reason: "no data", confidence: 0.5, tp: null, sl: null, meta: {} };
  }
  const last = indicatorSeries.at(-1);
  const regimeLabel = marketRegime?.label;
  const htfLabel = htfRegime?.label || regimeLabel;
  const socialBias = normalizeSocial(sentimentMetrics);
  const flowScore = computeFlowScore(smartMoney);
  const volatilityScore = computeVolatilityScore(last.atrPct);

  const meta = {
    regimeLabel,
    smartMoney,
    sentiment: sentimentMetrics,
    volatilityScoreOverride: undefined,
  };

  const trend = evaluateTrendSetup(last, meta);
  const breakout = evaluateBreakoutSetup(last, meta);
  const reversion = evaluateReversionSetup(last, meta);
  let candidates = [trend, breakout, reversion].filter((c) => c.trigger);

  if (socialBias > 0.7) {
    candidates = candidates.filter((c) => c.direction !== "short");
  }
  if (socialBias < -0.7) {
    candidates = candidates.filter((c) => c.direction !== "long");
  }

  candidates = candidates.filter((c) => {
    if (!c.trigger) return false;
    if (c.meta?.setup === "trend") return htfLabel === "Bull" || htfLabel === "Bear";
    if (c.meta?.setup === "breakout") return htfLabel === "Bull" || htfLabel === "Bear";
    if (c.meta?.setup === "reversion") return htfLabel === "Crab" || htfLabel === "Choppy";
    return true;
  });

  if (!candidates.length) {
    return { action: "wait", reason: "neutral", confidence: 0.5, tp: null, sl: null, meta: { regimeLabel } };
  }

  let best = candidates[0];
  let bestConfidence = 0;
  for (const c of candidates) {
    const setupWinrate = deriveSetupWinrate(backtestStats, c.meta?.setup);
    const regimeWinrate = deriveRegimeWinrate(backtestStats, regimeLabel);
    let confidence = computeConfidenceFromBacktest({
      setupWinrate,
      regimeWinrate,
      volatilityScore: c.meta?.volatilityScore ?? volatilityScore,
      flowScore: c.meta?.flowScore ?? flowScore,
    });
    if (derivativesRisk?.riskLevel === "hot") confidence *= 0.85;
    if (derivativesRisk?.riskLevel === "cool") confidence *= 1.05;
    confidence = Math.min(0.99, Math.max(0, confidence));
    const ultra = isUltraSignal({
      setupWinrate,
      regimeWinrate,
      volatilityScore: c.meta?.volatilityScore ?? volatilityScore,
      flowScore: c.meta?.flowScore ?? flowScore,
      atrPct: last.atrPct,
      socialBias,
    });
    const enriched = { ...c, confidence, ultra, setupWinrate, regimeWinrate, meta: { ...c.meta, derivativesRisk } };
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      best = enriched;
    }
  }

  return {
    action: best.direction || "wait",
    reason: (best.meta?.reason || []).join(" | ") || "neutral",
    confidence: best.confidence ?? 0.55,
    tp: best.tp ?? null,
    sl: best.sl ?? null,
    setup: best.meta?.setup,
    setupLabel: best.meta?.setup ? `Setup: ${best.meta.setup}` : "Setup wait",
    regimeLabel,
    regimeIntent: marketRegime?.intent,
    ultra: !!best.ultra,
    score: best.confidence ?? 0.55,
    meta: {
      ...best.meta,
      setupWinrate: best.setupWinrate,
      regimeWinrate: best.regimeWinrate,
    },
  };
};
// Vision AI Mind – Crypto Risk Engine
// (c) Vision AI – All rights reserved.
// Do not remove this header.
