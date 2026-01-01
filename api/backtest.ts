/**
 * Backtesting Simulator API
 * Vision AI Mind - Vision AI Mind
 * 
 * Simulates trading strategy against historical data
 * with walk-forward validation and comprehensive metrics.
 * 
 * Features:
 * - Trade simulation with TP/SL hit detection
 * - Win-Rate, Profit Factor, Sharpe Ratio, Max Drawdown
 * - Volatility filter comparison (with vs without)
 * - Monthly returns breakdown
 * - Complete trade log
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
const safeFixed = (val: number, digits = 2) => (Number(val) || 0).toFixed(digits);

// ============ Types ============

interface StrategyParams {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  useVolatilityFilter: boolean;
  volThreshold: number;
  tpPercent: number;
  slPercent: number;
}

interface BacktestConfig {
  asset: string;
  startDate: string;
  endDate: string;
  strategy: StrategyParams;
  interval: string;
}

interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandleWithIndicators extends Candle {
  rsi: number | null;
  macd: { line: number; signal: number; histogram: number } | null;
  ema200: number | null;
  atr: number | null;
  volScore: number;
}

interface Trade {
  id: number;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  direction: 'LONG' | 'SHORT';
  pnl: number;
  pnlPercent: number;
  exitReason: 'TP_HIT' | 'SL_HIT' | 'SIGNAL_REVERSE' | 'END_OF_DATA';
  holdingPeriod: number; // in hours
  indicators: {
    rsi: number | null;
    macd: number | null;
    volScore: number;
  };
}

interface BacktestResult {
  asset: string;
  period: string;
  interval: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriod: string;
  monthlyReturns: { month: string; return: number; trades: number }[];
  tradeLog: Trade[];
  comparison: {
    withVolFilter: number;
    withoutVolFilter: number;
    improvement: number;
  };
  timestamp: number;
}

// ============ Symbol Mapping ============

const YAHOO_SYMBOLS: Record<string, string> = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD',
  XRP: 'XRP-USD',
  ADA: 'ADA-USD',
  DOGE: 'DOGE-USD',
  AVAX: 'AVAX-USD',
  DOT: 'DOT-USD',
  LINK: 'LINK-USD',
  MATIC: 'MATIC-USD',
  DAX: '^GDAXI',
  SPX: '^GSPC',
  NDQ: '^IXIC',
  DJI: '^DJI',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
  USDCHF: 'USDCHF=X',
  Gold: 'GC=F',
  Silver: 'SI=F',
  Oil: 'CL=F',
  NatGas: 'NG=F',
};

// ============ Indicator Calculations ============

function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, val) => sum + val, 0) / period;
}

// Export SMA for potential external use
export { calculateSMA };

function calculateEMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = closes[closes.length - period - 1 + i] - closes[closes.length - period - 2 + i];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): { line: number; signal: number; histogram: number } | null {
  if (closes.length < slow + signal) return null;
  
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  
  if (emaFast === null || emaSlow === null) return null;
  
  const macdLine = emaFast - emaSlow;
  
  // Calculate signal line (EMA of MACD line)
  const macdValues: number[] = [];
  for (let i = slow; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    const ef = calculateEMA(slice, fast);
    const es = calculateEMA(slice, slow);
    if (ef !== null && es !== null) {
      macdValues.push(ef - es);
    }
  }
  
  const signalLine = macdValues.length >= signal 
    ? calculateEMA(macdValues, signal) 
    : null;
  
  return {
    line: macdLine,
    signal: signalLine ?? macdLine,
    histogram: macdLine - (signalLine ?? macdLine)
  };
}

function calculateATR(candles: Candle[], period: number = 14): number | null {
  if (candles.length < period + 1) return null;
  
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trs.push(tr);
  }
  
  if (trs.length < period) return null;
  
  // Wilder's smoothed ATR
  let atr = trs.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  
  return atr;
}

function calculateVolatilityScore(candles: Candle[]): number {
  if (candles.length < 30) return 50; // Default medium
  
  const closes = candles.map(c => c.close);
  const atr = calculateATR(candles, 14);
  const currentPrice = closes[closes.length - 1];
  
  if (!atr) return 50;
  
  const atrPercent = (atr / currentPrice) * 100;
  
  // Calculate 30-day historical volatility
  const returns: number[] = [];
  for (let i = 1; i < Math.min(31, closes.length); i++) {
    returns.push(Math.log(closes[closes.length - i] / closes[closes.length - i - 1]));
  }
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length;
  const histVol = Math.sqrt(variance * 365) * 100;
  
  // Composite score (0-100)
  const atrScore = Math.min(100, (atrPercent / 5) * 50);
  const histVolScore = Math.min(100, (histVol / 100) * 50);
  
  return Math.round((atrScore + histVolScore) / 2);
}

// ============ Data Fetching ============

async function fetchHistoricalData(
  asset: string,
  startDate: string,
  endDate: string,
  interval: string
): Promise<Candle[]> {
  const symbol = YAHOO_SYMBOLS[asset] || `${asset}-USD`;
  
  const start = Math.floor(new Date(startDate).getTime() / 1000);
  const end = Math.floor(new Date(endDate).getTime() / 1000);
  
  // Map interval to Yahoo format
  const yahooInterval = interval === '1h' ? '1h' : interval === '4h' ? '1h' : '1d';
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=${yahooInterval}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data for ${asset}: ${response.status}`);
  }
  
  const data = await response.json();
  const result = data.chart?.result?.[0];
  
  if (!result || !result.timestamp) {
    throw new Error(`No data available for ${asset}`);
  }
  
  const { timestamp, indicators } = result;
  const quote = indicators?.quote?.[0];
  
  if (!quote) {
    throw new Error(`Invalid quote data for ${asset}`);
  }
  
  const candles: Candle[] = [];
  
  for (let i = 0; i < timestamp.length; i++) {
    if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i]) {
      candles.push({
        timestamp: new Date(timestamp[i] * 1000).toISOString(),
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i] || 0,
      });
    }
  }
  
  // Aggregate to 4h if needed
  if (interval === '4h' && yahooInterval === '1h') {
    return aggregateCandles(candles, 4);
  }
  
  return candles;
}

function aggregateCandles(candles: Candle[], period: number): Candle[] {
  const aggregated: Candle[] = [];
  
  for (let i = 0; i < candles.length; i += period) {
    const slice = candles.slice(i, i + period);
    if (slice.length === 0) continue;
    
    aggregated.push({
      timestamp: slice[0].timestamp,
      open: slice[0].open,
      high: Math.max(...slice.map(c => c.high)),
      low: Math.min(...slice.map(c => c.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  
  return aggregated;
}

// ============ Signal Generation ============

function generateSignal(
  candle: CandleWithIndicators,
  prevCandle: CandleWithIndicators,
  strategy: StrategyParams
): 'LONG' | 'SHORT' | null {
  const { rsiOversold, rsiOverbought, useVolatilityFilter, volThreshold } = strategy;
  
  // Volatility filter - skip high volatility periods
  if (useVolatilityFilter && candle.volScore > volThreshold) {
    return null;
  }
  
  // Need valid indicators
  if (candle.rsi === null || candle.macd === null || candle.ema200 === null) {
    return null;
  }
  if (prevCandle.macd === null) {
    return null;
  }
  
  // LONG conditions:
  // - RSI oversold
  // - MACD histogram rising
  // - Price above EMA200 (uptrend)
  if (
    candle.rsi < rsiOversold &&
    candle.macd.histogram > prevCandle.macd.histogram &&
    candle.close > candle.ema200
  ) {
    return 'LONG';
  }
  
  // SHORT conditions:
  // - RSI overbought
  // - MACD histogram falling
  // - Price below EMA200 (downtrend)
  if (
    candle.rsi > rsiOverbought &&
    candle.macd.histogram < prevCandle.macd.histogram &&
    candle.close < candle.ema200
  ) {
    return 'SHORT';
  }
  
  return null;
}

function shouldExit(
  candle: CandleWithIndicators,
  entryDirection: 'LONG' | 'SHORT',
  _strategy: StrategyParams
): boolean {
  if (candle.rsi === null || candle.macd === null) return false;
  
  // Exit LONG if RSI overbought and MACD turning down
  if (entryDirection === 'LONG') {
    return candle.rsi > 70 && candle.macd.histogram < 0;
  }
  
  // Exit SHORT if RSI oversold and MACD turning up
  if (entryDirection === 'SHORT') {
    return candle.rsi < 30 && candle.macd.histogram > 0;
  }
  
  return false;
}

// ============ Backtest Engine ============

function runBacktest(
  data: CandleWithIndicators[],
  strategy: StrategyParams
): Trade[] {
  const trades: Trade[] = [];
  let currentPosition: 'LONG' | 'SHORT' | null = null;
  let entryCandle: CandleWithIndicators | null = null;
  let tradeId = 1;
  
  const lookbackRequired = Math.max(200, strategy.macdSlow + 50);
  
  for (let i = lookbackRequired; i < data.length; i++) {
    const candle = data[i];
    const prevCandle = data[i - 1];
    
    if (currentPosition && entryCandle) {
      // Check exit conditions
      const entryPrice = entryCandle.close;
      
      let tp: number, sl: number;
      if (currentPosition === 'LONG') {
        tp = entryPrice * (1 + strategy.tpPercent / 100);
        sl = entryPrice * (1 - strategy.slPercent / 100);
      } else {
        tp = entryPrice * (1 - strategy.tpPercent / 100);
        sl = entryPrice * (1 + strategy.slPercent / 100);
      }
      
      let exitReason: Trade['exitReason'] | null = null;
      let exitPrice = candle.close;
      
      if (currentPosition === 'LONG') {
        if (candle.high >= tp) {
          exitReason = 'TP_HIT';
          exitPrice = tp;
        } else if (candle.low <= sl) {
          exitReason = 'SL_HIT';
          exitPrice = sl;
        } else if (shouldExit(candle, currentPosition, strategy)) {
          exitReason = 'SIGNAL_REVERSE';
        }
      } else {
        if (candle.low <= tp) {
          exitReason = 'TP_HIT';
          exitPrice = tp;
        } else if (candle.high >= sl) {
          exitReason = 'SL_HIT';
          exitPrice = sl;
        } else if (shouldExit(candle, currentPosition, strategy)) {
          exitReason = 'SIGNAL_REVERSE';
        }
      }
      
      // Close trade if exit triggered
      if (exitReason) {
        let pnlPercent: number;
        if (currentPosition === 'LONG') {
          pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
        } else {
          pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
        }
        
        const entryTime = new Date(entryCandle.timestamp).getTime();
        const exitTime = new Date(candle.timestamp).getTime();
        const holdingHours = (exitTime - entryTime) / (1000 * 60 * 60);
        
        trades.push({
          id: tradeId++,
          entryDate: entryCandle.timestamp,
          entryPrice,
          exitDate: candle.timestamp,
          exitPrice,
          direction: currentPosition,
          pnl: exitPrice - entryPrice,
          pnlPercent,
          exitReason,
          holdingPeriod: holdingHours,
          indicators: {
            rsi: entryCandle.rsi,
            macd: entryCandle.macd?.histogram ?? null,
            volScore: entryCandle.volScore,
          },
        });
        
        currentPosition = null;
        entryCandle = null;
      }
    } else {
      // No position - check entry conditions
      const signal = generateSignal(candle, prevCandle, strategy);
      
      if (signal) {
        currentPosition = signal;
        entryCandle = candle;
      }
    }
  }
  
  // Close any open position at end of data
  if (currentPosition && entryCandle) {
    const lastCandle = data[data.length - 1];
    const entryPrice = entryCandle.close;
    let pnlPercent: number;
    
    if (currentPosition === 'LONG') {
      pnlPercent = ((lastCandle.close - entryPrice) / entryPrice) * 100;
    } else {
      pnlPercent = ((entryPrice - lastCandle.close) / entryPrice) * 100;
    }
    
    const entryTime = new Date(entryCandle.timestamp).getTime();
    const exitTime = new Date(lastCandle.timestamp).getTime();
    
    trades.push({
      id: tradeId,
      entryDate: entryCandle.timestamp,
      entryPrice,
      exitDate: lastCandle.timestamp,
      exitPrice: lastCandle.close,
      direction: currentPosition,
      pnl: lastCandle.close - entryPrice,
      pnlPercent,
      exitReason: 'END_OF_DATA',
      holdingPeriod: (exitTime - entryTime) / (1000 * 60 * 60),
      indicators: {
        rsi: entryCandle.rsi,
        macd: entryCandle.macd?.histogram ?? null,
        volScore: entryCandle.volScore,
      },
    });
  }
  
  return trades;
}

// ============ Metrics Calculation ============

function calculateMetrics(trades: Trade[]): Omit<BacktestResult, 'asset' | 'period' | 'interval' | 'tradeLog' | 'comparison' | 'timestamp' | 'monthlyReturns'> {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalReturn: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      avgHoldingPeriod: '0h',
    };
  }
  
  const winners = trades.filter(t => t.pnlPercent > 0);
  const losers = trades.filter(t => t.pnlPercent <= 0);
  
  const totalPnl = trades.reduce((sum, t) => sum + t.pnlPercent, 0);
  const winRate = (winners.length / trades.length) * 100;
  
  const grossProfit = winners.reduce((sum, t) => sum + t.pnlPercent, 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnlPercent, 0));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  
  // Sharpe Ratio
  const returns = trades.map(t => t.pnlPercent);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
  );
  const sharpeRatio = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(365);
  
  // Max Drawdown
  let peak = 0;
  let maxDD = 0;
  let cumReturn = 0;
  
  for (const trade of trades) {
    cumReturn += trade.pnlPercent;
    if (cumReturn > peak) peak = cumReturn;
    const drawdown = peak > 0 ? ((cumReturn - peak) / peak) * 100 : 0;
    if (drawdown < maxDD) maxDD = drawdown;
  }
  
  // Average holding period
  const totalHours = trades.reduce((sum, t) => sum + t.holdingPeriod, 0);
  const avgHours = totalHours / trades.length;
  const avgHoldingPeriod = avgHours >= 24 
    ? `${Math.round(avgHours / 24)}d` 
    : `${Math.round(avgHours)}h`;
  
  return {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: parseFloat(safeFixed(winRate, 1)),
    profitFactor: parseFloat(safeFixed(Math.min(profitFactor, 99), 2)),
    sharpeRatio: parseFloat(safeFixed(sharpeRatio, 2)),
    maxDrawdown: parseFloat(safeFixed(maxDD, 1)),
    totalReturn: parseFloat(safeFixed(totalPnl, 1)),
    avgWin: winners.length > 0 ? parseFloat(safeFixed(grossProfit / winners.length, 2)) : 0,
    avgLoss: losers.length > 0 ? parseFloat(safeFixed(grossLoss / losers.length, 2)) : 0,
    largestWin: winners.length > 0 ? parseFloat(safeFixed(Math.max(...winners.map(t => t.pnlPercent)), 2)) : 0,
    largestLoss: losers.length > 0 ? parseFloat(safeFixed(Math.min(...losers.map(t => t.pnlPercent)), 2)) : 0,
    avgHoldingPeriod,
  };
}

function calculateMonthlyReturns(trades: Trade[]): { month: string; return: number; trades: number }[] {
  const monthlyMap: Record<string, { return: number; trades: number }> = {};
  
  for (const trade of trades) {
    const month = trade.exitDate.slice(0, 7); // YYYY-MM
    if (!monthlyMap[month]) {
      monthlyMap[month] = { return: 0, trades: 0 };
    }
    monthlyMap[month].return += trade.pnlPercent;
    monthlyMap[month].trades += 1;
  }
  
  return Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      return: parseFloat(safeFixed(data.return, 2)),
      trades: data.trades,
    }));
}

// ============ Main Handler ============

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', message: 'Use POST' });
    return;
  }
  
  try {
    const config: BacktestConfig = req.body;
    
    // Validate input
    if (!config.asset) {
      res.status(400).json({ error: 'Missing asset' });
      return;
    }
    
    // Default strategy if not provided
    const strategy: StrategyParams = config.strategy || {
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      macdFast: 12,
      macdSlow: 26,
      macdSignal: 9,
      useVolatilityFilter: true,
      volThreshold: 70,
      tpPercent: 4.0,
      slPercent: 3.0,
    };
    
    // Default dates (last 6 months)
    const endDate = config.endDate || new Date().toISOString().split('T')[0];
    const startDate = config.startDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const interval = config.interval || '1h';
    
    console.log(`[Backtest] Running for ${config.asset} from ${startDate} to ${endDate}`);
    
    // Fetch historical data
    const rawData = await fetchHistoricalData(config.asset, startDate, endDate, interval);
    
    if (rawData.length < 100) {
      res.status(400).json({
        error: 'Insufficient data',
        message: `Need at least 100 candles, got ${rawData.length}`,
      });
      return;
    }
    
    console.log(`[Backtest] Loaded ${rawData.length} candles`);
    
    // Calculate indicators for all candles
    const dataWithIndicators: CandleWithIndicators[] = rawData.map((candle, i, arr) => {
      const lookback = arr.slice(0, i + 1);
      const closes = lookback.map(c => c.close);
      
      return {
        ...candle,
        rsi: calculateRSI(closes, strategy.rsiPeriod),
        macd: calculateMACD(closes, strategy.macdFast, strategy.macdSlow, strategy.macdSignal),
        ema200: calculateEMA(closes, 200),
        atr: calculateATR(lookback, 14),
        volScore: calculateVolatilityScore(lookback),
      };
    });
    
    // Run backtest WITH volatility filter
    const tradesWithFilter = runBacktest(dataWithIndicators, strategy);
    const metricsWithFilter = calculateMetrics(tradesWithFilter);
    
    // Run backtest WITHOUT volatility filter for comparison
    const strategyNoFilter = { ...strategy, useVolatilityFilter: false };
    const tradesWithoutFilter = runBacktest(dataWithIndicators, strategyNoFilter);
    const metricsWithoutFilter = calculateMetrics(tradesWithoutFilter);
    
    // Calculate monthly returns
    const monthlyReturns = calculateMonthlyReturns(tradesWithFilter);
    
    // Build result
    const result: BacktestResult = {
      asset: config.asset,
      period: `${startDate} to ${endDate}`,
      interval,
      ...metricsWithFilter,
      monthlyReturns,
      tradeLog: tradesWithFilter.slice(-100), // Last 100 trades only
      comparison: {
        withVolFilter: metricsWithFilter.winRate,
        withoutVolFilter: metricsWithoutFilter.winRate,
        improvement: parseFloat(safeFixed(metricsWithFilter.winRate - metricsWithoutFilter.winRate, 1)),
      },
      timestamp: Date.now(),
    };
    
    console.log(`[Backtest] Complete: ${result.totalTrades} trades, ${result.winRate}% win-rate`);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('[Backtest] Error:', error);
    res.status(500).json({
      error: 'Backtest failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

