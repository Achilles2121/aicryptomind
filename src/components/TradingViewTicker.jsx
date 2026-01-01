// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useRef, memo } from "react";
import PropTypes from "prop-types";

/**
 * TradingView Ticker Tape Widget
 * Scrolling price ticker for multiple assets
 */
const TradingViewTicker = memo(function TradingViewTicker({
  symbols = [
    { proName: "BINANCE:BTCUSDT", title: "Bitcoin" },
    { proName: "BINANCE:ETHUSDT", title: "Ethereum" },
    { proName: "BINANCE:SOLUSDT", title: "Solana" },
    { proName: "BINANCE:XRPUSDT", title: "XRP" },
    { proName: "BINANCE:BNBUSDT", title: "BNB" },
    { proName: "BINANCE:DOGEUSDT", title: "Dogecoin" },
  ],
  theme = "dark",
  isTransparent = true,
  showSymbolLogo = true,
  displayMode = "adaptive",
  containerClassName = "",
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      symbols: symbols,
      showSymbolLogo: showSymbolLogo,
      isTransparent: isTransparent,
      displayMode: displayMode,
      colorTheme: theme,
      locale: "de_DE",
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbols, theme, isTransparent, showSymbolLogo, displayMode]);

  return (
    <div
      className={`tradingview-widget-container ${containerClassName}`}
      ref={containerRef}
    />
  );
});

TradingViewTicker.propTypes = {
  symbols: PropTypes.arrayOf(
    PropTypes.shape({
      proName: PropTypes.string,
      title: PropTypes.string,
    })
  ),
  theme: PropTypes.string,
  isTransparent: PropTypes.bool,
  showSymbolLogo: PropTypes.bool,
  displayMode: PropTypes.string,
  containerClassName: PropTypes.string,
};

export default TradingViewTicker;
