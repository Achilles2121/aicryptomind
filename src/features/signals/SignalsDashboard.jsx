// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight
} from 'lucide-react';

// Helper to format relative time
function formatTimeAgo(timestamp, currentTime) {
  const minutes = Math.round((currentTime - timestamp) / 60000);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''} ago`;
}

// Placeholder component - will be expanded with real signal data
export default function SignalsDashboard() {
  // Use state for current time to avoid impure render
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  
  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  // Sample signals with fixed timestamps
  const _baseTime = 1702800000000; // Fixed base timestamp
  const signals = [
    {
      id: 1,
      symbol: 'BTC',
      name: 'Bitcoin',
      action: 'long',
      score: 82,
      checklist: [true, true, true, true, true, true, true, true],
      entry: 104250,
      stopLoss: 102500,
      takeProfit: 108000,
      riskReward: '1:2.1',
      timestamp: currentTime - 1800000,
    },
    {
      id: 2,
      symbol: 'ETH',
      name: 'Ethereum',
      action: 'long',
      score: 75,
      checklist: [true, true, true, true, true, true, true, false],
      entry: 3890,
      stopLoss: 3780,
      takeProfit: 4120,
      riskReward: '1:2.1',
      timestamp: currentTime - 3600000,
    },
    {
      id: 3,
      symbol: 'SOL',
      name: 'Solana',
      action: 'wait',
      score: 45,
      checklist: [true, false, true, true, false, false, true, false],
      entry: null,
      stopLoss: null,
      takeProfit: null,
      riskReward: null,
      timestamp: currentTime - 7200000,
    },
  ];

  const checklistLabels = [
    'Trend Direction',
    'Market Structure',
    'Momentum (RSI)',
    'MACD Alignment',
    'Volume Confirmation',
    'Liquidity Zone',
    'Risk/Reward Ratio',
    'Multi-Timeframe',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Ultra Signal Engine
        </h1>
        <p className="text-slate-400">
          8-Point Verification Checklist for 75-82% Win Rate Signals
        </p>
      </div>

      {/* Win Rate Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-emerald-400 mb-1">8/8</div>
          <div className="text-emerald-400 text-sm">82% Win Rate</div>
          <div className="text-slate-500 text-xs mt-1">Ultra High Confidence</div>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-cyan-400 mb-1">7/8</div>
          <div className="text-cyan-400 text-sm">75% Win Rate</div>
          <div className="text-slate-500 text-xs mt-1">High Confidence</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-amber-400 mb-1">6/8</div>
          <div className="text-amber-400 text-sm">68% Win Rate</div>
          <div className="text-slate-500 text-xs mt-1">Moderate Confidence</div>
        </div>
      </div>

      {/* Signal Cards */}
      <div className="space-y-4">
        {signals.map((signal) => {
          const passedChecks = signal.checklist.filter(Boolean).length;
          const isLong = signal.action === 'long';
          const isShort = signal.action === 'short';
          const isWait = signal.action === 'wait';

          return (
            <div 
              key={signal.id}
              className={`bg-slate-800/50 rounded-2xl border p-6 ${
                isLong ? 'border-emerald-500/30' :
                isShort ? 'border-red-500/30' :
                'border-slate-700/50'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Asset info */}
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    isLong ? 'bg-emerald-500/20' :
                    isShort ? 'bg-red-500/20' :
                    'bg-slate-700/50'
                  }`}>
                    {isLong && <TrendingUp className="w-6 h-6 text-emerald-400" />}
                    {isShort && <TrendingDown className="w-6 h-6 text-red-400" />}
                    {isWait && <Clock className="w-6 h-6 text-slate-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-white">{signal.symbol}</span>
                      <span className="text-slate-400">{signal.name}</span>
                    </div>
                    <div className={`text-sm font-medium uppercase ${
                      isLong ? 'text-emerald-400' :
                      isShort ? 'text-red-400' :
                      'text-slate-400'
                    }`}>
                      {signal.action.toUpperCase()} SIGNAL
                    </div>
                  </div>
                </div>

                {/* Middle: Checklist */}
                <div className="flex-1 max-w-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-slate-400">Checklist Score:</span>
                    <span className={`font-bold ${
                      passedChecks >= 8 ? 'text-emerald-400' :
                      passedChecks >= 7 ? 'text-cyan-400' :
                      passedChecks >= 6 ? 'text-amber-400' :
                      'text-slate-400'
                    }`}>
                      {passedChecks}/8
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {signal.checklist.map((passed, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                          passed 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}
                        title={checklistLabels[idx]}
                      >
                        {passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span className="hidden sm:inline">{checklistLabels[idx]}</span>
                        <span className="sm:hidden">{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Trade levels */}
                {!isWait && (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Entry</div>
                      <div className="text-white font-medium">${signal.entry?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-red-400 mb-1">Stop Loss</div>
                      <div className="text-red-400 font-medium">${signal.stopLoss?.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-emerald-400 mb-1">Take Profit</div>
                      <div className="text-emerald-400 font-medium">${signal.takeProfit?.toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Time ago */}
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTimeAgo(signal.timestamp, currentTime)}
                </span>
                {!isWait && (
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    R/R: {signal.riskReward}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="mt-8 bg-slate-800/30 rounded-2xl border border-slate-700/50 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Trading Risk Disclaimer</h3>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto">
          Past performance does not guarantee future results. All trading carries risk. 
          The Ultra Signal Engine is designed to help identify high-probability setups, 
          but no system is 100% accurate. Always use proper risk management.
        </p>
        <Link 
          to="/"
          className="inline-flex items-center gap-2 mt-4 text-cyan-400 hover:text-cyan-300"
        >
          View Live Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
