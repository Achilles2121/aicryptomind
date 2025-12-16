// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo, useMemo } from "react";
import PropTypes from "prop-types";
import { getTVSymbol } from "../config/tradingview-map";

/**
 * TradingView Advanced Chart Widget
 * Supports: Crypto, Forex, Indices, Commodities
 * 
 * REALTIME Candlestick Chart mit korrektem Symbol-Mapping
 * Korrekte TradingView Widget DOM-Struktur
 */
const TradingViewChart = memo(function TradingViewChart({
  symbol = "BTCUSD",
  interval = "60",
  theme = "dark",
  height = 500,
  showToolbar = true,
  showVolume = true,
  studies = [],
  containerClassName = "",
}) {
  const containerRef = useRef(null);
  
  // Symbol-Mapping: UI-Name -> TradingView-Ticker
  const tvSymbol = useMemo(() => {
    if (symbol && symbol.includes(":")) {
      return symbol;
    }
    return getTVSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Komplett leeren
    container.innerHTML = "";

    // TradingView Widget Container Struktur erstellen
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    // Inner widget div
    const widgetInner = document.createElement("div");
    widgetInner.className = "tradingview-widget-container__widget";
    widgetInner.style.height = "100%";
    widgetInner.style.width = "100%";
    widgetContainer.appendChild(widgetInner);

    // Script Element mit Konfiguration als innerHTML (so wie TradingView es erwartet)
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Widget-Konfiguration
    const widgetConfig = {
      autosize: true,
      symbol: tvSymbol,
      interval: String(interval),
      timezone: "Europe/Berlin",
      theme: theme,
      style: "1",
      locale: "de_DE",
      allow_symbol_change: true,
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: false,
      withdateranges: true,
      hide_volume: !showVolume,
      calendar: false,
      details: false,
      hotlist: false,
      studies: studies.length > 0 ? studies : [],
      support_host: "https://www.tradingview.com",
    };
    
    script.innerHTML = JSON.stringify(widgetConfig);
    widgetContainer.appendChild(script);
    
    // Debug
    if (import.meta.env.DEV) {
      console.log(`[TradingViewChart] Loading: ${tvSymbol} (from: ${symbol})`);
    }

    container.appendChild(widgetContainer);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [tvSymbol, symbol, interval, theme, showToolbar, showVolume, studies]);

  return (
    <div 
      className={`tradingview-chart-wrapper ${containerClassName}`} 
      style={{ 
        height, 
        minHeight: height,
        backgroundColor: "#0f172a",
        borderRadius: "0.75rem",
        overflow: "hidden"
      }}
    >
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
});

TradingViewChart.propTypes = {
  symbol: PropTypes.string,
  interval: PropTypes.string,
  theme: PropTypes.oneOf(["light", "dark"]),
  height: PropTypes.number,
  showToolbar: PropTypes.bool,
  showVolume: PropTypes.bool,
  studies: PropTypes.arrayOf(PropTypes.string),
  containerClassName: PropTypes.string,
};

export default TradingViewChart;
