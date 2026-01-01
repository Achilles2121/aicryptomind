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
import { DASHBOARD_ASSETS, ASSET_CLASS_LABELS } from "../config/assets";

// Group assets by class for organized display
const assetGroups = {
  crypto: DASHBOARD_ASSETS.filter(a => a.assetClass === "crypto"),
  commodity: DASHBOARD_ASSETS.filter(a => a.assetClass === "commodity"),
  forex: DASHBOARD_ASSETS.filter(a => a.assetClass === "forex"),
};

// Color mappings for asset classes
const TAB_COLORS = {
  crypto: "bg-emerald-600 text-white",
  commodity: "bg-amber-600 text-white",
  forex: "bg-blue-600 text-white",
};
const BUTTON_COLORS = {
  crypto: "bg-emerald-500 text-white",
  commodity: "bg-amber-500 text-white",
  forex: "bg-blue-500 text-white",
};

export function Dashboard() {
  const [symbol, setSymbol] = useState("BTCUSD");
  const [activeClass, setActiveClass] = useState("crypto");
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
        <div className="flex flex-col items-start gap-3">
          {/* Asset Class Tabs */}
          <div className="flex gap-2">
            {Object.keys(assetGroups).map((cls) => {
              const isActive = activeClass === cls;
              const tabClass = isActive ? TAB_COLORS[cls] : "bg-slate-700 text-slate-300 hover:bg-slate-600";
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setActiveClass(cls)}
                  className={`rounded-md px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${tabClass}`}
                >
                  {ASSET_CLASS_LABELS[cls] || cls}
                </button>
              );
            })}
            <Badge tone="amber">{subscription.plan.toUpperCase()}</Badge>
          </div>
          
          {/* Asset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {assetGroups[activeClass]?.map((item) => {
              const isSelected = symbol === item.id;
              const btnClass = isSelected ? BUTTON_COLORS[activeClass] : "bg-slate-800 text-slate-200 hover:bg-slate-700";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSymbol(item.id)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${btnClass}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
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
