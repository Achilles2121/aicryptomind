import React, { useMemo } from "react";
import { Card } from "../../components/Card";
import TradingViewChart from "../../components/TradingViewChart";

export function OhlcChart({ symbol = "BTCUSDT" }) {
  const studies = useMemo(
    () => [
      "Fib Retracement@tv-basicstudies",
      "RSI@tv-basicstudies",
      "MACD@tv-basicstudies",
      "Volume Profile@tv-volumebyprice",
    ],
    []
  );

  const overrides = useMemo(
    () => ({
      "paneProperties.background": "#0f172a",
      "paneProperties.vertGridProperties.color": "rgba(0,0,0,0)",
      "paneProperties.horzGridProperties.color": "rgba(0,0,0,0)",
      "scalesProperties.textColor": "#94a3b8",
      "mainSeriesProperties.candleStyle.upColor": "#10b981",
      "mainSeriesProperties.candleStyle.downColor": "#22d3ee",
      "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
      "mainSeriesProperties.candleStyle.borderDownColor": "#22d3ee",
      "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
      "mainSeriesProperties.candleStyle.wickDownColor": "#22d3ee",
    }),
    []
  );

  return (
    <Card title={`${symbol} OHLC`}>
      <TradingViewChart
        symbol={symbol}
        interval="60"
        height={280}
        showToolbar={true}
        showVolume={true}
        studies={studies}
        overrides={overrides}
      />
    </Card>
  );
}
