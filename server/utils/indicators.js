const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const getCloses = (candles = []) => candles.map((c) => toNumber(c.close || c.c || 0));

const getHighs = (candles = []) => candles.map((c) => toNumber(c.high || c.h || 0));

const getLows = (candles = []) => candles.map((c) => toNumber(c.low || c.l || 0));

const getVolumes = (candles = []) => candles.map((c) => toNumber(c.volume || c.vol || 0));

const sma = (values = [], period = 14) => {
  if (!Array.isArray(values) || values.length === 0) return [];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      result.push(null);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    const avg = slice.reduce((sum, v) => sum + v, 0) / period;
    result.push(avg);
  }
  return result;
};

const ema = (values = [], period = 14) => {
  const k = 2 / (period + 1);
  let prev;
  return values.map((v, idx) => {
    if (idx === 0 || prev === undefined || prev === null) {
      prev = v;
      return prev;
    }
    prev = v * k + prev * (1 - k);
    return prev;
  });
};

const stdDev = (values = [], period = 20) => {
  if (values.length < period) return [];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      result.push(null);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    const mean = slice.reduce((acc, v) => acc + v, 0) / slice.length;
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / slice.length;
    result.push(Math.sqrt(variance));
  }
  return result;
};

export const buildIndicators = (candles = [], { type = "rsi", params = {} } = {}) => {
  const closes = getCloses(candles);
  const highs = getHighs(candles);
  const lows = getLows(candles);
  const volumes = getVolumes(candles);
  const length = candles.length;

  switch (type) {
    case "ema":
    case "emaCross": {
      const fastPeriod = params.fastPeriod || 9;
      const slowPeriod = params.slowPeriod || 21;
      const fast = ema(closes, fastPeriod);
      const slow = ema(closes, slowPeriod);
      return { type: "emaCross", values: candles.map((c, idx) => ({ time: c.time, fast: fast[idx], slow: slow[idx] })) };
    }
    case "macd": {
      const fast = ema(closes, params.fast || 12);
      const slow = ema(closes, params.slow || 26);
      const macdLine = fast.map((v, idx) => (v !== undefined && slow[idx] !== undefined ? v - slow[idx] : null));
      const signal = ema(macdLine.map((v) => (v === null ? 0 : v)), params.signal || 9);
      const histogram = macdLine.map((v, idx) => (v !== null && signal[idx] !== undefined ? v - signal[idx] : null));
      return {
        type: "macd",
        values: candles.map((c, idx) => ({
          time: c.time,
          macd: macdLine[idx],
          signal: signal[idx],
          histogram: histogram[idx],
        })),
      };
    }
    case "stoch": {
      const period = params.period || 14;
      const smoothK = params.smoothK || 3;
      const smoothD = params.smoothD || 3;
      const kValues = [];
      for (let i = 0; i < length; i++) {
        if (i + 1 < period) {
          kValues.push(null);
          continue;
        }
        const highSlice = highs.slice(i + 1 - period, i + 1);
        const lowSlice = lows.slice(i + 1 - period, i + 1);
        const highest = Math.max(...highSlice);
        const lowest = Math.min(...lowSlice);
        const currentClose = closes[i];
        const k = highest === lowest ? 0 : ((currentClose - lowest) / (highest - lowest)) * 100;
        kValues.push(k);
      }
      const smoothSeries = sma(kValues.map((v) => (v === null ? 0 : v)), smoothK);
      const dSeries = sma(smoothSeries.map((v) => (v === null ? 0 : v)), smoothD);
      return {
        type: "stoch",
        values: candles.map((c, idx) => ({
          time: c.time,
          k: smoothSeries[idx],
          d: dSeries[idx],
        })),
      };
    }
    case "atr": {
      const period = params.period || 14;
      const tr = candles.map((c, idx) => {
        const prevClose = idx > 0 ? closes[idx - 1] : closes[idx];
        const highLow = highs[idx] - lows[idx];
        const highClose = Math.abs(highs[idx] - prevClose);
        const lowClose = Math.abs(lows[idx] - prevClose);
        return Math.max(highLow, highClose, lowClose);
      });
      const atrSeries = ema(tr, period);
      return { type: "atr", values: candles.map((c, idx) => ({ time: c.time, value: atrSeries[idx] })) };
    }
    case "volatility": {
      const period = params.period || 20;
      const returns = closes.map((v, idx) => (idx === 0 ? 0 : (v - closes[idx - 1]) / (closes[idx - 1] || 1)));
      const vol = stdDev(returns, period);
      return { type: "volatility", values: candles.map((c, idx) => ({ time: c.time, value: vol[idx] })) };
    }
    case "trend": {
      const fast = ema(closes, params.fast || 8);
      const slow = ema(closes, params.slow || 34);
      const slopePeriod = params.slopePeriod || 5;
      const slope = closes.map((_, idx) => {
        if (idx + 1 < slopePeriod) return null;
        const slice = fast.slice(idx + 1 - slopePeriod, idx + 1);
        const start = slice[0];
        const end = slice[slice.length - 1];
        if (start === null || start === undefined) return null;
        return (end - start) / Math.max(Math.abs(start), 1);
      });
      return {
        type: "trend",
        values: candles.map((c, idx) => ({
          time: c.time,
          bias: fast[idx] > slow[idx] ? "bull" : "bear",
          slope: slope[idx],
        })),
      };
    }
    case "smf":
    case "smartMoneyFlow": {
      const flow = candles.map((c, idx) => {
        const typicalPrice = (toNumber(c.high) + toNumber(c.low) + toNumber(c.close)) / 3;
        const moneyFlow = typicalPrice * (volumes[idx] || 0);
        const signed = toNumber(c.close) >= toNumber(c.open || c.close) ? moneyFlow : -moneyFlow;
        return signed;
      });
      const cumulative = flow.reduce((acc, v) => {
        const next = acc.length ? acc[acc.length - 1] + v : v;
        acc.push(next);
        return acc;
      }, []);
      return {
        type: "smartMoneyFlow",
        values: candles.map((c, idx) => ({
          time: c.time,
          flow: flow[idx],
          cumulative: cumulative[idx],
        })),
      };
    }
    case "rsi":
    default: {
      const period = params.period || 14;
      const gains = [];
      const losses = [];
      for (let i = 1; i < closes.length; i++) {
        const delta = closes[i] - closes[i - 1];
        gains.push(Math.max(0, delta));
        losses.push(Math.max(0, -delta));
      }
      const avgGains = ema(gains, period);
      const avgLosses = ema(losses, period);
      const rsiSeries = closes.map((_, idx) => {
        if (idx === 0) return null;
        const g = avgGains[idx - 1] || 0;
        const l = avgLosses[idx - 1] || 0.00001;
        const rs = g / l;
        return 100 - 100 / (1 + rs);
      });
      return { type: "rsi", values: candles.map((c, idx) => ({ time: c.time, value: rsiSeries[idx] })) };
    }
  }
};

export default { buildIndicators };
