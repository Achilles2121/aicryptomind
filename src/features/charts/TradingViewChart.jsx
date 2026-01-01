// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { memo, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { resolveTradingViewTicker } from "../../config/coinConfig";

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/30 bg-slate-900/70 p-4 text-sm text-red-300">
          Chart failed to load. Please retry.
        </div>
      );
    }
    return this.props.children;
  }
}

const TradingViewChart = memo(function TradingViewChart({
  symbol = "BTC",
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

  const tvSymbol = useMemo(() => {
    if (!symbol) return "BINANCE:BTCUSDT";
    if (symbol.includes(":")) return symbol;
    const ticker = resolveTradingViewTicker(symbol);
    return `BINANCE:${ticker}`;
  }, [symbol]);

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
      studies: studies,
      overrides: overrides,
      studies_overrides: studiesOverrides,
      support_host: "https://www.tradingview.com",
    }),
    [tvSymbol, interval, theme, showToolbar, showVolume, studies, overrides, studiesOverrides]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widgetInner = document.createElement("div");
    widgetInner.className = "tradingview-widget-container__widget";
    widgetInner.style.height = "100%";
    widgetInner.style.width = "100%";
    widgetContainer.appendChild(widgetInner);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(widgetConfig);

    widgetContainer.appendChild(script);
    container.appendChild(widgetContainer);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [widgetConfig]);

  return (
    <ChartErrorBoundary>
      <div
        className={`tradingview-chart-wrapper ${containerClassName}`}
        style={{
          height,
          minHeight: height,
          backgroundColor: "#0f172a",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      </div>
    </ChartErrorBoundary>
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
