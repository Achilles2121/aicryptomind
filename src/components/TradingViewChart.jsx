// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo, useId } from "react";
import PropTypes from "prop-types";

/**
 * TradingView Advanced Chart Widget
 * Supports: Crypto, Forex, Indices, Commodities
 */
const TradingViewChart = memo(function TradingViewChart({
  symbol = "BINANCE:BTCUSDT",
  interval = "60",
  theme = "dark",
  height = 400,
  showToolbar = true,
  showVolume = true,
  studies = [],
  containerClassName = "",
}) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  // Use React's useId for stable unique IDs
  const reactId = useId();
  const containerId = `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, "_")}${reactId.replace(/:/g, "_")}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    if (widgetRef.current) {
      container.innerHTML = "";
    }

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

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: "Europe/Berlin",
      theme: theme,
      style: "1", // Candlestick
      locale: "de_DE",
      enable_publishing: false,
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      save_image: false,
      hide_volume: !showVolume,
      support_host: "https://www.tradingview.com",
      studies: defaultStudies,
      container_id: containerId,
    });

    container.appendChild(script);
    widgetRef.current = script;

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol, interval, theme, showToolbar, showVolume, studies, containerId]);

  return (
    <div className={`tradingview-widget-container ${containerClassName}`} style={{ height }}>
      <div
        id={containerId}
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
