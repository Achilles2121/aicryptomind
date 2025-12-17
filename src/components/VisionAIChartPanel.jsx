// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { memo, useMemo } from "react";
import PropTypes from "prop-types";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Shield, 
  Activity, 
  BarChart3,
  Zap,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  Waves,
  Eye,
  Brain
} from "lucide-react";
import TradingViewChart from "./TradingViewChart";
import TradingViewTechnicalAnalysis from "./TradingViewTechnicalAnalysis";
import { getTVSymbol, getTVConfig, ASSET_CLASS_COLORS } from "../config/tradingview-map";
import { getTradingViewInterval } from "../lib/tradingViewSymbols";

/**
 * Vision AI Mind - Complete Chart Panel
 * 
 * Ersetzt TradingView-Branding durch Vision AI Mind
 * Zeigt unsere eigenen Berechnungen:
 * - TP/SL Levels
 * - Fibonacci Levels  
 * - Signal Overlays (Kauf/Verkauf)
 * - Whale/ETF Flows
 * - Wahrscheinlichkeiten & Algorithmus-Ergebnisse
 */
const VisionAIChartPanel = memo(function VisionAIChartPanel({
  // Asset Info
  assetId = "BTC",
  assetClass = "crypto",
  timeFrame = "60",
  theme = "dark",
  className = "",
  
  // Chart Settings
  chartHeight = 480,
  technicalHeight = 280,
  showTechnicalAnalysis = true,
  
  // Current Price & Trend
  currentPrice = null,
  priceChange24h = null,
  trendDirection = null,
  
  // Our Algorithm Data
  signal = null,           // { action: 'Kaufen'/'Verkaufen'/'Warten', reason, confidence }
  signalStrength = null,   // 1-5
  
  // TP/SL from riskEngine
  takeProfitLevels = [],   // [{ price, label, probability }]
  stopLossLevel = null,    // { price, atrBased }
  riskReward = null,       // R:R Ratio
  
  // Fibonacci Levels (our calculation)
  fibLevels = null,        // { '0%': price, '23.6%': price, ... }
  
  // Whale/Flow Data
  whaleActivity = null,    // { netFlow, buyVolume, sellVolume, trend }
  etfFlows = null,         // { net, inflows, outflows }
  
  // Indicators from our engine
  indicators = {},         // { rsi, macd, signal, bollUpper, bollLower, ema200, atrPct }
  
  // Market Regime
  marketRegime = null,     // { label: 'Bull'/'Bear'/'Crab', intent }
  
  // Volume Data
  volumeSpike = false,
  volumeRatio = 1,
}) {
  // Get TradingView symbol und Config
  const tvConfig = useMemo(() => getTVConfig(assetId), [assetId]);
  const tvSymbol = useMemo(() => getTVSymbol(assetId), [assetId]);
  const tvInterval = useMemo(() => getTradingViewInterval(timeFrame), [timeFrame]);
  
  // Display name
  const displayName = useMemo(() => tvConfig?.displayName || assetId, [tvConfig, assetId]);

  // Asset class styling
  const assetClassLabel = useMemo(() => {
    const effectiveClass = tvConfig?.assetClass || assetClass;
    const labels = { crypto: "Krypto", forex: "Forex", fx: "Forex", index: "Index", commodity: "Rohstoff" };
    return labels[effectiveClass] || "Asset";
  }, [tvConfig, assetClass]);

  const assetClassColor = useMemo(() => {
    const effectiveClass = tvConfig?.assetClass || assetClass;
    return ASSET_CLASS_COLORS[effectiveClass] || "text-slate-400 bg-slate-500/10 border-slate-500/30";
  }, [tvConfig, assetClass]);

  // Interval label
  const intervalLabel = useMemo(() => {
    const labels = { "D": "1 Tag", "W": "1 Woche", "M": "1 Monat", "240": "4H", "60": "1H", "15": "15m", "5": "5m", "1": "1m" };
    return labels[tvInterval] || `${tvInterval}m`;
  }, [tvInterval]);

  // Format price based on value
  const formatPrice = (price) => {
    if (!price || !Number.isFinite(price)) return "—";
    if (price >= 10000) return price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  // Signal color
  const getSignalColor = (action) => {
    if (action === "Kaufen" || action === "long") return "text-emerald-400";
    if (action === "Verkaufen" || action === "short") return "text-red-400";
    return "text-yellow-400";
  };

  const getSignalBg = (action) => {
    if (action === "Kaufen" || action === "long") return "bg-emerald-500/10 border-emerald-500/30";
    if (action === "Verkaufen" || action === "short") return "bg-red-500/10 border-red-500/30";
    return "bg-yellow-500/10 border-yellow-500/30";
  };

  // Technical interval for widget
  const technicalInterval = useMemo(() => {
    if (tvInterval === "D") return "1D";
    if (tvInterval === "W") return "1W";
    if (tvInterval === "240") return "4h";
    if (tvInterval === "60") return "1h";
    if (tvInterval === "15") return "15m";
    if (tvInterval === "5") return "5m";
    return `${tvInterval}m`;
  }, [tvInterval]);

  return (
    <div className={`vision-ai-chart-panel space-y-3 ${className}`}>
      
      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CHART CONTAINER - Vision AI Mind Branded
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900/90 via-slate-800/60 to-slate-900/90 border border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-xl">
        
        {/* Header - Vision AI Mind Branding */}
        <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 via-violet-900/20 to-slate-800/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Left: Asset Info + Vision AI Mind */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Brain className="w-5 h-5 text-violet-400" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                </div>
                <span className="text-white font-bold text-base">{displayName}</span>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${assetClassColor}`}>
                {assetClassLabel}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-violet-400/80 text-xs font-medium">
                <Eye className="w-3 h-3" />
                Vision AI Mind
              </span>
            </div>
            
            {/* Right: Status */}
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">{intervalLabel}</span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 text-xs font-medium">LIVE</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Signal Overlay Bar - Wenn Signal vorhanden */}
        {signal && signal.action && signal.action !== "Warten" && (
          <div className={`px-4 py-2 border-b border-slate-700/50 ${getSignalBg(signal.action)}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                {signal.action === "Kaufen" || signal.action === "long" ? (
                  <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ArrowDownCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-bold text-sm ${getSignalColor(signal.action)}`}>
                  {signal.action === "long" ? "KAUFEN" : signal.action === "short" ? "VERKAUFEN" : signal.action.toUpperCase()}
                </span>
                {signal.reason && (
                  <span className="text-slate-400 text-xs hidden sm:inline">• {signal.reason}</span>
                )}
              </div>
              {signal.confidence && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Konfidenz:</span>
                  <span className={`font-mono text-sm font-bold ${signal.confidence >= 0.65 ? "text-emerald-400" : signal.confidence >= 0.55 ? "text-yellow-400" : "text-red-400"}`}>
                    {(signal.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TradingView Chart */}
        <TradingViewChart
          symbol={tvSymbol}
          interval={tvInterval}
          theme={theme}
          height={chartHeight}
          showToolbar={true}
          showVolume={true}
          studies={[]}
        />
        
        {/* Footer - Copyright Overlay */}
        <div className="px-3 py-1.5 bg-slate-900/80 border-t border-slate-700/30 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">© 2025 Vision AI Mind • Crypto Risk Manager</span>
          <span className="text-[10px] text-slate-600">Algorithmus-basierte Analyse</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SIGNAL & LEVELS CARDS - 3-Column Grid
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        
        {/* Card 1: TP/SL Levels */}
        <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-semibold text-sm">Take Profit / Stop Loss</span>
            {typeof riskReward === 'number' && riskReward !== 0 && (
              <span className="ml-auto text-xs bg-slate-700/50 px-2 py-0.5 rounded text-slate-300">
                R:R {riskReward.toFixed(2)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {/* Current Price */}
            {typeof currentPrice === 'number' && currentPrice !== 0 && (
              <div className="flex items-center justify-between text-sm py-1 border-b border-slate-700/30">
                <span className="text-slate-400">Aktuell</span>
                <span className="text-white font-mono font-bold">{formatPrice(currentPrice)}</span>
              </div>
            )}
            
            {/* Take Profit Levels */}
            {takeProfitLevels.length > 0 ? (
              takeProfitLevels.map((tp, idx) => (
                <div key={`tp-${idx}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">TP{idx + 1}</span>
                    {tp.probability && (
                      <span className="text-xs text-slate-500">({(tp.probability * 100).toFixed(0)}%)</span>
                    )}
                  </div>
                  <span className="text-white font-mono">{formatPrice(tp.price || tp)}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500 italic">Keine TP berechnet</div>
            )}
            
            {/* Stop Loss */}
            {stopLossLevel ? (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400">Stop Loss</span>
                  {stopLossLevel.atrBased && (
                    <span className="text-xs text-slate-500">(ATR)</span>
                  )}
                </div>
                <span className="text-white font-mono">{formatPrice(stopLossLevel.price || stopLossLevel)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/50 text-slate-500 italic">
                <span>Kein SL berechnet</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Fibonacci Levels */}
        <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <span className="text-violet-400 font-semibold text-sm">Fibonacci Levels</span>
          </div>
          <div className="space-y-1.5">
            {fibLevels && Object.keys(fibLevels).length > 0 ? (
              Object.entries(fibLevels).map(([level, price]) => {
                // Color coding for fib levels
                let levelColor = "text-slate-400";
                if (level === "0%" || level === "100%") levelColor = "text-cyan-400";
                else if (level === "50%") levelColor = "text-yellow-400";
                else if (level === "61.8%") levelColor = "text-amber-400";
                else if (level === "38.2%") levelColor = "text-blue-400";
                
                return (
                  <div key={level} className="flex items-center justify-between text-sm">
                    <span className={levelColor}>{level}</span>
                    <span className="text-white font-mono text-xs">{formatPrice(price)}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-slate-500 italic">Keine Fib-Levels berechnet</div>
            )}
          </div>
        </div>

        {/* Card 3: Signal & Indicators */}
        <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 font-semibold text-sm">Signal & Indikatoren</span>
          </div>
          <div className="space-y-2">
            {/* Signal Strength */}
            {typeof signalStrength === 'number' && signalStrength > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Signalstärke</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-3 rounded-sm ${
                        i <= signalStrength
                          ? signalStrength >= 4 ? "bg-emerald-400" : signalStrength >= 2 ? "bg-yellow-400" : "bg-red-400"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* RSI */}
            {indicators.rsi !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">RSI</span>
                <span className={`font-mono ${indicators.rsi < 30 ? "text-emerald-400" : indicators.rsi > 70 ? "text-red-400" : "text-white"}`}>
                  {indicators.rsi?.toFixed(1)}
                </span>
              </div>
            )}
            
            {/* MACD */}
            {indicators.macd !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">MACD</span>
                <span className={`font-mono ${indicators.macd > (indicators.signal || 0) ? "text-emerald-400" : "text-red-400"}`}>
                  {indicators.macd?.toFixed(2)}
                </span>
              </div>
            )}
            
            {/* ATR % */}
            {indicators.atrPct !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">ATR%</span>
                <span className="text-white font-mono">{indicators.atrPct?.toFixed(2)}%</span>
              </div>
            )}
            
            {/* Market Regime */}
            {marketRegime && (
              <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-700/30">
                <span className="text-slate-400">Regime</span>
                <span className={`font-medium ${
                  marketRegime.label === "Bull" ? "text-emerald-400" : 
                  marketRegime.label === "Bear" ? "text-red-400" : "text-yellow-400"
                }`}>
                  {marketRegime.label}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          WHALE & FLOW ACTIVITY (wenn Daten vorhanden)
          ═══════════════════════════════════════════════════════════════════════ */}
      {(whaleActivity || etfFlows || volumeSpike) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* Whale Activity */}
          {whaleActivity && (
            <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Waves className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-semibold text-sm">Whale Aktivität</span>
                {whaleActivity.trend && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                    whaleActivity.trend === "accumulating" ? "bg-emerald-500/20 text-emerald-400" :
                    whaleActivity.trend === "distributing" ? "bg-red-500/20 text-red-400" :
                    "bg-slate-700/50 text-slate-400"
                  }`}>
                    {whaleActivity.trend === "accumulating" ? "Akkumulierung" : 
                     whaleActivity.trend === "distributing" ? "Distribution" : "Neutral"}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Netto-Flow</span>
                  <span className={`font-mono ${whaleActivity.netFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {whaleActivity.netFlow >= 0 ? "+" : ""}{formatPrice(whaleActivity.netFlow)}
                  </span>
                </div>
                {whaleActivity.buyVolume && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-400/70">Käufe</span>
                    <span className="text-white font-mono text-xs">{formatPrice(whaleActivity.buyVolume)}</span>
                  </div>
                )}
                {whaleActivity.sellVolume && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-400/70">Verkäufe</span>
                    <span className="text-white font-mono text-xs">{formatPrice(whaleActivity.sellVolume)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ETF Flows */}
          {etfFlows && (
            <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400 font-semibold text-sm">ETF Flows</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Netto</span>
                  <span className={`font-mono ${etfFlows.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {etfFlows.net >= 0 ? "+" : ""}${(etfFlows.net / 1e6).toFixed(1)}M
                  </span>
                </div>
                {etfFlows.inflows && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-400/70">Zuflüsse</span>
                    <span className="text-white font-mono text-xs">${(etfFlows.inflows / 1e6).toFixed(1)}M</span>
                  </div>
                )}
                {etfFlows.outflows && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-red-400/70">Abflüsse</span>
                    <span className="text-white font-mono text-xs">${(etfFlows.outflows / 1e6).toFixed(1)}M</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Volume Spike Alert */}
          {volumeSpike && (
            <div className="rounded-xl bg-gradient-to-br from-amber-900/20 via-slate-800/50 to-slate-900/80 border border-amber-500/30 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-amber-400 font-semibold text-sm">Volumen-Spike erkannt!</span>
                  {volumeRatio > 1 && (
                    <span className="ml-2 text-xs text-amber-400/70">
                      {volumeRatio.toFixed(1)}x über Durchschnitt
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TECHNICAL ANALYSIS - Vision AI Mind Branded
          ═══════════════════════════════════════════════════════════════════════ */}
      {showTechnicalAnalysis && (
        <div className="rounded-xl bg-gradient-to-br from-slate-900/80 via-slate-800/50 to-slate-900/80 border border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 via-cyan-900/10 to-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-400 font-semibold text-sm">Technische Analyse</span>
                <span className="hidden sm:inline text-[10px] text-violet-400/60">• Vision AI Mind</span>
              </div>
              <span className="text-slate-500 text-xs">RSI • MACD • MA • Oszillatoren</span>
            </div>
          </div>
          
          <TradingViewTechnicalAnalysis
            symbol={tvSymbol}
            interval={technicalInterval}
            theme={theme}
            height={technicalHeight}
            isTransparent={true}
            showIntervalTabs={true}
          />
          
          <div className="px-3 py-1 bg-slate-900/80 border-t border-slate-700/30">
            <span className="text-[10px] text-slate-600">© 2025 Vision AI Mind • Algorithmus-basierte Signale</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BOTTOM SUMMARY BAR
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl bg-gradient-to-r from-violet-900/20 via-slate-800/50 to-violet-900/20 border border-violet-500/20 p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Trend Direction */}
          <div className="flex items-center gap-2">
            {trendDirection === "bullish" ? (
              <>
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Bullish</span>
              </>
            ) : trendDirection === "bearish" ? (
              <>
                <TrendingDown className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-semibold">Bearish</span>
              </>
            ) : (
              <>
                <Activity className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-semibold">Neutral</span>
              </>
            )}
          </div>
          
          {/* Price Change */}
          {priceChange24h !== null && (
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-xs">24h:</span>
              <span className={`font-mono text-sm ${priceChange24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {priceChange24h >= 0 ? "+" : ""}{priceChange24h.toFixed(2)}%
              </span>
            </div>
          )}
          
          {/* Vision AI Mind Badge */}
          <div className="flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-violet-400" />
            <span className="text-violet-400 text-xs font-medium">Vision AI Mind</span>
            <span className="text-slate-500 text-[10px]">• Crypto Risk Manager</span>
          </div>
        </div>
      </div>
    </div>
  );
});

VisionAIChartPanel.propTypes = {
  assetId: PropTypes.string,
  assetClass: PropTypes.string,
  timeFrame: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  theme: PropTypes.string,
  className: PropTypes.string,
  chartHeight: PropTypes.number,
  technicalHeight: PropTypes.number,
  showTechnicalAnalysis: PropTypes.bool,
  currentPrice: PropTypes.number,
  priceChange24h: PropTypes.number,
  trendDirection: PropTypes.oneOf(["bullish", "bearish", null]),
  signal: PropTypes.shape({
    action: PropTypes.string,
    reason: PropTypes.string,
    confidence: PropTypes.number,
  }),
  signalStrength: PropTypes.number,
  takeProfitLevels: PropTypes.array,
  stopLossLevel: PropTypes.oneOfType([PropTypes.object, PropTypes.number]),
  riskReward: PropTypes.number,
  fibLevels: PropTypes.object,
  whaleActivity: PropTypes.object,
  etfFlows: PropTypes.object,
  indicators: PropTypes.object,
  marketRegime: PropTypes.object,
  volumeSpike: PropTypes.bool,
  volumeRatio: PropTypes.number,
};

export default VisionAIChartPanel;
