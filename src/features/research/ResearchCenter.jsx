import React, { Suspense, lazy } from "react";
import PropTypes from "prop-types";
import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const EtfHoldingsCard = lazy(() => import("../../components/etf/EtfHoldingsCard"));
const EtfProviderQualityCard = lazy(() => import("../../components/etf/EtfProviderQualityCard"));
const EtfCorrelationCard = lazy(() => import("../../components/etf/EtfCorrelationCard"));

const ETF_SYMBOLS = ["IBIT", "FBTC", "ARKB", "BTCO", "BITB", "HODL"];
const ETF_COLORS = ["#22c55e", "#38bdf8", "#a855f7", "#fbbf24", "#ef4444", "#0ea5e9"];

const buildEtfChartData = (seriesList = []) => {
  const map = {};
  seriesList.forEach((s) => {
    s.points.forEach((p) => {
      const key = p.date;
      if (!map[key]) map[key] = { date: key };
      map[key][s.symbol] = p.netFlowUsd ?? p.flow ?? 0;
    });
  });
  return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
};

function ResearchCenter({
  t,
  etfSelection,
  setEtfSelection,
  etfFlowSeries,
  etfAumLoading,
  etfAumError,
  etfLastUpdated,
  etfHoldings,
  etfHoldingsLoading,
  etfHoldingsError,
  etfHoldingsLastUpdated,
  etfFlows,
  etfFlowsError,
  etfNews,
  etfLoading,
  etfError,
  updateApiHealth,
  Card,
  LazyRender,
  Skeleton,
  formatUSD,
}) {
  return (
    <div className="space-y-4">
      <Card title="ETF Zufluesse" icon={TrendingUp}>
        <div className="space-y-3">
          <Suspense fallback={<div className="text-xs text-slate-400">Laedt ETF Holdings...</div>}>
            <EtfHoldingsCard
              holdings={etfHoldings}
              loading={etfHoldingsLoading}
              error={etfHoldingsError}
              lastUpdated={etfHoldingsLastUpdated}
            />
          </Suspense>
          <div className="flex flex-wrap items-center gap-2">
            {ETF_SYMBOLS.map((sym, idx) => {
              const active = etfSelection.includes(sym);
              return (
                <button
                  key={sym}
                  onClick={() =>
                    setEtfSelection((prev) => (prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym].slice(0, ETF_SYMBOLS.length)))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    active ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-200"
                  }`}
                  style={{ borderColor: active ? ETF_COLORS[idx % ETF_COLORS.length] : undefined }}
                >
                  {sym}
                </button>
              );
            })}
            {etfAumLoading ? <span className="text-xs text-slate-400">Lade...</span> : null}
            {etfAumError ? <span className="text-xs text-amber-300">{etfAumError}</span> : null}
          </div>
          <div className="text-xs text-slate-400">Last updated: {etfLastUpdated ? new Date(etfLastUpdated).toLocaleTimeString() : "-"}</div>
          <LazyRender
            placeholder={
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="h-56 w-full" />
              </div>
            }
          >
            {etfFlowSeries.length > 0 ? (
              <div className="w-full min-w-0" style={{ minHeight: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={buildEtfChartData(etfFlowSeries)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v / 1_000_000).toFixed(1)}M`} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }}
                      labelStyle={{ color: "#e2e8f0" }}
                      formatter={(val, name) => [`${Number(val) >= 0 ? "+" : ""}${Number(val).toLocaleString()}`, name]}
                    />
                    {etfFlowSeries.map((s, idx) => (
                      <Bar
                        key={s.symbol}
                        dataKey={s.symbol}
                        name={s.symbol}
                        fill={ETF_COLORS[idx % ETF_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive
                        opacity={0.9}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{etfAumError || "Daten derzeit nicht verfuegbar"}</p>
            )}
          </LazyRender>
          <div className="grid grid-cols-1 gap-2 text-sm text-slate-200 md:grid-cols-2">
            {etfFlowSeries.map((s, idx) => (
              <div key={s.symbol} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold" style={{ color: ETF_COLORS[idx % ETF_COLORS.length] }}>
                    {s.symbol}
                  </span>
                  <span className="text-xs text-slate-400">{s.provider}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>7d</span>
                  <span className={`font-semibold ${s.sum7dUsd >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(s.sum7dUsd)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>30d</span>
                  <span className={`font-semibold ${s.sum30dUsd >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(s.sum30dUsd)}</span>
                </div>
                <p className="text-[11px] text-slate-500">Updated {s.lastUpdated ? new Date(s.lastUpdated).toLocaleString() : "-"}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Suspense fallback={<div className="text-xs text-slate-400">Laedt Provider-Metriken...</div>}>
        <EtfProviderQualityCard />
      </Suspense>
      <Suspense fallback={<div className="text-xs text-slate-400">Laedt ETF-Korrelationen...</div>}>
        <EtfCorrelationCard onHealthUpdate={updateApiHealth} />
      </Suspense>

      <Card title={t("etfCard")} icon={TrendingUp}>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("netFlowsLabel")}</p>
            {etfFlows.length > 0 ? (
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                {etfFlows.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-3">
                    <p className="text-sm font-semibold text-slate-100 line-clamp-1">{f.name}</p>
                    <p className="text-[11px] text-slate-400">{f.date ? new Date(f.date).toLocaleDateString() : "--"}</p>
                    <p className={`text-sm font-semibold ${f.inflow >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(f.inflow)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">{t("noETFLinks")}</p>
            )}
            {etfFlowsError ? <p className="mt-1 text-xs text-amber-300">{etfFlowsError}</p> : null}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("newsLabel")}</p>
            {etfLoading && etfNews.length === 0 ? <p className="text-sm text-slate-400">{t("loadingETFNews")}</p> : null}
            {etfNews.length > 0 ? (
              <div className="mt-2 space-y-2">
                {etfNews.map((item, idx) => {
                  const ts = item.publishedAt ? new Date(Number(item.publishedAt) || item.publishedAt) : null;
                  return (
                    <a
                      key={`${item.url}-${idx}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 transition hover:border-emerald-600/60 hover:bg-slate-800/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-100 line-clamp-2">{item.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.source || "News"} {ts ? `- ${ts.toLocaleDateString([], { day: "2-digit", month: "short" })} ${ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">View</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : null}
            {!etfLoading && etfNews.length === 0 ? <p className="text-sm text-slate-400">{t("noETFNews")}</p> : null}
            {etfError ? <p className="mt-2 text-xs text-amber-300">{etfError}</p> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

ResearchCenter.propTypes = {
  t: PropTypes.func.isRequired,
  etfSelection: PropTypes.arrayOf(PropTypes.string).isRequired,
  setEtfSelection: PropTypes.func.isRequired,
  etfFlowSeries: PropTypes.arrayOf(PropTypes.object).isRequired,
  etfAumLoading: PropTypes.bool.isRequired,
  etfAumError: PropTypes.string,
  etfLastUpdated: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  etfHoldings: PropTypes.arrayOf(PropTypes.object).isRequired,
  etfHoldingsLoading: PropTypes.bool.isRequired,
  etfHoldingsError: PropTypes.string,
  etfHoldingsLastUpdated: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  etfFlows: PropTypes.arrayOf(PropTypes.object).isRequired,
  etfFlowsError: PropTypes.string,
  etfNews: PropTypes.arrayOf(PropTypes.object).isRequired,
  etfLoading: PropTypes.bool.isRequired,
  etfError: PropTypes.string,
  updateApiHealth: PropTypes.func.isRequired,
  Card: PropTypes.elementType.isRequired,
  LazyRender: PropTypes.elementType.isRequired,
  Skeleton: PropTypes.elementType.isRequired,
  formatUSD: PropTypes.func.isRequired,
};

export default ResearchCenter;
