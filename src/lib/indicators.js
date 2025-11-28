// Pure indicator utilities (no UI). Copied from legacy App.jsx helpers.

export const calculateEMA = (values, period) => {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
};

export const calculateRSISeries = (values, period = 14) => {
  if (values.length < period + 1) return [];
  const deltas = [];
  for (let i = 1; i < values.length; i += 1) deltas.push(values[i] - values[i - 1]);
  let gains = 0;
  let losses = 0;
  for (let i = 0; i < period; i += 1) {
    if (deltas[i] >= 0) gains += deltas[i];
    else losses -= deltas[i];
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsi = [];
  for (let i = period; i < deltas.length; i += 1) {
    const delta = deltas[i];
    if (delta >= 0) {
      avgGain = (avgGain * (period - 1) + delta) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - delta) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return Array(period).fill(null).concat(rsi);
};

export const calculateMACDSeries = (values, fast = 12, slow = 26, signal = 9) => {
  if (values.length < slow) return { macd: [], signal: [], histogram: [] };
  const emaFast = calculateEMA(values, fast);
  const emaSlow = calculateEMA(values, slow);
  const macd = emaFast.map((v, idx) => v - (emaSlow[idx] ?? v));
  const signalLine = calculateEMA(macd.slice(slow - 1), signal);
  const paddedSignal = Array(slow - 1).fill(null).concat(signalLine);
  const histogram = macd.map((m, idx) =>
    paddedSignal[idx] !== null && paddedSignal[idx] !== undefined ? m - paddedSignal[idx] : null
  );
  return { macd, signal: paddedSignal, histogram };
};

export const calculateBollingerBands = (values, period = 20, multiplier = 2) => {
  const upper = [];
  const lower = [];
  const basis = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < period) {
      upper.push(null);
      lower.push(null);
      basis.push(null);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    const std = Math.sqrt(variance);
    basis.push(mean);
    upper.push(mean + multiplier * std);
    lower.push(mean - multiplier * std);
  }
  return { upper, lower, basis };
};

export const calculateStochRSI = (values, period = 14, smoothK = 3, smoothD = 3) => {
  if (values.length < period + smoothK) return { k: [], d: [] };
  const rsi = calculateRSISeries(values, period);
  const k = [];
  for (let i = 0; i < rsi.length; i += 1) {
    if (i + 1 < smoothK) {
      k.push(null);
      continue;
    }
    const slice = rsi.slice(i + 1 - smoothK, i + 1).filter((v) => Number.isFinite(v));
    if (!slice.length) {
      k.push(null);
      continue;
    }
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const current = rsi[i];
    const value = max === min ? 0 : ((current - min) / (max - min)) * 100;
    k.push(value);
  }
  const d = [];
  for (let i = 0; i < k.length; i += 1) {
    if (i + 1 < smoothD) {
      d.push(null);
      continue;
    }
    const slice = k.slice(i + 1 - smoothD, i + 1).filter((v) => Number.isFinite(v));
    if (!slice.length) {
      d.push(null);
      continue;
    }
    d.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return { k, d };
};

export const calculateATR = (rows, period = 14) => {
  if (!rows.length) return [];
  const atr = [];
  let prevClose = rows[0].close;
  for (let i = 0; i < rows.length; i += 1) {
    const { high, low, close } = rows[i];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    if (i === 0) {
      atr.push(tr);
    } else if (i < period) {
      atr.push(((atr[i - 1] * i) + tr) / (i + 1));
    } else {
      atr.push(((atr[i - 1] * (period - 1)) + tr) / period);
    }
    prevClose = close;
  }
  return atr;
};

export const calculateADX = (rows, period = 14) => {
  if (rows.length < period + 1) return [];
  const tr = [];
  const plusDM = [];
  const minusDM = [];
  for (let i = 1; i < rows.length; i += 1) {
    const up = rows[i].high - rows[i - 1].high;
    const down = rows[i - 1].low - rows[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - rows[i - 1].close), Math.abs(rows[i].low - rows[i - 1].close)));
  }
  let tr14 = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let plus14 = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let minus14 = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  const adx = Array(rows.length).fill(null);
  const dxVals = [];
  const calcDI = () => {
    const plusDI = tr14 ? (plus14 / tr14) * 100 : 0;
    const minusDI = tr14 ? (minus14 / tr14) * 100 : 0;
    const dx = plusDI + minusDI === 0 ? 0 : (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    return { plusDI, minusDI, dx };
  };
  const first = calcDI();
  dxVals.push(first.dx);
  for (let i = period; i < tr.length; i += 1) {
    tr14 = tr14 - tr14 / period + tr[i];
    plus14 = plus14 - plus14 / period + plusDM[i];
    minus14 = minus14 - minus14 / period + minusDM[i];
    const { dx } = calcDI();
    dxVals.push(dx);
    if (dxVals.length === period) {
      adx[i + 1] = dxVals.reduce((a, b) => a + b, 0) / dxVals.length;
    } else if (dxVals.length > period) {
      adx[i + 1] = ((adx[i] || dx) * (period - 1) + dx) / period;
    }
  }
  return adx;
};

export const calculateDonchian = (rows, period = 20) => {
  const upper = [];
  const lower = [];
  const mid = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (i + 1 < period) {
      upper.push(null);
      lower.push(null);
      mid.push(null);
      continue;
    }
    const slice = rows.slice(i + 1 - period, i + 1);
    const highs = slice.map((r) => r.high);
    const lows = slice.map((r) => r.low);
    const hi = Math.max(...highs);
    const lo = Math.min(...lows);
    upper.push(hi);
    lower.push(lo);
    mid.push((hi + lo) / 2);
  }
  return { upper, lower, mid };
};

