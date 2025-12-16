// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { memo, useMemo } from "react";
import PropTypes from "prop-types";
import TradingViewChart from "./TradingViewChart";
import TradingViewTechnicalAnalysis from "./TradingViewTechnicalAnalysis";
import { getTradingViewSymbol, getTradingViewInterval } from "../lib/tradingViewSymbols";

/**
 * Complete TradingView Integration Panel
 * Replaces Recharts with TradingView widgets for reliable data
 */
const TradingViewPanel = memo(function TradingViewPanel({
  assetId = "BTC",
  assetClass = "crypto",
  timeFrame = "60",
  showTechnicalAnalysis = true,
  chartHeight = 450,
  technicalHeight = 350,
  theme = "dark",
  className = "",
}) {
  // Get TradingView symbol
  const tvSymbol = useMemo(() => getTradingViewSymbol(assetId, assetClass), [assetId, assetClass]);
  const tvInterval = useMemo(() => getTradingViewInterval(timeFrame), [timeFrame]);

  return (
    <div className={`tradingview-panel space-y-4 ${className}`}>
      {/* Main Advanced Chart with Candlesticks, Volume, and Indicators */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-sm font-semibold">📈 Live Chart</span>
            <span className="text-slate-400 text-xs">{assetId} · TradingView</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {tvInterval === "D" ? "1D" : tvInterval === "240" ? "4H" : tvInterval === "60" ? "1H" : `${tvInterval}m`}
            </span>
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Live" />
          </div>
        </div>
        <TradingViewChart
          symbol={tvSymbol}
          interval={tvInterval}
          theme={theme}
          height={chartHeight}
          showToolbar={true}
          showVolume={true}
          studies={[
            "RSI@tv-basicstudies",
            "MAExp@tv-basicstudies",
            "MACD@tv-basicstudies",
            "BB@tv-basicstudies",
          ]}
        />
      </div>

      {/* Technical Analysis Summary */}
      {showTechnicalAnalysis && (
        <div className="rounded-xl bg-slate-900/50 border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-cyan-400 text-sm font-semibold">📊 Technische Analyse</span>
            <span className="text-slate-400 text-xs">RSI · MACD · Moving Averages</span>
          </div>
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
};

export default TradingViewPanel;
