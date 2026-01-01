// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo, useMemo } from "react";
import PropTypes from "prop-types";
import { getTVSymbol } from "../config/tradingview-map";

/**
 * TradingView Advanced Chart Widget
 * Supports: Crypto
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
  overrides = {},
  studiesOverrides = {},
  containerClassName = "",
}) {
  const containerRef = useRef(null);
  const scriptLoadedRef = useRef(false);
  const lastSymbolRef = useRef("");
  
  // Symbol-Mapping: UI-Name -> TradingView-Ticker
  const tvSymbol = useMemo(() => {
    if (symbol?.includes(":")) {
      return symbol;
    }
    return getTVSymbol(symbol);
  }, [symbol]);

  // Ensure overrides are safe JSON-serializable objects
  const safeOverrides = useMemo(() => {
    if (!overrides || typeof overrides !== "object") return {};
    try {
      // Test JSON serialization
      JSON.stringify(overrides);
      return overrides;
    } catch {
      console.warn("[TradingViewChart] Invalid overrides object, using empty");
      return {};
    }
  }, [overrides]);

  const safeStudiesOverrides = useMemo(() => {
    if (!studiesOverrides || typeof studiesOverrides !== "object") return {};
    try {
      JSON.stringify(studiesOverrides);
      return studiesOverrides;
    } catch {
      console.warn("[TradingViewChart] Invalid studiesOverrides object, using empty");
      return {};
    }
  }, [studiesOverrides]);

  const widgetConfig = useMemo(
    () => ({
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
      studies: Array.isArray(studies) ? studies : [],
      overrides: safeOverrides,
      studies_overrides: safeStudiesOverrides,
      support_host: "https://www.tradingview.com",
    }),
    [tvSymbol, interval, theme, showToolbar, showVolume, studies, safeOverrides, safeStudiesOverrides]
  );
  const widgetConfigRef = useRef(widgetConfig);

  useEffect(() => {
    widgetConfigRef.current = widgetConfig;
  }, [widgetConfig]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (lastSymbolRef.current === tvSymbol && container.querySelector(".tradingview-widget-container")) {
      return;
    }

    lastSymbolRef.current = tvSymbol;

    // Verhindere mehrfaches Laden
    // Rebuild nur wenn Config sich geaendert hat (configKeyRef)

    // Komplett leeren
    container.innerHTML = "";
    scriptLoadedRef.current = false;

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

    // Script Element mit Konfiguration als innerHTML
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Widget-Konfiguration
    script.innerHTML = JSON.stringify(widgetConfigRef.current);
    
    script.onload = () => {
      scriptLoadedRef.current = true;
      // Hide TradingView copyright text after load
      setTimeout(() => {
        const copyrightElements = container.querySelectorAll(".tradingview-widget-copyright");
        copyrightElements.forEach(el => {
          el.style.display = "none";
        });
      }, 1000);
    };
    
    widgetContainer.appendChild(script);
    container.appendChild(widgetContainer);

    return () => {
      scriptLoadedRef.current = false;
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [tvSymbol]);

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
}, (prevProps, nextProps) => prevProps.symbol === nextProps.symbol);

TradingViewChart.propTypes = {
  symbol: PropTypes.string,
  interval: PropTypes.string,
  theme: PropTypes.oneOf(["light", "dark"]),
  height: PropTypes.number,
  showToolbar: PropTypes.bool,
  showVolume: PropTypes.bool,
  studies: PropTypes.arrayOf(PropTypes.string),
  overrides: PropTypes.object,
  studiesOverrides: PropTypes.object,
  containerClassName: PropTypes.string,
};

export default TradingViewChart;
