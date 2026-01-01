/**
 * Vision AI Mind - Enhanced Signal Display
 * 
 * Kombiniert alle Signal-Engines:
 * - 8-Punkte Algorithmus
 * - Multi-Timeframe Confluence
 * - Divergenz-Erkennung
 * - Regime-basierte Parameter
 * - Signal-Tracking mit Erfolgsrate
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Zap,
  BarChart3,
  Clock,
  Activity,
  Layers,
  GitBranch
} from 'lucide-react';
import { safeFixed } from '../lib/safeFixed';

// ============================================
// SUB-COMPONENTS
// ============================================

const SignalStrengthBar = ({ score, maxScore = 8, label }) => {
  const percentage = Math.min(100, (score / maxScore) * 100);
  const getColor = () => {
    if (percentage >= 75) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-amber-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-slate-200">{score}/{maxScore}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

SignalStrengthBar.propTypes = {
  score: PropTypes.number.isRequired,
  maxScore: PropTypes.number,
  label: PropTypes.string.isRequired,
};

const TimeframeIndicator = ({ timeframe, signal, isAligned }) => {
  const getSignalColor = () => {
    if (!signal) return 'bg-slate-700 text-slate-400';
    if (signal === 'BUY') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (signal === 'SELL') return 'bg-red-500/20 text-red-300 border-red-500/40';
    return 'bg-slate-700 text-slate-300';
  };

  const getIcon = () => {
    if (!signal) return null;
    if (signal === 'BUY') return <TrendingUp className="h-3 w-3" />;
    if (signal === 'SELL') return <TrendingDown className="h-3 w-3" />;
    return null;
  };

  return (
    <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${getSignalColor()} ${isAligned ? 'ring-1 ring-yellow-500/50' : ''}`}>
      {getIcon()}
      <span className="font-semibold">{timeframe}</span>
    </div>
  );
};

TimeframeIndicator.propTypes = {
  timeframe: PropTypes.string.isRequired,
  signal: PropTypes.string,
  isAligned: PropTypes.bool,
};

const DivergenceAlert = ({ type, confidence, advice }) => {
  const isBullish = type?.includes('bullish');
  const isHidden = type?.includes('hidden');

  if (!type) return null;

  return (
    <div className={`rounded-xl p-3 border ${
      isBullish 
        ? 'bg-emerald-500/10 border-emerald-500/30' 
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center gap-2">
        <GitBranch className={`h-4 w-4 ${isBullish ? 'text-emerald-400' : 'text-red-400'}`} />
        <span className={`text-sm font-semibold ${isBullish ? 'text-emerald-300' : 'text-red-300'}`}>
          {isHidden ? 'Hidden' : 'Regular'} {isBullish ? 'Bullish' : 'Bearish'} Divergence
        </span>
        <span className="ml-auto text-xs text-slate-400">{confidence}%</span>
      </div>
      {advice && (
        <p className="mt-2 text-xs text-slate-300">{advice}</p>
      )}
    </div>
  );
};

DivergenceAlert.propTypes = {
  type: PropTypes.string,
  confidence: PropTypes.number,
  advice: PropTypes.string,
};

const RegimeBadge = ({ regime, modifier }) => {
  const getRegimeStyle = () => {
    switch (regime) {
      case 'BULL_TREND':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'BEAR_TREND':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'HIGH_VOLATILITY':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'CONSOLIDATION':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'RANGE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getRegimeIcon = () => {
    switch (regime) {
      case 'BULL_TREND':
        return <TrendingUp className="h-3 w-3" />;
      case 'BEAR_TREND':
        return <TrendingDown className="h-3 w-3" />;
      case 'HIGH_VOLATILITY':
        return <Zap className="h-3 w-3" />;
      case 'CONSOLIDATION':
      case 'RANGE':
        return <BarChart3 className="h-3 w-3" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  const formatRegime = (r) => {
    if (!r) return 'NEUTRAL';
    return r.replace('_', ' ');
  };

  return (
    <div className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${getRegimeStyle()}`}>
      {getRegimeIcon()}
      <span className="font-semibold">{formatRegime(regime)}</span>
      {modifier && (
        <span className="text-[10px] opacity-70">×{safeFixed(modifier, 2)}</span>
      )}
    </div>
  );
};

RegimeBadge.propTypes = {
  regime: PropTypes.string,
  modifier: PropTypes.number,
};

const ConfluenceScore = ({ score, strength, alignedCount, totalTf = 4 }) => {
  const getStrengthColor = () => {
    switch (strength) {
      case 'ULTRA':
        return 'text-yellow-300';
      case 'STRONG':
        return 'text-emerald-300';
      case 'MODERATE':
        return 'text-blue-300';
      case 'WEAK':
        return 'text-slate-400';
      case 'CONFLICTING':
        return 'text-orange-300';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-slate-400" />
        <span className="text-xs text-slate-400">Confluence</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${getStrengthColor()}`}>
          {strength || 'N/A'}
        </span>
        <span className="text-xs text-slate-500">
          ({alignedCount}/{totalTf} TF)
        </span>
        <span className="text-xs font-semibold text-slate-300">
          {safeFixed(score, 0)}%
        </span>
      </div>
    </div>
  );
};

ConfluenceScore.propTypes = {
  score: PropTypes.number,
  strength: PropTypes.string,
  alignedCount: PropTypes.number,
  totalTf: PropTypes.number,
};

const TrackingStats = ({ stats }) => {
  if (!stats || stats.totalSignals === 0) {
    return (
      <div className="text-xs text-slate-500 text-center py-2">
        Noch keine Signal-Historie verfügbar
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg bg-slate-800/60 p-2">
        <div className="text-lg font-bold text-emerald-300">
          {safeFixed(stats.winRate * 100, 0)}%
        </div>
        <div className="text-[10px] text-slate-500">Win Rate</div>
      </div>
      <div className="rounded-lg bg-slate-800/60 p-2">
        <div className="text-lg font-bold text-slate-200">
          {stats.wins}/{stats.losses}
        </div>
        <div className="text-[10px] text-slate-500">W/L</div>
      </div>
      <div className="rounded-lg bg-slate-800/60 p-2">
        <div className={`text-lg font-bold ${stats.profitFactor >= 1.5 ? 'text-emerald-300' : stats.profitFactor >= 1 ? 'text-amber-300' : 'text-red-300'}`}>
          {stats.profitFactor === Infinity ? '∞' : safeFixed(stats.profitFactor, 2)}
        </div>
        <div className="text-[10px] text-slate-500">Profit Factor</div>
      </div>
    </div>
  );
};

TrackingStats.propTypes = {
  stats: PropTypes.object,
};

// ============================================
// MAIN COMPONENT
// ============================================

function EnhancedSignalDisplay({
  assetId,
  signal,
  confluence,
  divergence,
  regime,
  stats,
  lang = 'en',
  formatUSD,
  Card,
}) {
  const isGerman = lang === 'de';

  // Combine all scores into a master confidence
  const masterConfidence = useMemo(() => {
    let score = 0;
    let weights = 0;

    // 8-Point Score (weight: 3)
    if (signal?.score != null) {
      score += (signal.score / 8) * 100 * 3;
      weights += 3;
    }

    // Confluence (weight: 2)
    if (confluence?.score != null) {
      score += confluence.score * 2;
      weights += 2;
    }

    // Divergence (weight: 1.5 if present)
    if (divergence?.hasDivergence) {
      // Bonus for divergence alignment
      const divergenceBonus = divergence.combinedScore * 1.5;
      score += divergenceBonus;
      weights += 1.5;
    }

    return weights > 0 ? score / weights : 0;
  }, [signal, confluence, divergence]);

  // Determine final recommendation
  const recommendation = useMemo(() => {
    // If divergence conflicts with signal, reduce confidence
    const signalDir = signal?.direction || 'HOLD';
    const divergenceDir = divergence?.signal?.direction || 'NONE';
    
    if (divergenceDir !== 'NONE' && divergenceDir !== signalDir.replace('SELL', 'BEARISH').replace('BUY', 'BULLISH')) {
      return {
        action: 'CAUTION',
        label: isGerman ? '⚠️ VORSICHT' : '⚠️ CAUTION',
        reason: isGerman 
          ? 'Divergenz widerspricht Signal - warten auf Bestätigung' 
          : 'Divergence conflicts with signal - wait for confirmation',
        color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      };
    }

    if (masterConfidence >= 75 && signalDir !== 'HOLD') {
      return {
        action: signalDir,
        label: signalDir === 'BUY' 
          ? (isGerman ? '🟢 STARKES LONG' : '🟢 STRONG BUY')
          : (isGerman ? '🔴 STARKES SHORT' : '🔴 STRONG SELL'),
        reason: isGerman ? 'Hohe Konfluenz über alle Indikatoren' : 'High confluence across all indicators',
        color: signalDir === 'BUY' 
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          : 'bg-red-500/20 text-red-300 border-red-500/40',
      };
    }

    if (masterConfidence >= 50 && signalDir !== 'HOLD') {
      return {
        action: signalDir,
        label: signalDir === 'BUY'
          ? (isGerman ? '📈 LONG' : '📈 BUY')
          : (isGerman ? '📉 SHORT' : '📉 SELL'),
        reason: isGerman ? 'Moderate Signalstärke' : 'Moderate signal strength',
        color: signalDir === 'BUY'
          ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30'
          : 'bg-red-500/10 text-red-200 border-red-500/30',
      };
    }

    return {
      action: 'HOLD',
      label: isGerman ? '⏳ WARTEN' : '⏳ WAIT',
      reason: isGerman ? 'Keine klaren Signale - Geduld bewahren' : 'No clear signals - remain patient',
      color: 'bg-slate-700 text-slate-300 border-slate-600',
    };
  }, [signal, divergence, masterConfidence, isGerman]);

  return (
    <Card 
      title={isGerman ? 'Vision AI Signal Engine' : 'Vision AI Signal Engine'} 
      icon={Target}
    >
      <div className="space-y-4">
        {/* Main Recommendation */}
        <div className="text-center">
          <div className={`inline-block rounded-xl border px-6 py-3 ${recommendation.color}`}>
            <div className="text-xl font-bold">{recommendation.label}</div>
            <div className="text-xs opacity-80 mt-1">{recommendation.reason}</div>
          </div>
        </div>

        {/* Master Confidence */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">
              {isGerman ? 'Gesamt-Konfidenz' : 'Master Confidence'}
            </span>
            <span className={`font-bold ${
              masterConfidence >= 75 ? 'text-emerald-300' :
              masterConfidence >= 50 ? 'text-amber-300' : 'text-slate-400'
            }`}>
              {safeFixed(masterConfidence, 0)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                masterConfidence >= 75 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' :
                masterConfidence >= 50 ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                'bg-gradient-to-r from-slate-600 to-slate-500'
              }`}
              style={{ width: `${Math.min(100, masterConfidence)}%` }}
            />
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="rounded-xl bg-slate-800/60 p-3 space-y-3">
          <SignalStrengthBar 
            score={signal?.score || 0} 
            maxScore={8} 
            label={isGerman ? '8-Punkte Algorithmus' : '8-Point Algorithm'} 
          />
          
          <ConfluenceScore 
            score={confluence?.score || 0}
            strength={confluence?.strength}
            alignedCount={confluence?.alignedTimeframes?.length || 0}
          />

          {/* Regime */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {isGerman ? 'Marktregime' : 'Market Regime'}
            </span>
            <RegimeBadge 
              regime={regime?.type} 
              modifier={regime?.modifier} 
            />
          </div>
        </div>

        {/* Timeframe Alignment */}
        {confluence?.timeframes && (
          <div className="rounded-xl bg-slate-800/60 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-400">
                {isGerman ? 'Timeframe-Ausrichtung' : 'Timeframe Alignment'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {confluence.timeframes.map((tf) => (
                <TimeframeIndicator 
                  key={tf.period}
                  timeframe={tf.period}
                  signal={tf.direction}
                  isAligned={confluence.alignedTimeframes?.includes(tf.period)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Divergence Alert */}
        {divergence?.hasDivergence && (
          <DivergenceAlert 
            type={divergence.signal?.type}
            confidence={divergence.combinedScore}
            advice={divergence.signal?.tradingAdvice}
          />
        )}

        {/* TP/SL Levels */}
        {(signal?.tp || signal?.sl) && (
          <div className="grid grid-cols-2 gap-2">
            {signal.tp && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-emerald-400 mb-1">Take Profit</div>
                <div className="text-lg font-bold text-emerald-300">
                  {formatUSD ? formatUSD(signal.tp) : `$${safeFixed(signal.tp, 2)}`}
                </div>
              </div>
            )}
            {signal.sl && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-red-400 mb-1">Stop Loss</div>
                <div className="text-lg font-bold text-red-300">
                  {formatUSD ? formatUSD(signal.sl) : `$${safeFixed(signal.sl, 2)}`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signal Tracking Stats */}
        {stats && (
          <div className="rounded-xl bg-slate-800/60 p-3">
            <div className="text-xs text-slate-400 mb-2">
              {isGerman ? 'Historische Performance' : 'Historical Performance'}
            </div>
            <TrackingStats stats={stats} />
          </div>
        )}
      </div>
    </Card>
  );
}

EnhancedSignalDisplay.propTypes = {
  assetId: PropTypes.string,
  signal: PropTypes.shape({
    direction: PropTypes.string,
    score: PropTypes.number,
    confidence: PropTypes.number,
    tp: PropTypes.number,
    sl: PropTypes.number,
  }),
  confluence: PropTypes.shape({
    score: PropTypes.number,
    strength: PropTypes.string,
    direction: PropTypes.string,
    alignedTimeframes: PropTypes.arrayOf(PropTypes.string),
    timeframes: PropTypes.array,
  }),
  divergence: PropTypes.shape({
    hasDivergence: PropTypes.bool,
    combinedScore: PropTypes.number,
    signal: PropTypes.object,
  }),
  regime: PropTypes.shape({
    type: PropTypes.string,
    modifier: PropTypes.number,
  }),
  stats: PropTypes.object,
  lang: PropTypes.string,
  formatUSD: PropTypes.func,
  Card: PropTypes.elementType.isRequired,
};

export default EnhancedSignalDisplay;
