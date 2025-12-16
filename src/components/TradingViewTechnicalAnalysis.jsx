// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo } from "react";
import PropTypes from "prop-types";

/**
 * TradingView Technical Analysis Widget
 * Shows RSI, MACD, Moving Averages, Oscillators summary
 */
const TradingViewTechnicalAnalysis = memo(function TradingViewTechnicalAnalysis({
  symbol = "BINANCE:BTCUSDT",
  interval = "1h",
  theme = "dark",
  height = 400,
  width = "100%",
  showIntervalTabs = true,
  isTransparent = true,
  containerClassName = "",
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      interval: interval,
      width: width,
      isTransparent: isTransparent,
      height: height,
      symbol: symbol,
      showIntervalTabs: showIntervalTabs,
      displayMode: "single",
      locale: "de_DE",
      colorTheme: theme,
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol, interval, theme, height, width, showIntervalTabs, isTransparent]);

  return (
    <div
      className={`tradingview-widget-container ${containerClassName}`}
      ref={containerRef}
      style={{ height, width }}
    />
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