export const calculateVWAP = (rows) => {
  const out = [];
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const { high, low, close, volume } = rows[i];
    const typical = (high + low + close) / 3;
    cumPV += typical * volume;
    cumVol += volume;
    out.push(cumVol ? cumPV / cumVol : null);
  }
  return out;
};

export const calculateOBV = (rows) => {
  const out = [];
  let obv = 0;
  let prevClose = rows[0]?.close ?? 0;
  for (let i = 0; i < rows.length; i += 1) {
    const { close, volume } = rows[i];
    if (close > prevClose) obv += volume;
    else if (close < prevClose) obv -= volume;
    out.push(obv);
    prevClose = close;
  }
  return out;
};

export const calculateStochOsc = (rows, period = 14, smoothK = 3, smoothD = 3) => {
  if (!rows.length) return { k: [], d: [] };
  const kRaw = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (i + 1 < period) {
      kRaw.push(null);
      continue;
    }
    const slice = rows.slice(i + 1 - period, i + 1);
    const highs = slice.map((r) => r.high);
    const lows = slice.map((r) => r.low);
    const hi = Math.max(...highs);
    const lo = Math.min(...lows);
    const close = rows[i].close;
    const value = hi === lo ? 50 : ((close - lo) / (hi - lo)) * 100;
    kRaw.push(value);
  }
  const smooth = (arr, len) =>
    arr.map((_, idx) => {
      if (idx + 1 < len) return null;
      const seg = arr.slice(idx + 1 - len, idx + 1).filter((v) => Number.isFinite(v));
      if (!seg.length) return null;
      return seg.reduce((a, b) => a + b, 0) / seg.length;
    });
  const k = smooth(kRaw, smoothK);
  const d = smooth(k, smoothD);
  return { k, d };
};

export const calculateCCI = (rows, period = 20) => {
  if (!rows.length) return [];
  const cci = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (i + 1 < period) {
      cci.push(null);
      continue;
    }
    const slice = rows.slice(i + 1 - period, i + 1);
    const tp = slice.map((r) => (r.high + r.low + r.close) / 3);
    const sma = tp.reduce((a, b) => a + b, 0) / period;
    const dev = tp.reduce((a, b) => a + Math.abs(b - sma), 0) / period;
    const currentTp = tp[tp.length - 1];
    cci.push(dev ? (currentTp - sma) / (0.015 * dev) : null);
  }
  return cci;
};

export const calculatePearson = (a = [], b = []) => {
  if (!a.length || a.length !== b.length) return null;
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den ? num / den : null;
};
// Vision AI Mind – Crypto Risk Engine
// (c) Vision AI – All rights reserved.
// Do not remove this header.
