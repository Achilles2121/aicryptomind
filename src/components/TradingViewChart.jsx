// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo, useMemo } from "react";
import PropTypes from "prop-types";
import { getTVSymbol } from "../config/tradingview-map";

/**
 * TradingView Advanced Chart Widget
 * Supports: Crypto, Forex, Indices, Commodities
 * 
 * Verwendet das zentrale Symbol-Mapping für korrekte TradingView-Ticker
 */
const TradingViewChart = memo(function TradingViewChart({
  symbol = "BTCUSD",           // Asset-ID oder UI-Name (wird automatisch gemappt)
  interval = "60",
  theme = "dark",
  height = 400,
  showToolbar = true,
  showVolume = true,
  studies = [],
  containerClassName = "",
  backgroundColor = "rgba(15, 23, 42, 1)", // slate-900
}) {
  const containerRef = useRef(null);
  
  // Symbol-Mapping: UI-Name -> TradingView-Ticker
  const tvSymbol = useMemo(() => {
    // Wenn bereits ein TradingView-Format (mit ":"), direkt verwenden
    if (symbol && symbol.includes(":")) {
      return symbol;
    }
    // Sonst im Mapping nachschlagen
    return getTVSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = "";

    // Create widget container div
    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";
    container.appendChild(widgetContainer);

    // Create script element
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Default studies based on prop
    const defaultStudies = studies.length > 0 ? studies : [
      "RSI@tv-basicstudies",
      "MASimple@tv-basicstudies",
      "MACD@tv-basicstudies",
    ];

    // Widget-Konfiguration mit korrektem Symbol und Dark-Theme
    const widgetConfig = {
      autosize: true,
      symbol: tvSymbol,
      interval: interval,
      timezone: "Europe/Berlin",
      theme: theme,
      style: "1", // Candlestick
      locale: "de_DE",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      save_image: false,
      hide_volume: !showVolume,
      support_host: "https://www.tradingview.com",
      studies: defaultStudies,
      // Dark Theme Anpassungen
      backgroundColor: theme === "dark" ? backgroundColor : "rgba(255, 255, 255, 1)",
      gridColor: theme === "dark" ? "rgba(30, 41, 59, 0.5)" : "rgba(200, 200, 200, 0.5)",
    };
    
    script.innerHTML = JSON.stringify(widgetConfig);
    
    // Debug-Log für Entwicklung
    if (import.meta.env.DEV) {
      console.log(`[TradingViewChart] Loading: ${tvSymbol} (from: ${symbol})`);
    }

    widgetContainer.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [tvSymbol, symbol, interval, theme, showToolbar, showVolume, studies, backgroundColor]);

  return (
    <div 
      className={`tradingview-widget-container ${containerClassName}`} 
      style={{ height, backgroundColor }}
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
  backgroundColor: PropTypes.string,
};

export default TradingViewChart;
