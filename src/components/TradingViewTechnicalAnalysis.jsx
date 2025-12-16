// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo, useMemo } from "react";
import PropTypes from "prop-types";
import { getTVSymbol } from "../config/tradingview-map";

/**
 * TradingView Technical Analysis Widget
 * Shows RSI, MACD, Moving Averages, Oscillators summary
 * 
 * Verwendet das zentrale tradingview-map.ts für korrekte Symbol-Auflösung
 */
const TradingViewTechnicalAnalysis = memo(function TradingViewTechnicalAnalysis({
  symbol = "BTCUSD",         // Asset-ID oder UI-Name (wird automatisch gemappt)
  interval = "1h",
  theme = "dark",
  height = 400,
  width = "100%",
  showIntervalTabs = true,
  isTransparent = true,
  containerClassName = "",
}) {
  const containerRef = useRef(null);
  
  // Symbol-Mapping: UI-Name -> TradingView-Ticker
  const tvSymbol = useMemo(() => {
    if (symbol && symbol.includes(":")) return symbol;
    return getTVSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    // Create widget container
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";
    container.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      interval: interval,
      width: "100%",
      isTransparent: isTransparent,
      height: "100%",
      symbol: tvSymbol,
      showIntervalTabs: showIntervalTabs,
      displayMode: "single",
      locale: "de_DE",
      colorTheme: theme,
    });

    widgetContainer.appendChild(script);
    
    if (import.meta.env.DEV) {
      console.log(`[TradingViewTechnicalAnalysis] Loading: ${tvSymbol} (from: ${symbol})`);
    }

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [tvSymbol, symbol, interval, theme, height, width, showIntervalTabs, isTransparent]);

  return (
    <div
      className={`tradingview-widget-container ${containerClassName}`}
      style={{ height, width }}
    >
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
});

TradingViewTechnicalAnalysis.propTypes = {
  symbol: PropTypes.string,
  interval: PropTypes.string,
  theme: PropTypes.string,
  height: PropTypes.number,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  showIntervalTabs: PropTypes.bool,
  isTransparent: PropTypes.bool,
  containerClassName: PropTypes.string,
};

export default TradingViewTechnicalAnalysis;
