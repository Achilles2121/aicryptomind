// Event-based backtest without lookahead on entry decision.

/**
 * @typedef {Object} Candle
 * @property {number} time
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} Signal
 * @property {number} index
 * @property {"long"|"short"} direction
 * @property {number} entryPrice
 * @property {number} tp
 * @property {number} sl
 * @property {any} [meta]
 */

/**
 * @typedef {Object} Trade
 * @property {number} entryIndex
 * @property {number} exitIndex
 * @property {"long"|"short"} direction
 * @property {number} entryPrice
 * @property {number} exitPrice
 * @property {number} tp
 * @property {number} sl
 * @property {number} rr
 * @property {"win"|"loss"|"be"} result
 */

/**
 * @typedef {Object} BacktestResult
 * @property {Trade[]} trades
 * @property {number|null} winRate
 * @property {number|null} avgRR
 * @property {number|null} profitPct
 * @property {{trades:number,wins:number,losses:number,be:number,avgRR:number|null}} longStats
 * @property {{trades:number,wins:number,losses:number,be:number,avgRR:number|null}} shortStats
 * @property {Record<string, number>} setupWinrates
 * @property {Record<string, number>} regimeWinrates
 * @property {number[]} equityCurve
 * @property {number|null} maxDrawdown
 * @property {number|null} profitFactor
 */

const classifyResult = (direction, entryPrice, exitPrice, _sl) => {
  const delta = exitPrice - entryPrice;
  const thresh = entryPrice * 0.0005;
  if (Math.abs(delta) <= thresh) return "be";
  const isWin = direction === "long" ? exitPrice > entryPrice : exitPrice < entryPrice;
  if (isWin) return "win";
  const isBe = direction === "long" ? exitPrice >= entryPrice - thresh : exitPrice <= entryPrice + thresh;
  return isBe ? "be" : "loss";
};

const computeRR = (direction, entryPrice, exitPrice, sl) => {
  if (!entryPrice || !sl) return null;
  if (direction === "long") {
    const risk = entryPrice - sl;
    return risk ? (exitPrice - entryPrice) / risk : null;
  }
  const risk = sl - entryPrice;
  return risk ? (entryPrice - exitPrice) / risk : null;
};

const sampleNormal = (mean = 0, std = 1) => {
  const u = 1 - Math.random();
  const v = Math.random();
  const mag = Math.sqrt(-2.0 * Math.log(u));
  const z = mag * Math.cos(2.0 * Math.PI * v);
  return mean + z * std;
};

const simulateTrade = ({ candles, signal, maxHoldBars }) => {
  const { index, direction } = signal;
  if (!candles?.length || index >= candles.length) return null;
  const entryIndex = index;
  const entryCandle = candles[entryIndex];
  const entryPrice = signal.entryPrice ?? entryCandle.close;
  const tp = signal.tp ?? (direction === "long" ? entryPrice * 1.01 : entryPrice * 0.99);
  const sl = signal.sl ?? (direction === "long" ? entryPrice * 0.99 : entryPrice * 1.01);
  const atrPct = signal.meta?.atrPct ?? entryCandle.atrPct ?? 1;
  const fee = 0.00075; // 0.075%
  const slipMean = ((atrPct || 0) / 100) * 0.1; // 10% of ATR% as baseline slippage
  const slipPct = Math.max(0, sampleNormal(slipMean, slipMean * 0.35)); // stochastic slippage around baseline

  const entryAdj = direction === "long" ? 1 + slipPct + fee : 1 - slipPct - fee;
  const exitAdjWin = direction === "long" ? 1 - slipPct - fee : 1 + slipPct + fee;
  const exitAdjLose = exitAdjWin;

  let exitIndex = candles.length - 1;
  let exitPrice = candles[exitIndex].close * exitAdjLose;
  const lastIndex = Math.min(candles.length - 1, entryIndex + maxHoldBars);
  for (let j = entryIndex + 1; j <= lastIndex; j += 1) {
    const { high, low, close } = candles[j];
    if (direction === "long") {
      if (low <= sl) {
        exitIndex = j;
        exitPrice = sl * exitAdjLose;
        break;
      }
      if (high >= tp) {
        exitIndex = j;
        exitPrice = tp * exitAdjWin;
        break;
      }
    } else {
      if (high >= sl) {
        exitIndex = j;
        exitPrice = sl * exitAdjLose;
        break;
      }
      if (low <= tp) {
        exitIndex = j;
        exitPrice = tp * exitAdjWin;
        break;
      }
    }
    if (j === lastIndex) {
      exitIndex = j;
      exitPrice = close * exitAdjLose;
    }
  }

  const effectiveEntry = entryPrice * entryAdj;
  const rr = computeRR(direction, effectiveEntry, exitPrice, sl);
  const result = classifyResult(direction, effectiveEntry, exitPrice, sl);
  return { entryIndex, exitIndex, direction, entryPrice: effectiveEntry, exitPrice, tp, sl, rr, result, meta: signal.meta };
};

