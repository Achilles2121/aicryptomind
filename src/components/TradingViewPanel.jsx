// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { memo, useMemo } from "react";
import PropTypes from "prop-types";
import { TrendingUp, TrendingDown, Target, Shield, Activity, BarChart3 } from "lucide-react";
import TradingViewChart from "./TradingViewChart";
import TradingViewTechnicalAnalysis from "./TradingViewTechnicalAnalysis";
import { getTVSymbol, getTVConfig, ASSET_CLASS_COLORS } from "../config/tradingview-map";
import { getTradingViewInterval } from "../lib/tradingViewSymbols";

/**
 * Complete TradingView Integration Panel
 * Harmonisches Design passend zum Vision AI Mind Dashboard
 * Includes: Live Chart, Technical Analysis, Fib Levels, TP/SL Signals
 * 
 * Verwendet das zentrale tradingview-map.ts für korrekte Symbol-Auflösung
 */
const TradingViewPanel = memo(function TradingViewPanel({
  assetId = "BTC",
  assetClass = "crypto",
  timeFrame = "60",
  showTechnicalAnalysis = true,
  chartHeight = 450,
  technicalHeight = 300,
  theme = "dark",
  className = "",
  // Trading data from parent (our algorithms)
  currentPrice = null,
  fibLevels = null,
  tpLevels = [],
  slLevel = null,
  riskReward = null,
  trendDirection = null,
  signalStrength = null,
}) {
  // Get TradingView symbol und Config aus dem zentralen Mapping
  const tvConfig = useMemo(() => getTVConfig(assetId), [assetId]);
  const tvSymbol = useMemo(() => getTVSymbol(assetId), [assetId]);
  const tvInterval = useMemo(() => getTradingViewInterval(timeFrame), [timeFrame]);
  
  // Dynamischer Header-Titel aus dem Mapping (z.B. "GOLD (XAU/USD)")
  const displayName = useMemo(() => tvConfig?.displayName || assetId, [tvConfig, assetId]);

  // Asset class label - aus Config oder Fallback
  const assetClassLabel = useMemo(() => {
    const effectiveClass = tvConfig?.assetClass || assetClass;
    const labels = {
      crypto: "Krypto",
      forex: "Forex",
      fx: "Forex",
      index: "Index",
      commodity: "Rohstoff",
    };
    return labels[effectiveClass] || "Asset";
  }, [tvConfig, assetClass]);

  // Asset class color - aus zentraler Config
  const assetClassColor = useMemo(() => {
    const effectiveClass = tvConfig?.assetClass || assetClass;
    return ASSET_CLASS_COLORS[effectiveClass] || "text-slate-400 bg-slate-500/10 border-slate-500/30";
  }, [tvConfig, assetClass]);

  // Format price
  const formatPrice = (price) => {
    if (!price) return "—";
    if (price >= 1000) return price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  // Interval label
  const intervalLabel = useMemo(() => {
    if (tvInterval === "D") return "1 Tag";
    if (tvInterval === "W") return "1 Woche";
    if (tvInterval === "M") return "1 Monat";
    if (tvInterval === "240") return "4 Stunden";
    if (tvInterval === "60") return "1 Stunde";
    if (tvInterval === "15") return "15 Min";
    if (tvInterval === "5") return "5 Min";
    return `${tvInterval}m`;
  }, [tvInterval]);

  return (
    <div className={`tradingview-panel space-y-3 ${className}`}>
      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CHART - TradingView Advanced Chart
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-xl">
        {/* Header - Zeigt jetzt den formatierten Namen (z.B. "GOLD (XAU/USD)") */}
        <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <span className="text-white font-semibold text-base">{displayName}</span>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${assetClassColor}`}>
                {assetClassLabel}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-violet-400/80 text-xs font-medium">
                <Activity className="w-3 h-3" />
                Vision AI Mind
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">{intervalLabel}</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 text-xs font-medium">LIVE</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chart - Nutzt jetzt das korrekt gemappte Symbol */}
        <TradingViewChart
          symbol={tvSymbol}
          interval={tvInterval}
          theme={theme}
          height={chartHeight}
          showToolbar={true}
          showVolume={true}
          studies={[]}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FIB LEVELS & TRADE SIGNALS - Our Algorithm Calculations
          ═══════════════════════════════════════════════════════════════════════ */}
      {(fibLevels || tpLevels.length > 0 || (typeof slLevel === 'number' && slLevel !== 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Fibonacci Levels */}
          {fibLevels && (
            <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span className="text-violet-400 font-semibold text-sm">Fibonacci Levels</span>
              </div>
              <div className="space-y-2">
                {Object.entries(fibLevels).map(([level, price]) => (
                  <div key={level} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{level}</span>
                    <span className="text-white font-mono">{formatPrice(price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TP/SL Levels */}
          {(tpLevels.length > 0 || (typeof slLevel === 'number' && slLevel !== 0)) && (
            <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400 font-semibold text-sm">Trade Levels</span>
                {typeof riskReward === 'number' && riskReward !== 0 && (
                  <span className="ml-auto text-xs text-slate-400">
                    R:R {riskReward.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {/* Take Profit Levels */}
                {tpLevels.map((tp, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">TP{idx + 1}</span>
                    </div>
                    <span className="text-white font-mono">{formatPrice(tp.price || tp)}</span>
                  </div>
                ))}
                {/* Stop Loss */}
                {typeof slLevel === 'number' && slLevel !== 0 && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-red-400">Stop Loss</span>
                    </div>
                    <span className="text-white font-mono">{formatPrice(slLevel)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TECHNICAL ANALYSIS WIDGET - TradingView
          ═══════════════════════════════════════════════════════════════════════ */}
      {showTechnicalAnalysis && (
        <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-lg">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 font-semibold text-sm">Technische Analyse</span>
              </div>
              <span className="text-slate-500 text-xs">RSI • MACD • Moving Averages • Oszillatoren</span>
            </div>
          </div>
          
          {/* Widget */}
          <TradingViewTechnicalAnalysis
            symbol={tvSymbol}
            interval={tvInterval === "D" ? "1D" : tvInterval === "240" ? "4h" : tvInterval === "60" ? "1h" : `${tvInterval}m`}
            theme={theme}
            height={technicalHeight}
            isTransparent={true}
            showIntervalTabs={true}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SIGNAL SUMMARY BAR (wenn Trend/Signal verfügbar)
          ═══════════════════════════════════════════════════════════════════════ */}
      {(trendDirection || (typeof signalStrength === 'number' && signalStrength > 0)) && (
        <div className="rounded-xl bg-gradient-to-r from-slate-800/50 via-slate-800/30 to-slate-800/50 border border-slate-700/50 p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Trend */}
            {trendDirection && (
              <div className="flex items-center gap-2">
                {trendDirection === "bullish" ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-semibold ${trendDirection === "bullish" ? "text-emerald-400" : "text-red-400"}`}>
                  {trendDirection === "bullish" ? "Bullish Trend" : "Bearish Trend"}
                </span>
              </div>
            )}
            
            {/* Signal Strength */}
            {typeof signalStrength === 'number' && signalStrength > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Signal-Stärke:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-4 rounded-sm ${
                        i <= signalStrength
                          ? signalStrength >= 4 ? "bg-emerald-400" : signalStrength >= 2 ? "bg-yellow-400" : "bg-red-400"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Current Price */}
            {typeof currentPrice === 'number' && currentPrice !== 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Preis:</span>
                <span className="text-white font-mono font-semibold">{formatPrice(currentPrice)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

TradingViewPanel.propTypes = {
  assetId: PropTypes.string,
  assetClass: PropTypes.string,
  timeFrame: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  showTechnicalAnalysis: PropTypes.bool,
  chartHeight: PropTypes.number,
  technicalHeight: PropTypes.number,
  theme: PropTypes.string,
  className: PropTypes.string,
  // Trading data
  currentPrice: PropTypes.number,
  fibLevels: PropTypes.object,
  tpLevels: PropTypes.array,
  slLevel: PropTypes.number,
  riskReward: PropTypes.number,
  trendDirection: PropTypes.oneOf(["bullish", "bearish", null]),
  signalStrength: PropTypes.number,
};

export default TradingViewPanel;
