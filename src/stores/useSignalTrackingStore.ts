/**
 * Vision AI Mind - Signal Tracking Store
 * 
 * Trackt historische Signale und deren Erfolgsrate.
 * Ermöglicht Machine-Learning-ähnliche Verbesserung der Signalqualität.
 * 
 * Features:
 * - Signal-Historie speichern (max 1000 pro Asset)
 * - Erfolgsrate nach Signal-Typ berechnen
 * - Win/Loss Ratio tracken
 * - Durchschnittliche P&L pro Signal
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// TYPES
// ============================================

export type SignalOutcome = 'pending' | 'win' | 'loss' | 'breakeven' | 'expired';

export interface TrackedSignal {
  id: string;
  assetId: string;
  symbol: string;
  timestamp: number;
  
  // Signal details
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  
  // Levels
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  
  // Source breakdown
  sources: {
    rsiScore: number;
    macdScore: number;
    confluenceScore: number;
    divergenceDetected: boolean;
    regime: string;
  };
  
  // Outcome (updated when resolved)
  outcome: SignalOutcome;
  exitPrice: number | null;
  exitTimestamp: number | null;
  pnlPercent: number | null;
  
  // Metadata
  timeframe: string;
  notes: string;
}

export interface AssetStats {
  totalSignals: number;
  wins: number;
  losses: number;
  breakeven: number;
  pending: number;
  expired: number;
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
  profitFactor: number; // Total wins / Total losses
  expectancy: number; // (WinRate * AvgWin) - (LossRate * AvgLoss)
}

export interface SignalTrackingState {
  // Signal storage
  signals: Record<string, TrackedSignal[]>; // assetId -> signals
  
  // Actions
  addSignal: (signal: Omit<TrackedSignal, 'id' | 'outcome' | 'exitPrice' | 'exitTimestamp' | 'pnlPercent'>) => string;
  updateSignalOutcome: (signalId: string, assetId: string, outcome: SignalOutcome, exitPrice: number) => void;
  expireOldSignals: (maxAgeMs: number) => void;
  
  // Queries
  getAssetStats: (assetId: string) => AssetStats;
  getRecentSignals: (assetId: string, limit?: number) => TrackedSignal[];
  getSignalById: (signalId: string, assetId: string) => TrackedSignal | null;
  
  // Analytics
  getWinRateByConfidence: (assetId: string) => { low: number; medium: number; high: number };
  getWinRateByRegime: (assetId: string) => Record<string, number>;
  getBestPerformingSetups: (assetId: string) => Array<{ setup: string; winRate: number; count: number }>;
  
  // Cleanup
  clearAssetHistory: (assetId: string) => void;
  clearAllHistory: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateSignalId = (): string => {
  return `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const calculateStats = (signals: TrackedSignal[]): AssetStats => {
  const resolved = signals.filter(s => s.outcome !== 'pending');
  const wins = signals.filter(s => s.outcome === 'win');
  const losses = signals.filter(s => s.outcome === 'loss');
  const breakeven = signals.filter(s => s.outcome === 'breakeven');
  const expired = signals.filter(s => s.outcome === 'expired');
  const pending = signals.filter(s => s.outcome === 'pending');
  
  const winRate = resolved.length > 0 ? wins.length / resolved.length : 0;
  
  const avgWinPercent = wins.length > 0
    ? wins.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / wins.length
    : 0;
  
  const avgLossPercent = losses.length > 0
    ? Math.abs(losses.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / losses.length)
    : 0;
  
  const totalWinAmount = wins.reduce((sum, s) => sum + (s.pnlPercent || 0), 0);
  const totalLossAmount = Math.abs(losses.reduce((sum, s) => sum + (s.pnlPercent || 0), 0));
  
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;
  const expectancy = (winRate * avgWinPercent) - ((1 - winRate) * avgLossPercent);
  
  return {
    totalSignals: signals.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    pending: pending.length,
    expired: expired.length,
    winRate,
    avgWinPercent,
    avgLossPercent,
    profitFactor,
    expectancy,
  };
};

// ============================================
// STORE
// ============================================

const MAX_SIGNALS_PER_ASSET = 1000;
const SIGNAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useSignalTrackingStore = create<SignalTrackingState>()(
  persist(
    (set, get) => ({
      signals: {},
      
      addSignal: (signalData) => {
        const id = generateSignalId();
        const signal: TrackedSignal = {
          ...signalData,
          id,
          outcome: 'pending',
          exitPrice: null,
          exitTimestamp: null,
          pnlPercent: null,
        };
        
        set((state) => {
          const assetSignals = state.signals[signalData.assetId] || [];
          
          // Limit signals per asset
          const updatedSignals = [signal, ...assetSignals].slice(0, MAX_SIGNALS_PER_ASSET);
          
          return {
            signals: {
              ...state.signals,
              [signalData.assetId]: updatedSignals,
            },
          };
        });
        
        return id;
      },
      
      updateSignalOutcome: (signalId, assetId, outcome, exitPrice) => {
        set((state) => {
          const assetSignals = state.signals[assetId] || [];
          const signalIndex = assetSignals.findIndex(s => s.id === signalId);
          
          if (signalIndex === -1) return state;
          
          const signal = assetSignals[signalIndex];
          const pnlPercent = signal.direction === 'BUY'
            ? ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100
            : signal.direction === 'SELL'
              ? ((signal.entryPrice - exitPrice) / signal.entryPrice) * 100
              : 0;
          
          const updatedSignal: TrackedSignal = {
            ...signal,
            outcome,
            exitPrice,
            exitTimestamp: Date.now(),
            pnlPercent,
          };
          
          const updatedSignals = [...assetSignals];
          updatedSignals[signalIndex] = updatedSignal;
          
          return {
            signals: {
              ...state.signals,
              [assetId]: updatedSignals,
            },
          };
        });
      },
      
      expireOldSignals: (maxAgeMs = SIGNAL_EXPIRY_MS) => {
        const now = Date.now();
        
        set((state) => {
          const updatedSignals: Record<string, TrackedSignal[]> = {};
          
          for (const [assetId, signals] of Object.entries(state.signals)) {
            updatedSignals[assetId] = signals.map(signal => {
              if (signal.outcome === 'pending' && now - signal.timestamp > maxAgeMs) {
                return { ...signal, outcome: 'expired' as SignalOutcome };
              }
              return signal;
            });
          }
          
          return { signals: updatedSignals };
        });
      },
      
      getAssetStats: (assetId) => {
        const signals = get().signals[assetId] || [];
        return calculateStats(signals);
      },
      
      getRecentSignals: (assetId, limit = 20) => {
        const signals = get().signals[assetId] || [];
        return signals.slice(0, limit);
      },
      
      getSignalById: (signalId, assetId) => {
        const signals = get().signals[assetId] || [];
        return signals.find(s => s.id === signalId) || null;
      },
      
      getWinRateByConfidence: (assetId) => {
        const signals = get().signals[assetId] || [];
        const resolved = signals.filter(s => s.outcome === 'win' || s.outcome === 'loss');
        
        const low = resolved.filter(s => s.confidence < 0.5);
        const medium = resolved.filter(s => s.confidence >= 0.5 && s.confidence < 0.75);
        const high = resolved.filter(s => s.confidence >= 0.75);
        
        return {
          low: low.length > 0 ? low.filter(s => s.outcome === 'win').length / low.length : 0,
          medium: medium.length > 0 ? medium.filter(s => s.outcome === 'win').length / medium.length : 0,
          high: high.length > 0 ? high.filter(s => s.outcome === 'win').length / high.length : 0,
        };
      },
      
      getWinRateByRegime: (assetId) => {
        const signals = get().signals[assetId] || [];
        const resolved = signals.filter(s => s.outcome === 'win' || s.outcome === 'loss');
        
        const regimes: Record<string, { wins: number; total: number }> = {};
        
        for (const signal of resolved) {
          const regime = signal.sources.regime || 'UNKNOWN';
          if (!regimes[regime]) {
            regimes[regime] = { wins: 0, total: 0 };
          }
          regimes[regime].total++;
          if (signal.outcome === 'win') {
            regimes[regime].wins++;
          }
        }
        
        const result: Record<string, number> = {};
        for (const [regime, stats] of Object.entries(regimes)) {
          result[regime] = stats.total > 0 ? stats.wins / stats.total : 0;
        }
        
        return result;
      },
      
      getBestPerformingSetups: (assetId) => {
        const signals = get().signals[assetId] || [];
        const resolved = signals.filter(s => s.outcome === 'win' || s.outcome === 'loss');
        
        // Group by setup characteristics
        const setups: Record<string, { wins: number; total: number }> = {};
        
        for (const signal of resolved) {
          // Create setup key from sources
          const setupKey = [
            signal.sources.divergenceDetected ? 'DIV' : '',
            signal.sources.confluenceScore >= 75 ? 'CONF' : '',
            signal.sources.rsiScore > 50 ? 'RSI+' : signal.sources.rsiScore < -50 ? 'RSI-' : '',
          ].filter(Boolean).join('_') || 'BASIC';
          
          if (!setups[setupKey]) {
            setups[setupKey] = { wins: 0, total: 0 };
          }
          setups[setupKey].total++;
          if (signal.outcome === 'win') {
            setups[setupKey].wins++;
          }
        }
        
        return Object.entries(setups)
          .map(([setup, stats]) => ({
            setup,
            winRate: stats.total > 0 ? stats.wins / stats.total : 0,
            count: stats.total,
          }))
          .sort((a, b) => b.winRate - a.winRate);
      },
      
      clearAssetHistory: (assetId) => {
        set((state) => {
          const { [assetId]: _, ...rest } = state.signals;
          return { signals: rest };
        });
      },
      
      clearAllHistory: () => {
        set({ signals: {} });
      },
    }),
    {
      name: 'vision-ai-signal-tracking',
      partialize: (state) => ({ signals: state.signals }),
    }
  )
);

export default useSignalTrackingStore;