export const runBacktestV3 = ({ candles = [], signals = [], maxHoldBars = 5, startEquity = 10000, riskPct = 0.01 }) => {
  const trades = [];
  if (!candles.length || !signals.length) {
    return {
      trades,
      winRate: null,
      avgRR: null,
      profitPct: null,
      longStats: { trades: 0, wins: 0, losses: 0, be: 0, avgRR: null },
      shortStats: { trades: 0, wins: 0, losses: 0, be: 0, avgRR: null },
      setupWinrates: {},
      regimeWinrates: {},
      equityCurve: [startEquity],
      maxDrawdown: null,
      profitFactor: null,
    };
  }

  const sortedSignals = [...signals].sort((a, b) => a.index - b.index);
  for (const sig of sortedSignals) {
    const trade = simulateTrade({ candles, signal: sig, maxHoldBars });
    if (trade) trades.push(trade);
  }

  const wins = trades.filter((t) => t.result === "win").length;
  const rrVals = trades.map((t) => t.rr).filter((v) => Number.isFinite(v));
  const avgRR = rrVals.length ? rrVals.reduce((a, b) => a + b, 0) / rrVals.length : null;
  const profitPct = trades.reduce((acc, t) => {
    const change = t.direction === "long" ? (t.exitPrice - t.entryPrice) / t.entryPrice : (t.entryPrice - t.exitPrice) / t.entryPrice;
    return acc + change;
  }, 0);

  const setupBuckets = {};
  const regimeBuckets = {};
  for (const t of trades) {
    const setup = t.meta?.setup || "unknown";
    const regime = t.meta?.regime || "unknown";
    setupBuckets[setup] = setupBuckets[setup] || { wins: 0, total: 0 };
    setupBuckets[setup].total += 1;
    if (t.result === "win") setupBuckets[setup].wins += 1;
    regimeBuckets[regime] = regimeBuckets[regime] || { wins: 0, total: 0 };
    regimeBuckets[regime].total += 1;
    if (t.result === "win") regimeBuckets[regime].wins += 1;
  }
  const setupWinrates = Object.fromEntries(
    Object.entries(setupBuckets).map(([k, v]) => [k, v.total ? v.wins / v.total : 0])
  );
  const regimeWinrates = Object.fromEntries(
    Object.entries(regimeBuckets).map(([k, v]) => [k, v.total ? v.wins / v.total : 0])
  );

  const summarize = (dir) => {
    const list = trades.filter((t) => t.direction === dir);
    const dirWins = list.filter((t) => t.result === "win").length;
    const dirLosses = list.filter((t) => t.result === "loss").length;
    const dirBe = list.filter((t) => t.result === "be").length;
    const dirRr = list.map((t) => t.rr).filter((v) => Number.isFinite(v));
    return {
      trades: list.length,
      wins: dirWins,
      losses: dirLosses,
      be: dirBe,
      avgRR: dirRr.length ? dirRr.reduce((a, b) => a + b, 0) / dirRr.length : null,
    };
  };

  const equityCurve = [];
  let equity = startEquity;
  let peak = startEquity;
  let maxDrawdown = 0;
  let grossWin = 0;
  let grossLoss = 0;

  for (const t of trades) {
    const stopDistance = t.direction === "long" ? t.entryPrice - t.sl : t.sl - t.entryPrice;
    const riskBudget = equity * riskPct;
    const positionSize = stopDistance > 0 ? riskBudget / stopDistance : 0;
    const pnl = positionSize * (t.direction === "long" ? t.exitPrice - t.entryPrice : t.entryPrice - t.exitPrice);
    equity += pnl;
    if (pnl >= 0) grossWin += pnl;
    else grossLoss += Math.abs(pnl);
    peak = Math.max(peak, equity);
    const dd = peak ? (peak - equity) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, dd);
    equityCurve.push(Number(equity.toFixed(2)));
  }

  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;

  return {
    trades,
    winRate: trades.length ? (wins / trades.length) * 100 : null,
    avgRR,
    profitPct: trades.length ? profitPct * 100 : null,
    longStats: summarize("long"),
    shortStats: summarize("short"),
    setupWinrates,
    regimeWinrates,
    equityCurve: equityCurve.length ? equityCurve : [startEquity],
    maxDrawdown: maxDrawdown || null,
    profitFactor: profitFactor || null,
  };
};
// Vision AI Mind – Crypto Risk Engine
// (c) Vision AI – All rights reserved.
// Do not remove this header.
