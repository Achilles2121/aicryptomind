// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo } from "react";
import PropTypes from "prop-types";

/**
 * TradingView Crypto Heatmap Widget
 * Shows market overview with color-coded performance
 */
const TradingViewHeatmap = memo(function TradingViewHeatmap({
  dataSource = "Crypto",
  blockSize = "market_cap_calc",
  blockColor = "change",
  theme = "dark",
  height = 400,
  width = "100%",
  hasTopBar = false,
  isDataSetEnabled = false,
  isZoomEnabled = true,
  isTransparent = true,
  containerClassName = "",
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-crypto-coins-heatmap.js";
    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      dataSource: dataSource,
      blockSize: blockSize,
      blockColor: blockColor,
      locale: "de_DE",
      symbolUrl: "",
      colorTheme: theme,
      hasTopBar: hasTopBar,
      isDataSetEnabled: isDataSetEnabled,
      isZoomEnabled: isZoomEnabled,
      hasSymbolTooltip: true,
      isTransparent: isTransparent,
      width: width,
      height: height,
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [dataSource, blockSize, blockColor, theme, height, width, hasTopBar, isDataSetEnabled, isZoomEnabled, isTransparent]);

  return (
    <div
      className={`tradingview-widget-container ${containerClassName}`}
      ref={containerRef}
      style={{ height, width }}
    />
  );
});

TradingViewHeatmap.propTypes = {
  dataSource: PropTypes.string,
  blockSize: PropTypes.string,
  blockColor: PropTypes.string,
  theme: PropTypes.string,
  height: PropTypes.number,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  hasTopBar: PropTypes.bool,
  isDataSetEnabled: PropTypes.bool,
  isZoomEnabled: PropTypes.bool,
  isTransparent: PropTypes.bool,
  containerClassName: PropTypes.string,
};

export default TradingViewHeatmap;
