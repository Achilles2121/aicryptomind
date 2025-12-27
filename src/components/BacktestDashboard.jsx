/**
 * Backtest Dashboard Component
 * Vision AI Mind - VisionAIMnd
 * 
 * Interactive backtest UI with:
 * - Period selector (1m, 3m, 6m, 1y, 2y)
 * - Performance metrics cards
 * - Equity curve visualization
 * - Trade log
 * - Volatility filter comparison
 */

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  Activity, 
  TrendingUp, 
  BarChart2, 
  Target,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { 
  useBacktest, 
  useOptimize,
  formatMetrics, 
  getWinRateClass,
  getProfitFactorClass,
  calculateEquityCurve 
} from '../lib/backtestRunner';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

// ============ Sub-Components ============

function MetricCard({ label, value, icon: Icon, colorClass, subValue }) {
  return (
    <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
      </div>
      <div className={`text-xl font-bold ${colorClass || 'text-white'}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] text-slate-500 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}

MetricCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.elementType,
  colorClass: PropTypes.string,
  subValue: PropTypes.string,
};

function PeriodSelector({ period, onChange, disabled }) {
  const periods = [
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: '2y', label: '2Y' },
  ];

  return (
    <div className="flex gap-1">
      {periods.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          disabled={disabled}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
            period === p.value
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

PeriodSelector.propTypes = {
  period: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

function EquityCurve({ trades }) {
  const data = useMemo(() => calculateEquityCurve(trades), [trades]);
  
  if (data.length < 2) return null;

  const isPositive = data[data.length - 1].equity >= 100;
  const gradientColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis domain={['auto', 'auto']} hide />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: '11px'
            }}
            formatter={(value) => [`${value.toFixed(1)}%`, 'Equity']}
          />
          <ReferenceLine y={100} stroke="#64748b" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={gradientColor}
            strokeWidth={2}
            fill="url(#equityGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

EquityCurve.propTypes = {
  trades: PropTypes.array.isRequired,
};

function ComparisonCard({ comparison, lang }) {
  if (!comparison) return null;

  const improvement = comparison.improvement;
  const isPositive = improvement > 0;

  return (
    <div className={`rounded-lg p-3 border ${
      isPositive 
        ? 'bg-emerald-500/10 border-emerald-500/30' 
        : 'bg-amber-500/10 border-amber-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className={`w-4 h-4 ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`} />
        <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
          {lang === 'de' ? 'Volatilitäts-Filter Impact' : 'Volatility Filter Impact'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-400 mb-0.5">
            {lang === 'de' ? 'Mit Filter' : 'With Filter'}
          </div>
          <div className="font-bold text-emerald-400">{comparison.withVolFilter.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-slate-400 mb-0.5">
            {lang === 'de' ? 'Ohne Filter' : 'Without Filter'}
          </div>
          <div className="font-bold text-slate-300">{comparison.withoutVolFilter.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-slate-400 mb-0.5">
            {lang === 'de' ? 'Verbesserung' : 'Improvement'}
          </div>
          <div className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isPositive ? '+' : ''}{improvement.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

ComparisonCard.propTypes = {
  comparison: PropTypes.object,
  lang: PropTypes.string,
};

function TradeLog({ trades, lang }) {
  const [expanded, setExpanded] = useState(false);
  const displayTrades = expanded ? trades.slice(0, 20) : trades.slice(0, 5);

  if (!trades || trades.length === 0) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition-colors mb-2"
      >
        <span>{lang === 'de' ? 'Trade-Log' : 'Trade Log'} ({trades.length})</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      
      {expanded && (
        <div className="bg-slate-900/50 rounded-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-800/50 sticky top-0">
                <tr className="text-slate-400">
                  <th className="px-2 py-1.5 text-left">Date</th>
                  <th className="px-2 py-1.5 text-left">Dir</th>
                  <th className="px-2 py-1.5 text-right">PnL</th>
                  <th className="px-2 py-1.5 text-left">Exit</th>
                </tr>
              </thead>
              <tbody>
                {displayTrades.map((trade, i) => (
                  <tr key={trade.id || i} className="border-t border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-2 py-1.5 text-slate-300">
                      {new Date(trade.exitDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        trade.direction === 'LONG' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className={`px-2 py-1.5 text-right font-medium ${
                      trade.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">
                      {trade.exitReason === 'TP_HIT' ? '🎯' : trade.exitReason === 'SL_HIT' ? '🛑' : '↩️'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

TradeLog.propTypes = {
  trades: PropTypes.array,
  lang: PropTypes.string,
};

// ============ Main Component ============

export default function BacktestDashboard({ asset, lang = 'de' }) {
  const [period, setPeriod] = useState('6m');
  const { result, isRunning, error, runBacktest } = useBacktest(asset);
  const { result: optimizeResult, isRunning: isOptimizing, runOptimization } = useOptimize(asset);
  const [showOptimize, setShowOptimize] = useState(false);

  const metrics = useMemo(() => formatMetrics(result), [result]);

  const handleRunBacktest = () => {
    runBacktest(period);
  };

  const handleOptimize = () => {
    setShowOptimize(true);
    runOptimization(period, true); // Quick mode
  };

  const getColorClass = (type, value) => {
    if (type === 'winRate') {
      const cls = getWinRateClass(value);
      return cls === 'excellent' ? 'text-emerald-400' 
        : cls === 'good' ? 'text-green-400'
        : cls === 'average' ? 'text-amber-400' 
        : 'text-red-400';
    }
    if (type === 'profitFactor') {
      const cls = getProfitFactorClass(value);
      return cls === 'excellent' ? 'text-emerald-400'
        : cls === 'good' ? 'text-green-400'
        : cls === 'average' ? 'text-amber-400'
        : 'text-red-400';
    }
    if (type === 'return') {
      return value >= 0 ? 'text-emerald-400' : 'text-red-400';
    }
    if (type === 'drawdown') {
      return Math.abs(value) < 15 ? 'text-emerald-400'
        : Math.abs(value) < 25 ? 'text-amber-400'
        : 'text-red-400';
    }
    return 'text-white';
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-semibold text-white">
            {lang === 'de' ? 'Strategie Backtest' : 'Strategy Backtest'}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          <PeriodSelector 
            period={period} 
            onChange={setPeriod} 
            disabled={isRunning}
          />
          
          <button
            onClick={handleRunBacktest}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning 
              ? (lang === 'de' ? 'Läuft...' : 'Running...') 
              : (lang === 'de' ? 'Testen' : 'Run Test')}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* No Data State */}
      {!result && !isRunning && !error && (
        <div className="text-center py-8">
          <BarChart2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 mb-2">
            {lang === 'de' 
              ? 'Klicke "Testen" um die Strategie gegen historische Daten zu testen'
              : 'Click "Run Test" to backtest strategy against historical data'}
          </p>
          <p className="text-xs text-slate-500">
            {lang === 'de'
              ? 'Testet die aktuelle Strategie über den ausgewählten Zeitraum'
              : 'Tests the current strategy over the selected period'}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isRunning && !result && (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 text-cyan-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-slate-400">
            {lang === 'de' ? 'Backtest läuft...' : 'Running backtest...'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'de' ? 'Analysiere historische Daten' : 'Analyzing historical data'}
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <MetricCard
              label="Win Rate"
              value={metrics?.winRate || '-'}
              icon={Target}
              colorClass={getColorClass('winRate', result.winRate)}
              subValue={`${result.winningTrades}/${result.totalTrades} Trades`}
            />
            <MetricCard
              label="Profit Factor"
              value={metrics?.profitFactor || '-'}
              icon={TrendingUp}
              colorClass={getColorClass('profitFactor', result.profitFactor)}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={metrics?.sharpeRatio || '-'}
              icon={Activity}
              colorClass={result.sharpeRatio >= 1 ? 'text-emerald-400' : result.sharpeRatio >= 0.5 ? 'text-amber-400' : 'text-red-400'}
            />
            <MetricCard
              label="Max Drawdown"
              value={metrics?.maxDrawdown || '-'}
              icon={Shield}
              colorClass={getColorClass('drawdown', result.maxDrawdown)}
            />
          </div>

          {/* Return & Avg Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-900/50 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-400 mb-0.5">
                {lang === 'de' ? 'Gesamtrendite' : 'Total Return'}
              </div>
              <div className={`text-lg font-bold ${getColorClass('return', result.totalReturn)}`}>
                {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(1)}%
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-400 mb-0.5">
                {lang === 'de' ? 'Ø Gewinn' : 'Avg Win'}
              </div>
              <div className="text-lg font-bold text-emerald-400">
                +{result.avgWin.toFixed(2)}%
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2.5 text-center">
              <div className="text-[10px] text-slate-400 mb-0.5">
                {lang === 'de' ? 'Ø Verlust' : 'Avg Loss'}
              </div>
              <div className="text-lg font-bold text-red-400">
                -{result.avgLoss.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Equity Curve */}
          {result.tradeLog && result.tradeLog.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-slate-400 mb-2">
                {lang === 'de' ? 'Equity-Kurve' : 'Equity Curve'}
              </div>
              <EquityCurve trades={result.tradeLog} />
            </div>
          )}

          {/* Vol Filter Comparison */}
          <ComparisonCard comparison={result.comparison} lang={lang} />

          {/* Trade Log */}
          <TradeLog trades={result.tradeLog} lang={lang} />

          {/* Optimize Button */}
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            <button
              onClick={handleOptimize}
              disabled={isOptimizing}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                isOptimizing
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-pulse' : ''}`} />
              {isOptimizing 
                ? (lang === 'de' ? 'Optimiere Parameter...' : 'Optimizing parameters...') 
                : (lang === 'de' ? '🔬 Strategie optimieren (Grid Search)' : '🔬 Optimize Strategy (Grid Search)')}
            </button>

            {/* Optimization Results */}
            {showOptimize && optimizeResult && (
              <div className="mt-3 bg-slate-900/70 rounded-lg p-3 border border-cyan-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-cyan-400">
                    {lang === 'de' ? 'Optimierungs-Ergebnis' : 'Optimization Result'}
                  </span>
                </div>
                
                {optimizeResult.bestStrategy && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        {lang === 'de' ? 'Beste Win-Rate:' : 'Best Win-Rate:'}
                      </span>
                      <span className="font-bold text-emerald-400">
                        {optimizeResult.bestStrategy.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        {lang === 'de' ? 'vs Baseline:' : 'vs Baseline:'}
                      </span>
                      <span className={`font-bold ${optimizeResult.improvement?.winRateDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {optimizeResult.improvement?.winRateDelta >= 0 ? '+' : ''}
                        {optimizeResult.improvement?.winRateDelta.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2">
                      {lang === 'de' 
                        ? `${optimizeResult.totalCombinations} Kombinationen getestet`
                        : `${optimizeResult.totalCombinations} combinations tested`}
                    </div>
                    
                    {/* Best Strategy Params */}
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      <div className="text-[10px] text-slate-400 mb-1">
                        {lang === 'de' ? 'Beste Parameter:' : 'Best Parameters:'}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px] text-slate-300">
                          RSI {optimizeResult.bestStrategy.strategy.rsiOversold}/{optimizeResult.bestStrategy.strategy.rsiOverbought}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px] text-slate-300">
                          Vol {optimizeResult.bestStrategy.strategy.volThreshold || 'OFF'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px] text-slate-300">
                          TP {optimizeResult.bestStrategy.strategy.tpPercent}%
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px] text-slate-300">
                          SL {optimizeResult.bestStrategy.strategy.slPercent}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

BacktestDashboard.propTypes = {
  asset: PropTypes.string.isRequired,
  lang: PropTypes.string,
};
