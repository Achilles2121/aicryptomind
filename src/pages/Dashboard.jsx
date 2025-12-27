import React, { useContext, useEffect, useState } from "react";
import { PriceChart } from "../features/charts/PriceChart";
import { OhlcChart } from "../features/charts/OhlcChart";
import { IndicatorChart } from "../features/charts/IndicatorChart";
import { IndicatorCards } from "../features/indicators/IndicatorCards";
import { EtfNews } from "../features/etf/EtfNews";
import { EtfFlows } from "../features/etf/EtfFlows";
import { EtfHoldings } from "../features/etf/EtfHoldings";
import { FlowGrid } from "../features/flows/FlowGrid";
import { RiskPanel } from "../features/risk/RiskPanel";
import { PlanSelector } from "../features/settings/PlanSelector";
import { Section } from "../components/Section";
import { Badge } from "../components/Badge";
import FearGreedGauge from "../components/FearGreedGauge";
import { SubscriptionContext } from "../context/SubscriptionContext";
import { APP_BRAND } from "../config/brand";

const symbols = [
  { id: "BTCUSDT", label: "BTC" },
  { id: "ETHUSDT", label: "ETH" },
  { id: "SOLUSDT", label: "SOL" },
];

export function Dashboard() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const subscription = useContext(SubscriptionContext);
  const [fearGreed, setFearGreed] = useState(null);

  useEffect(() => {
    let active = true;
    const loadFearGreed = async () => {
      try {
        const response = await fetch("https://api.alternative.me/fng/?limit=1&format=json");
        const payload = await response.json();
        const item = payload?.data?.[0];
        if (!item || !active) return;
        setFearGreed({
          value: Number(item.value),
          classification: item.value_classification || "Neutral",
          updatedAt: Number(item.timestamp) * 1000,
          source: "alternative.me",
        });
      } catch {
        if (active) setFearGreed(null);
      }
    };
    loadFearGreed();
    const timer = setInterval(loadFearGreed, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);


  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{APP_BRAND}</h1>
          <p className="text-sm text-slate-400">
            Serverless, real-time market desk with indicator overlays and ETF intelligence.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="green">Stable</Badge>
            <Badge tone="blue">Realtime</Badge>
            <Badge tone="amber">Serverless</Badge>
          </div>
          <div className="mt-4">
            <FearGreedGauge
              value={fearGreed?.value}
              classification={fearGreed?.classification}
              className="w-[260px]"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {symbols.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSymbol(item.id)}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                symbol === item.id ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
          <Badge tone="amber">{subscription.plan.toUpperCase()}</Badge>
        </div>
      </header>

      <Section
        title="Market Overview"
        subtitle="Null-safe chart stack wired to Vercel serverless functions with cascading fallbacks."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PriceChart symbol={symbol} />
          <OhlcChart symbol={symbol} />
        </div>
      </Section>

      <Section
        title="Indicator Engine V3+"
        subtitle="RSI, MACD, STOCH, EMA, ATR, Trend Strength, Volatility, Smart Money Flow"
      >
        <IndicatorCards symbol={symbol} />
        <IndicatorChart symbol={symbol} interval="1h" />
      </Section>

      <Section title="ETF Intelligence" subtitle="News, flows, and holdings with mobile-safe layout.">
        <div className="grid gap-4 md:grid-cols-3">
          <EtfNews />
          <EtfFlows />
          <EtfHoldings />
        </div>
      </Section>

      <Section title="Risk & Smart Money" subtitle="Correlations, flows, and safety rails.">
        <div className="grid gap-4 md:grid-cols-2">
          <RiskPanel />
          <FlowGrid />
        </div>
      </Section>

      <Section title="Access & Plans" subtitle="Trial is always tracked; upgrade toggles features.">
        <PlanSelector />
      </Section>
    </div>
  );
}
