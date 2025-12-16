// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo, useMemo } from "react";
import PropTypes from "prop-types";
import { getTVSymbol } from "../config/tradingview-map";

/**
 * TradingView Advanced Chart Widget
 * Supports: Crypto, Forex, Indices, Commodities
 * 
 * REALTIME Candlestick Chart mit korrektem Symbol-Mapping
 */
const TradingViewChart = memo(function TradingViewChart({
  symbol = "BTCUSD",           // Asset-ID oder UI-Name (wird automatisch gemappt)
  interval = "60",
  theme = "dark",
  height = 500,
  showToolbar = true,
  showVolume = true,
  studies = [],
  containerClassName = "",
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);  // ID wird im useEffect gesetzt
  
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

    // Generate unique widget ID for this instance (im Effect, nicht im Render)
    widgetIdRef.current = `tv_chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Clear previous widget completely
    container.innerHTML = "";

    // Create widget container div with unique ID
    const widgetContainer = document.createElement("div");
    widgetContainer.id = widgetIdRef.current;
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
    const defaultStudies = studies.length > 0 ? studies : [];

    // Widget-Konfiguration - WICHTIG: Keine backgroundColor, das verursacht Probleme
    const widgetConfig = {
      container_id: widgetIdRef.current,
      autosize: true,
      symbol: tvSymbol,
      interval: String(interval),
      timezone: "Europe/Berlin",
      theme: theme,
      style: "1",           // 1 = Candlestick (WICHTIG!)
      locale: "de_DE",
      toolbar_bg: "#0f172a",
      enable_publishing: false,
      allow_symbol_change: true,
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: false,
      withdateranges: true,
      hide_volume: !showVolume,
      support_host: "https://www.tradingview.com",
      studies: defaultStudies,
      // Realtime-Einstellungen
      show_popup_button: false,
      popup_width: "1000",
      popup_height: "650",
    };
    
    script.innerHTML = JSON.stringify(widgetConfig);
    
    // Debug-Log für Entwicklung
    if (import.meta.env.DEV) {
      console.log(`[TradingViewChart] Loading: ${tvSymbol} (from: ${symbol}), interval: ${interval}`);
    }

    widgetContainer.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [tvSymbol, symbol, interval, theme, showToolbar, showVolume, studies]);

  return (
    <div 
      className={`tradingview-widget-container ${containerClassName}`} 
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
