// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo } from "react";
import PropTypes from "prop-types";

/**
 * TradingView Mini Chart Widget - for smaller displays
 * Lightweight chart perfect for RSI, MACD panels
 */
const TradingViewMiniChart = memo(function TradingViewMiniChart({
  symbol = "BINANCE:BTCUSDT",
  dateRange = "1M",
  theme = "dark",
  height = 200,
  width = "100%",
  colorTheme = "dark",
  isTransparent = true,
  showFloatingTooltip = true,
  containerClassName = "",
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: width,
      height: height,
      locale: "de_DE",
      dateRange: dateRange,
      colorTheme: colorTheme,
      isTransparent: isTransparent,
      autosize: false,
      largeChartUrl: "",
      showFloatingTooltip: showFloatingTooltip,
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol, dateRange, theme, height, width, colorTheme, isTransparent, showFloatingTooltip]);

  return (
    <div
      className={`tradingview-widget-container ${containerClassName}`}
      ref={containerRef}
      style={{ height, width }}
    />
  );
});

TradingViewMiniChart.propTypes = {
  symbol: PropTypes.string,
  dateRange: PropTypes.string,
  theme: PropTypes.string,
  height: PropTypes.number,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  colorTheme: PropTypes.string,
  isTransparent: PropTypes.bool,
  showFloatingTooltip: PropTypes.bool,
  containerClassName: PropTypes.string,
};

export default TradingViewMiniChart;
