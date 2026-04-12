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
    case "all":
    case "dashboard": {
      // Calculate all indicators for dashboard display
      const period = params.period || 14;
      
      // RSI
      const gains = [];
      const losses = [];
      for (let i = 1; i < closes.length; i++) {
        const delta = closes[i] - closes[i - 1];
        gains.push(Math.max(0, delta));
        losses.push(Math.max(0, -delta));
      }
      const avgGains = ema(gains, period);
      const avgLosses = ema(losses, period);
      const rsiValue = (() => {
        const idx = closes.length - 1;
        if (idx === 0) return null;
        const g = avgGains[idx - 1] || 0;
        const l = avgLosses[idx - 1] || 0.00001;
        const rs = g / l;
        return 100 - 100 / (1 + rs);
      })();
      
      // MACD
      const fastEma = ema(closes, 12);
      const slowEma = ema(closes, 26);
      const macdLine = fastEma.map((v, idx) => (v !== undefined && slowEma[idx] !== undefined ? v - slowEma[idx] : null));
      const macdSignal = ema(macdLine.map((v) => (v === null ? 0 : v)), 9);
      const lastMacd = macdLine[macdLine.length - 1];
      const lastSignal = macdSignal[macdSignal.length - 1];
      const histogram = lastMacd !== null && lastSignal !== undefined ? lastMacd - lastSignal : null;
      
      // ATR
      const tr = candles.map((c, idx) => {
        const prevClose = idx > 0 ? closes[idx - 1] : closes[idx];
        const highLow = highs[idx] - lows[idx];
        const highClose = Math.abs(highs[idx] - prevClose);
        const lowClose = Math.abs(lows[idx] - prevClose);
        return Math.max(highLow, highClose, lowClose);
      });
      const atrSeries = ema(tr, period);
      const atrValue = atrSeries[atrSeries.length - 1];
      
      // Stochastic
      const stochPeriod = 14;
      const highSlice = highs.slice(-stochPeriod);
      const lowSlice = lows.slice(-stochPeriod);
      const highest = Math.max(...highSlice);
      const lowest = Math.min(...lowSlice);
      const currentClose = closes[closes.length - 1];
      const stochK = highest === lowest ? 50 : ((currentClose - lowest) / (highest - lowest)) * 100;
      
      // Trend (EMA Cross)
      const ema8 = ema(closes, 8);
      const ema21 = ema(closes, 21);
      const ema50 = ema(closes, 50);
      const lastEma8 = ema8[ema8.length - 1];
      const lastEma21 = ema21[ema21.length - 1];
      const lastEma50 = ema50[ema50.length - 1] || lastEma21;
      const trendBias = lastEma8 > lastEma21 && lastEma21 > lastEma50 ? "bullish" : 
                        lastEma8 < lastEma21 && lastEma21 < lastEma50 ? "bearish" : "neutral";
      
      // Momentum (Rate of Change)
      const rocPeriod = 10;
      const rocValue = closes.length > rocPeriod 
        ? ((currentClose - closes[closes.length - 1 - rocPeriod]) / closes[closes.length - 1 - rocPeriod]) * 100 
        : 0;
      
      // Volatility Score
      const returns = closes.slice(-20).map((v, idx, arr) => idx === 0 ? 0 : (v - arr[idx - 1]) / (arr[idx - 1] || 1));
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((acc, v) => acc + (v - mean) ** 2, 0) / returns.length;
      const volatility = Math.sqrt(variance) * 100;
      
      // Support/Resistance levels from recent highs/lows
      const recentHighs = highs.slice(-50);
      const recentLows = lows.slice(-50);
      const resistance = Math.max(...recentHighs);
      const support = Math.min(...recentLows);
      
      // Fibonacci Levels
      const range = resistance - support;
      const fibLevels = {
        "0%": support,
        "23.6%": support + range * 0.236,
        "38.2%": support + range * 0.382,
        "50%": support + range * 0.5,
        "61.8%": support + range * 0.618,
        "78.6%": support + range * 0.786,
        "100%": resistance,
      };
      
      // Signal Score (8-Point System)
      let score = 0;
      const reasons = [];
      
      // 1. RSI (oversold = bullish, overbought = bearish)
      if (rsiValue < 30) { score += 1; reasons.push("RSI oversold"); }
      else if (rsiValue > 70) { score -= 1; reasons.push("RSI overbought"); }
      
      // 2. MACD Cross
      if (lastMacd > lastSignal) { score += 1; reasons.push("MACD bullish"); }
      else if (lastMacd < lastSignal) { score -= 1; reasons.push("MACD bearish"); }
      
      // 3. MACD Histogram increasing
      if (histogram > 0) { score += 0.5; }
      else if (histogram < 0) { score -= 0.5; }
      
      // 4. EMA Trend
      if (trendBias === "bullish") { score += 1; reasons.push("EMA bullish"); }
      else if (trendBias === "bearish") { score -= 1; reasons.push("EMA bearish"); }
      
      // 5. Price above/below EMA21
      if (currentClose > lastEma21) { score += 0.5; }
      else { score -= 0.5; }
      
      // 6. Stochastic
      if (stochK < 20) { score += 0.5; reasons.push("Stoch oversold"); }
      else if (stochK > 80) { score -= 0.5; reasons.push("Stoch overbought"); }
      
      // 7. Momentum
      if (rocValue > 2) { score += 0.5; reasons.push("Strong momentum"); }
      else if (rocValue < -2) { score -= 0.5; reasons.push("Weak momentum"); }
      
      // 8. Support/Resistance proximity
      const distToSupport = (currentClose - support) / range;
      const distToResistance = (resistance - currentClose) / range;
      if (distToSupport < 0.1) { score += 0.5; reasons.push("Near support"); }
      if (distToResistance < 0.1) { score -= 0.5; reasons.push("Near resistance"); }
      
      // Normalize score to -5 to +5
      score = Math.max(-5, Math.min(5, score));
      
      // Generate signal
      const signalDirection = score >= 2 ? "BUY" : score <= -2 ? "SELL" : "HOLD";
      const signalStrength = Math.abs(score);
      const confidence = Math.min(100, Math.round((signalStrength / 5) * 100));
      
      return {
        type: "all",
        currentPrice: currentClose,
        rsi: rsiValue,
        macd: lastMacd,
        macdSignal: lastSignal,
        histogram: histogram,
        atr: atrValue,
        stochK: stochK,
        ema8: lastEma8,
        ema21: lastEma21,
        ema50: lastEma50,
        trend: trendBias,
        momentum: rocValue,
        volatility: volatility,
        support: support,
        resistance: resistance,
        fibLevels: fibLevels,
        signal: {
          direction: signalDirection,
          score: score,
          strength: signalStrength,
          confidence: confidence,
          reasons: reasons,
        },
        timestamp: Date.now(),
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
