/**
 * Backtest Runner - React Hook
 * Vision AI Mind - Elite Trader
 * 
 * Client-side hook for running backtests with caching
 * and historical result comparison.
 */

import { useState, useCallback, useMemo } from 'react';

// ============ Types ============

export interface StrategyParams {
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

export interface Trade {
  id: number;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  direction: 'LONG' | 'SHORT';
  pnlPercent: number;
  exitReason: 'TP_HIT' | 'SL_HIT' | 'SIGNAL_REVERSE' | 'END_OF_DATA';
  holdingPeriod: number;
}

export interface BacktestResult {
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

export interface OptimizationResult {
  asset: string;
  period: string;
  totalCombinations: number;
  validStrategies: number;
  bestStrategy: {
    strategy: StrategyParams;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalReturn: number;
    totalTrades: number;
    score: number;
  } | null;
  top10: any[];
  baseline: {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    totalReturn: number;
  };
  improvement: {
    winRateDelta: number;
    vsNoVolFilter: number;
  } | null;
  timestamp: number;
}

// ============ Constants ============

const DEFAULT_STRATEGY: StrategyParams = {
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

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// ============ Helper Functions ============

function getPeriodDays(period: string): number {
  const map: Record<string, number> = {
    '1m': 30,
    '3m': 90,
    '6m': 180,
    '1y': 365,
    '2y': 730,
  };
  return map[period] || 180;
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const endDate = new Date().toISOString().split('T')[0];
  const days = getPeriodDays(period);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { startDate, endDate };
}

function getCacheKey(asset: string, period: string, type: 'backtest' | 'optimize'): string {
  return `${type}_${asset}_${period}`;
}

function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data as T;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    // localStorage full or disabled
    console.warn('Cache write failed:', e);
  }
}

// ============ Hooks ============

/**
 * Hook for running strategy backtests
 */
export function useBacktest(asset: string) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = useCallback(async (
    period: string = '6m',
    strategy?: Partial<StrategyParams>,
    interval: string = '1h'
  ) => {
    setIsRunning(true);
    setError(null);

    // Check cache first
    const cacheKey = getCacheKey(asset, period, 'backtest');
    const cached = getFromCache<BacktestResult>(cacheKey);
    if (cached && !strategy) {
      setResult(cached);
      setIsRunning(false);
      return cached;
    }

    try {
      const { startDate, endDate } = getDateRange(period);
      
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          startDate,
          endDate,
          strategy: { ...DEFAULT_STRATEGY, ...strategy },
          interval,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Backtest failed: ${response.status}`);
      }

      const data: BacktestResult = await response.json();
      setResult(data);

      // Cache result (only if using default strategy)
      if (!strategy) {
        setCache(cacheKey, data);
      }

      // Also store in history for comparison
      storeBacktestHistory(asset, data);

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Backtest error:', err);
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [asset]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isRunning, error, runBacktest, clearResult };
}

/**
 * Hook for running strategy optimization
 * Note: Grid Search requires Pro plan - returns friendly message on Hobby
 */
export function useOptimize(_asset: string) {
  const [result] = useState<OptimizationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runOptimization = useCallback(async (
    _period: string = '6m',
    _quickMode: boolean = true
  ) => {
    setIsRunning(true);
    setError(null);

    // Grid Search Optimizer requires Pro plan
    // Show friendly message instead of calling disabled API
    setTimeout(() => {
      setError('Grid Search Optimizer requires Pro plan. Backtest data shows current strategy performance.');
      setIsRunning(false);
    }, 500);

    return null;
  }, []);

  return { result, isRunning, error, runOptimization };
}

/**
 * Hook for accessing backtest history
 */
export function useBacktestHistory(asset: string) {
  const history = useMemo(() => {
    return getBacktestHistory(asset);
  }, [asset]);

  const latestWinRate = useMemo(() => {
    if (history.length === 0) return null;
    return history[0].winRate;
  }, [history]);

  const averageWinRate = useMemo(() => {
    if (history.length === 0) return null;
    const sum = history.reduce((acc, h) => acc + h.winRate, 0);
    return parseFloat((sum / history.length).toFixed(1));
  }, [history]);

  return { history, latestWinRate, averageWinRate };
}

// ============ Storage Functions ============

function storeBacktestHistory(asset: string, result: BacktestResult): void {
  try {
    const key = `backtest_history_${asset}`;
    const existing = localStorage.getItem(key);
    const history = existing ? JSON.parse(existing) : [];
    
    // Add new result to beginning
    history.unshift({
      winRate: result.winRate,
      profitFactor: result.profitFactor,
      totalTrades: result.totalTrades,
      period: result.period,
      timestamp: result.timestamp,
    });
    
    // Keep only last 10 entries
    if (history.length > 10) {
      history.splice(10);
    }
    
    localStorage.setItem(key, JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
}

function getBacktestHistory(asset: string): Array<{
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  period: string;
  timestamp: number;
}> {
  try {
    const key = `backtest_history_${asset}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// ============ Utility Functions ============

/**
 * Format backtest metrics for display
 */
export function formatMetrics(result: BacktestResult | null) {
  if (!result) return null;
  
  return {
    winRate: `${result.winRate.toFixed(1)}%`,
    profitFactor: result.profitFactor.toFixed(2),
    sharpeRatio: result.sharpeRatio.toFixed(2),
    maxDrawdown: `${result.maxDrawdown.toFixed(1)}%`,
    totalReturn: `${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(1)}%`,
    totalTrades: result.totalTrades.toString(),
    avgWin: `+${result.avgWin.toFixed(2)}%`,
    avgLoss: `-${result.avgLoss.toFixed(2)}%`,
    avgHoldingPeriod: result.avgHoldingPeriod,
  };
}

/**
 * Get win rate classification
 */
export function getWinRateClass(winRate: number): 'excellent' | 'good' | 'average' | 'poor' {
  if (winRate >= 65) return 'excellent';
  if (winRate >= 55) return 'good';
  if (winRate >= 45) return 'average';
  return 'poor';
}

/**
 * Get profit factor classification
 */
export function getProfitFactorClass(pf: number): 'excellent' | 'good' | 'average' | 'poor' {
  if (pf >= 2.0) return 'excellent';
  if (pf >= 1.5) return 'good';
  if (pf >= 1.0) return 'average';
  return 'poor';
}

/**
 * Calculate equity curve from trades
 */
export function calculateEquityCurve(trades: Trade[]): { date: string; equity: number }[] {
  let equity = 100; // Start with 100%
  const curve = [{ date: 'Start', equity }];
  
  for (const trade of trades) {
    equity += trade.pnlPercent;
    curve.push({
      date: trade.exitDate.split('T')[0],
      equity: parseFloat(equity.toFixed(2)),
    });
  }
  
  return curve;
}
