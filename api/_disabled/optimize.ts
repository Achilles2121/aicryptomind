/**
 * Strategy Optimizer API (Grid Search)
 * Vision AI Mind - Elite Trader
 * 
 * Finds optimal strategy parameters through grid search
 * across 1,296+ parameter combinations.
 * 
 * Features:
 * - Parameter grid search (RSI, MACD, Vol Threshold, TP/SL)
 * - Composite scoring (Win-Rate, Profit Factor, Sharpe, Drawdown)
 * - Returns top 10 best parameter combinations
 * - Comparison with baseline strategy
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

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

interface OptimizationResult {
  strategy: StrategyParams;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  totalTrades: number;
  score: number;
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
  pnlPercent: number;
  direction: 'LONG' | 'SHORT';
}

// ============ Symbol Mapping ============

const YAHOO_SYMBOLS: Record<string, string> = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD',
  DAX: '^GDAXI',
  SPX: '^GSPC',
  NDQ: '^IXIC',
  EURUSD: 'EURUSD=X',
  Gold: 'GC=F',
};

// ============ Indicator Calculations (Optimized) ============

function calculateEMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[closes.length - period - 1 + i] - closes[closes.length - period - 2 + i];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

function calculateMACD(closes: number[], fast: number, slow: number, signal: number): { line: number; signal: number; histogram: number } | null {
  if (closes.length < slow + signal) return null;
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  if (emaFast === null || emaSlow === null) return null;
  const macdLine = emaFast - emaSlow;
  // Simplified signal line
  return { line: macdLine, signal: macdLine * 0.9, histogram: macdLine * 0.1 };
}

function calculateATR(candles: Candle[], period: number): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  let atr = trs.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

function calculateVolatilityScore(candles: Candle[]): number {
  if (candles.length < 30) return 50;
  const atr = calculateATR(candles, 14);
  if (!atr) return 50;
  const price = candles[candles.length - 1].close;
  const atrPercent = (atr / price) * 100;
  return Math.min(100, Math.round(atrPercent * 20));
}

// ============ Data Fetching ============

async function fetchHistoricalData(asset: string, startDate: string, endDate: string): Promise<Candle[]> {
  const symbol = YAHOO_SYMBOLS[asset] || `${asset}-USD`;
  const start = Math.floor(new Date(startDate).getTime() / 1000);
  const end = Math.floor(new Date(endDate).getTime() / 1000);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${start}&period2=${end}&interval=1d`;
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  
  if (!response.ok) throw new Error(`Failed to fetch ${asset}`);
  
  const data = await response.json();
  const result = data.chart?.result?.[0];
  if (!result?.timestamp) throw new Error(`No data for ${asset}`);
  
  const { timestamp, indicators } = result;
  const quote = indicators?.quote?.[0];
  if (!quote) throw new Error(`Invalid data for ${asset}`);
  
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
  
  return candles;
}

// ============ Fast Backtest (Optimized for Grid Search) ============

function fastBacktest(data: CandleWithIndicators[], strategy: StrategyParams): { trades: Trade[]; winRate: number; profitFactor: number; sharpeRatio: number; maxDrawdown: number; totalReturn: number } {
  const trades: Trade[] = [];
  let position: 'LONG' | 'SHORT' | null = null;
  let entryPrice = 0;
  let entryVolScore = 0;
  
  for (let i = 201; i < data.length; i++) {
    const c = data[i];
    const prev = data[i - 1];
    
    if (position) {
      // Check exit
      let exit = false;
      let exitPrice = c.close;
      
      if (position === 'LONG') {
        const tp = entryPrice * (1 + strategy.tpPercent / 100);
        const sl = entryPrice * (1 - strategy.slPercent / 100);
        if (c.high >= tp) { exit = true; exitPrice = tp; }
        else if (c.low <= sl) { exit = true; exitPrice = sl; }
        else if (c.rsi && c.rsi > 70) exit = true;
      } else {
        const tp = entryPrice * (1 - strategy.tpPercent / 100);
        const sl = entryPrice * (1 + strategy.slPercent / 100);
        if (c.low <= tp) { exit = true; exitPrice = tp; }
        else if (c.high >= sl) { exit = true; exitPrice = sl; }
        else if (c.rsi && c.rsi < 30) exit = true;
      }
      
      if (exit) {
        const pnl = position === 'LONG'
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;
        trades.push({ pnlPercent: pnl, direction: position });
        position = null;
      }
    } else {
      // Check entry
      if (strategy.useVolatilityFilter && c.volScore > strategy.volThreshold) continue;
      if (!c.rsi || !c.macd || !c.ema200 || !prev.macd) continue;
      
      if (c.rsi < strategy.rsiOversold && c.macd.histogram > prev.macd.histogram && c.close > c.ema200) {
        position = 'LONG';
        entryPrice = c.close;
        entryVolScore = c.volScore;
      } else if (c.rsi > strategy.rsiOverbought && c.macd.histogram < prev.macd.histogram && c.close < c.ema200) {
        position = 'SHORT';
        entryPrice = c.close;
        entryVolScore = c.volScore;
      }
    }
  }
  
  // Calculate metrics
  if (trades.length === 0) {
    return { trades: [], winRate: 0, profitFactor: 0, sharpeRatio: 0, maxDrawdown: 0, totalReturn: 0 };
  }
  
  const winners = trades.filter(t => t.pnlPercent > 0);
  const losers = trades.filter(t => t.pnlPercent <= 0);
  const winRate = (winners.length / trades.length) * 100;
  
  const grossProfit = winners.reduce((s, t) => s + t.pnlPercent, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnlPercent, 0));
  const profitFactor = grossLoss === 0 ? 99 : Math.min(99, grossProfit / grossLoss);
  
  const returns = trades.map(t => t.pnlPercent);
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((s, r) => s + (r - avg) ** 2, 0) / returns.length);
  const sharpeRatio = std === 0 ? 0 : (avg / std) * Math.sqrt(365);
  
  let peak = 0, maxDD = 0, cum = 0;
  for (const t of trades) {
    cum += t.pnlPercent;
    if (cum > peak) peak = cum;
    const dd = peak > 0 ? ((cum - peak) / peak) * 100 : 0;
    if (dd < maxDD) maxDD = dd;
  }
  
  return {
    trades,
    winRate: parseFloat(winRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    maxDrawdown: parseFloat(maxDD.toFixed(1)),
    totalReturn: parseFloat(cum.toFixed(1)),
  };
}

// ============ Scoring Function ============

function calculateScore(result: { winRate: number; profitFactor: number; sharpeRatio: number; maxDrawdown: number; totalTrades?: number }): number {
  // Weighted composite score (higher = better)
  // Win Rate: 30% weight
  // Profit Factor: 25% weight (scaled by 15)
  // Sharpe Ratio: 30% weight (scaled by 25)
  // Max Drawdown: 15% penalty
  
  const winRateScore = result.winRate * 0.30;
  const pfScore = Math.min(result.profitFactor, 5) * 15 * 0.25;
  const sharpeScore = Math.min(result.sharpeRatio, 3) * 25 * 0.30;
  const ddPenalty = Math.min(Math.abs(result.maxDrawdown), 50) * 0.15;
  
  // Bonus for having enough trades (avoid overfitting)
  const tradeBonus = (result.totalTrades || 0) >= 20 ? 5 : 0;
  
  return winRateScore + pfScore + sharpeScore - ddPenalty + tradeBonus;
}

// ============ Main Handler ============

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const { asset, startDate, endDate, quickMode } = req.body;
    
    if (!asset) {
      res.status(400).json({ error: 'Missing asset' });
      return;
    }
    
    // Default to last 6 months
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`[Optimize] Grid search for ${asset} from ${start} to ${end}`);
    
    // Fetch data once
    const rawData = await fetchHistoricalData(asset, start, end);
    
    if (rawData.length < 100) {
      res.status(400).json({ error: 'Insufficient data', count: rawData.length });
      return;
    }
    
    // Pre-calculate base indicators
    const dataWithIndicators: CandleWithIndicators[] = rawData.map((c, i, arr) => {
      const lookback = arr.slice(0, i + 1);
      const closes = lookback.map(x => x.close);
      return {
        ...c,
        rsi: calculateRSI(closes, 14),
        macd: calculateMACD(closes, 12, 26, 9),
        ema200: calculateEMA(closes, 200),
        atr: calculateATR(lookback, 14),
        volScore: calculateVolatilityScore(lookback),
      };
    });
    
    // Parameter grid (reduced for speed, full grid = 1296 combinations)
    const paramGrid = quickMode ? {
      rsiPeriod: [14],
      rsiOversold: [28, 30, 32],
      rsiOverbought: [68, 70, 72],
      volThreshold: [0, 65, 75, 85], // 0 = disabled
      tpPercent: [3.5, 4.0, 4.5],
      slPercent: [2.5, 3.0, 3.5],
    } : {
      rsiPeriod: [12, 14, 16],
      rsiOversold: [25, 28, 30, 32, 35],
      rsiOverbought: [65, 68, 70, 72, 75],
      volThreshold: [0, 50, 65, 75, 85], // 0 = disabled
      tpPercent: [3.0, 3.5, 4.0, 4.5, 5.0],
      slPercent: [2.0, 2.5, 3.0, 3.5, 4.0],
    };
    
    const results: OptimizationResult[] = [];
    let tested = 0;
    
    // Grid search
    for (const rsiPeriod of paramGrid.rsiPeriod) {
      for (const rsiOversold of paramGrid.rsiOversold) {
        for (const rsiOverbought of paramGrid.rsiOverbought) {
          for (const volThreshold of paramGrid.volThreshold) {
            for (const tpPercent of paramGrid.tpPercent) {
              for (const slPercent of paramGrid.slPercent) {
                tested++;
                
                const strategy: StrategyParams = {
                  rsiPeriod,
                  rsiOversold,
                  rsiOverbought,
                  macdFast: 12,
                  macdSlow: 26,
                  macdSignal: 9,
                  useVolatilityFilter: volThreshold > 0,
                  volThreshold,
                  tpPercent,
                  slPercent,
                };
                
                // Recalculate RSI if period changed
                let data = dataWithIndicators;
                if (rsiPeriod !== 14) {
                  data = rawData.map((c, i, arr) => {
                    const lookback = arr.slice(0, i + 1);
                    const closes = lookback.map(x => x.close);
                    return {
                      ...c,
                      rsi: calculateRSI(closes, rsiPeriod),
                      macd: calculateMACD(closes, 12, 26, 9),
                      ema200: calculateEMA(closes, 200),
                      atr: calculateATR(lookback, 14),
                      volScore: calculateVolatilityScore(lookback),
                    };
                  });
                }
                
                const backtest = fastBacktest(data, strategy);
                
                if (backtest.trades.length >= 10) { // Minimum 10 trades
                  const score = calculateScore({
                    ...backtest,
                    totalTrades: backtest.trades.length,
                  });
                  
                  results.push({
                    strategy,
                    winRate: backtest.winRate,
                    profitFactor: backtest.profitFactor,
                    sharpeRatio: backtest.sharpeRatio,
                    maxDrawdown: backtest.maxDrawdown,
                    totalReturn: backtest.totalReturn,
                    totalTrades: backtest.trades.length,
                    score,
                  });
                }
              }
            }
          }
        }
      }
    }
    
    // Sort by score (best first)
    results.sort((a, b) => b.score - a.score);
    
    // Get baseline (default params with vol filter)
    const baselineStrategy: StrategyParams = {
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
    const baseline = fastBacktest(dataWithIndicators, baselineStrategy);
    
    // Get baseline without vol filter
    const baselineNoVol = fastBacktest(dataWithIndicators, { ...baselineStrategy, useVolatilityFilter: false });
    
    console.log(`[Optimize] Tested ${tested} combinations, found ${results.length} valid strategies`);
    
    res.status(200).json({
      asset,
      period: `${start} to ${end}`,
      totalCombinations: tested,
      validStrategies: results.length,
      bestStrategy: results[0] || null,
      top10: results.slice(0, 10),
      baseline: {
        winRate: baseline.winRate,
        profitFactor: baseline.profitFactor,
        sharpeRatio: baseline.sharpeRatio,
        maxDrawdown: baseline.maxDrawdown,
        totalReturn: baseline.totalReturn,
      },
      improvement: results[0] ? {
        winRateDelta: parseFloat((results[0].winRate - baseline.winRate).toFixed(1)),
        vsNoVolFilter: parseFloat((results[0].winRate - baselineNoVol.winRate).toFixed(1)),
      } : null,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error('[Optimize] Error:', error);
    res.status(500).json({
      error: 'Optimization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
