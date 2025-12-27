import React, { Suspense, lazy, useMemo } from "react";
import PropTypes from "prop-types";
import { Activity, LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePriceStore } from "../../stores/usePriceStore";

const TradingViewPanel = lazy(() => import("../../components/TradingViewPanel"));

const buildBubbleData = (indicatorSeries = [], assetId = "") => {
  if (!indicatorSeries.length) return [];
  const mapped = indicatorSeries
    .map((row, idx) => {
      const rsiVal = row.rsi;
      if (!Number.isFinite(rsiVal)) return null;
      const bias = rsiVal < 40 ? "buy" : rsiVal > 60 ? "sell" : "neutral";
      if (bias === "neutral") return null;
      const magnitude = Math.min(96, Math.max(52, Math.abs(rsiVal - 50) * 1.8));
      return {
        id: `${row.label}-${idx}`,
        label: `${assetId} ${row.label}`,
        bias,
        rsi: rsiVal,
        size: magnitude,
      };
    })
    .filter(Boolean);
  return mapped.sort((a, b) => Math.abs(b.rsi - 50) - Math.abs(a.rsi - 50)).slice(0, 10);
};

const ChartSection = ({
  selectedMarket,
  timeFrame,
  onTimeFrameChange,
  t,
  indicatorSeries,
  aiSignal,
  priceValue,
  Card,
  LazyRender,
  Skeleton,
  renderLastDot,
  formatUSD,
  variant = "desktop",
}) => {
  const priceAsset = usePriceStore((state) => state.selectPriceAsset(selectedMarket.id));
  const livePrice = priceAsset.livePrice;
  const trades = priceAsset.trades;
  const displayPrice = livePrice ?? priceValue ?? null;
  const tpLevel = aiSignal?.tp ?? null;
  const slLevel = aiSignal?.sl ?? null;

  const fibView = useMemo(() => {
    if (!indicatorSeries.length) {
      return { levels: [], goldenLow: null, goldenHigh: null, current: displayPrice, tp: tpLevel, sl: slLevel, yMin: null, yMax: null };
    }
    const highs = indicatorSeries.map((r) => r.high);
    const lows = indicatorSeries.map((r) => r.low);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow || 1;
    const retracements = [
      { label: "0%", value: maxHigh },
      { label: "23.6%", value: maxHigh - range * 0.236 },
      { label: "38.2%", value: maxHigh - range * 0.382 },
      { label: "50%", value: maxHigh - range * 0.5 },
      { label: "61.8%", value: maxHigh - range * 0.618 },
      { label: "78.6%", value: maxHigh - range * 0.786 },
      { label: "100%", value: minLow },
    ];
    const goldenHigh = maxHigh - range * 0.618;
    const goldenLow = maxHigh - range * 0.786;
    const pad = range * 0.02;
    return {
      levels: retracements,
      goldenLow,
      goldenHigh,
      current: displayPrice,
      tp: tpLevel,
      sl: slLevel,
      yMin: minLow - pad,
      yMax: maxHigh + pad,
    };
  }, [indicatorSeries, displayPrice, tpLevel, slLevel]);

  const lastPoint = useMemo(() => (indicatorSeries.length > 0 ? indicatorSeries[indicatorSeries.length - 1] : null), [indicatorSeries]);
  const lastClose = lastPoint?.close ?? null;
  const tpZone = useMemo(() => {
    if (!tpLevel) return null;
    const pad = tpLevel * 0.0025;
    return { y1: tpLevel - pad, y2: tpLevel + pad };
  }, [tpLevel]);
  const slZone = useMemo(() => {
    if (!slLevel) return null;
    const pad = slLevel * 0.0025;
    return { y1: slLevel - pad, y2: slLevel + pad };
  }, [slLevel]);
  const nearTp = tpLevel && lastClose ? Math.abs(lastClose - tpLevel) / tpLevel <= 0.006 : false;
  const nearSl = slLevel && lastClose ? Math.abs(lastClose - slLevel) / slLevel <= 0.006 : false;

  const bubbleData = useMemo(() => buildBubbleData(indicatorSeries, selectedMarket.id), [indicatorSeries, selectedMarket.id]);

  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const volumeBuckets = useMemo(() => {
    const bucketCount = 24;
    const buckets = [];
    for (let i = bucketCount - 1; i >= 0; i -= 1) {
      const start = now - i * 60 * 1000;
      const end = start + 60 * 1000;
      const tradesInBucket = trades.filter((t) => t.ts >= start && t.ts < end);
      const buy = tradesInBucket.filter((t) => t.side === "buy").reduce((acc, t) => acc + t.usd, 0);
      const sell = tradesInBucket.filter((t) => t.side === "sell").reduce((acc, t) => acc + t.usd, 0);
      buckets.push({
        label: new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        buy,
        sell,
        net: buy - sell,
      });
    }
    return buckets;
  }, [trades]);

  const chartHeight = variant === "mobile" ? 350 : 450;
  const chartHeightClass = variant === "mobile" ? "h-[350px]" : "h-[450px]";
  const technicalHeight = variant === "mobile" ? 250 : 300;
  const showDeepIndicators = variant !== "mobile";
  const bubbleHeightClass = variant === "mobile" ? "h-32" : "h-40";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-widest text-slate-400">Timeframe</span>
        <select
          value={timeFrame}
          onChange={(e) => onTimeFrameChange?.(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
        >
          <option value="15">15m</option>
          <option value="60">1h</option>
          <option value="240">4h</option>
          <option value="1440">1d</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense
            fallback={
              <div className={`${chartHeightClass} flex items-center justify-center bg-slate-900/50 rounded-xl`}>
                <Skeleton className="h-96 w-full" />
              </div>
            }
          >
            <TradingViewPanel
              assetId={selectedMarket.id}
              assetClass={selectedMarket.assetClass}
              timeFrame={timeFrame}
              showTechnicalAnalysis
              chartHeight={chartHeight}
              technicalHeight={technicalHeight}
              theme="dark"
              currentPrice={displayPrice}
              fibLevels={fibView.levels.length > 0 ? Object.fromEntries(fibView.levels.map((l) => [l.label, l.value])) : null}
              tpLevels={tpLevel ? [tpLevel] : []}
              slLevel={slLevel}
              riskReward={tpLevel && slLevel && displayPrice ? Math.abs(tpLevel - displayPrice) / Math.abs(displayPrice - slLevel) : null}
              trendDirection={aiSignal?.direction === "bullish" ? "bullish" : aiSignal?.direction === "bearish" ? "bearish" : null}
              signalStrength={aiSignal?.confidence ? Math.round(aiSignal.confidence / 20) : null}
            />
          </Suspense>

          <div className="mt-4">
            <Card
              title={t("fibMap")}
              icon={LineChartIcon}
              actions={<span className="text-xs text-slate-400">{t("fibGolden")} - TF {timeFrame === "15" ? "15m" : timeFrame === "60" ? "1h" : timeFrame === "240" ? "4h" : "1d"}</span>}
            >
              <LazyRender placeholder={<div className="h-64 flex items-center justify-center"><Skeleton className="h-56 w-full" /></div>}>
                {indicatorSeries.length > 0 ? (
                  <div className="relative w-full min-w-0" style={{ minHeight: 200 }}>
                    {(nearTp || nearSl) && (
                      <div className="absolute right-3 top-3 flex gap-2 text-xs">
                        {nearTp ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-200 pulse-soft">{t("tpAlarm")}</span> : null}
                        {nearSl ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-200 pulse-soft">{t("slAlarm")}</span> : null}
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={indicatorSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <YAxis
                          tick={{ fill: "#94a3b8", fontSize: 10 }}
                          width={80}
                          domain={[fibView.yMin ?? "auto", fibView.yMax ?? "auto"]}
                          tickFormatter={(v) => Math.round(v).toLocaleString()}
                        />
                        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} />
                        {tpZone ? <ReferenceArea y1={tpZone.y1} y2={tpZone.y2} strokeOpacity={0} fill="#22c55e" fillOpacity={0.07} className="glow-band" /> : null}
                        {slZone ? <ReferenceArea y1={slZone.y1} y2={slZone.y2} strokeOpacity={0} fill="#ef4444" fillOpacity={0.07} className="glow-band" /> : null}
                        {fibView.goldenLow && fibView.goldenHigh ? <ReferenceArea y1={fibView.goldenLow} y2={fibView.goldenHigh} strokeOpacity={0} fill="#fbbf24" fillOpacity={0.1} /> : null}
                        {fibView.levels.map((lvl) => (
                          <ReferenceLine key={lvl.label} y={lvl.value} stroke="#475569" strokeDasharray="2 4" label={{ value: lvl.label, position: "insideRight", fill: "#cbd5e1", fontSize: 10 }} />
                        ))}
                        {fibView.tp ? <ReferenceLine y={fibView.tp} stroke="#22c55e" strokeWidth={2} label={{ value: t("fibTp"), position: "insideLeft", fill: "#22c55e", fontSize: 10 }} /> : null}
                        {fibView.sl ? <ReferenceLine y={fibView.sl} stroke="#ef4444" strokeWidth={2} label={{ value: t("fibSl"), position: "insideLeft", fill: "#ef4444", fontSize: 10 }} /> : null}
                        {fibView.current ? <ReferenceLine y={fibView.current} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: t("fibNow"), position: "insideLeft", fill: "#38bdf8", fontSize: 10 }} /> : null}
                        <Line
                          type="monotone"
                          dataKey="close"
                          stroke="#22c55e"
                          dot={renderLastDot(indicatorSeries.length, "#22c55e")}
                          strokeWidth={2}
                          name="Close"
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("loadingFib")}</p>
                )}
              </LazyRender>
            </Card>
          </div>

          <div className="mt-4">
            <Card title={t("cryptoBubbles")} icon={TrendingUp} actions={<span className="text-xs text-slate-400">{t("bubblesTop")}</span>}>
              <LazyRender
                placeholder={
                  <div className={`${bubbleHeightClass} flex items-center justify-center`}>
                    <div className="flex gap-2">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-14 w-14 rounded-full" />
                      <Skeleton className="h-12 w-12 rounded-full" />
                    </div>
                  </div>
                }
              >
                {bubbleData.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 p-2">
                    {bubbleData.map((b) => (
                      <div
                        key={b.id}
                        className={`flex items-center justify-center rounded-full bg-slate-900/80 border aspect-square min-w-[60px] max-w-[100px] mx-auto ${b.bias === "buy" ? "border-emerald-500/60 text-emerald-100" : "border-red-500/60 text-red-100"
                          }`}
                        style={{ width: `${Math.max(60, Math.min(100, b.size))}px`, height: `${Math.max(60, Math.min(100, b.size))}px` }}
                      >
                        <div className="text-center text-[10px] font-semibold leading-tight px-1">
                          <div className="truncate max-w-[80px]">{b.label}</div>
                          <div className="text-[9px] opacity-80">RSI {b.rsi.toFixed(1)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("noBubbles")}</p>
                )}
              </LazyRender>
            </Card>
          </div>
        </div>
      </div>

      {showDeepIndicators ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title={t("rsiChart")} icon={LineChartIcon}>
              <div className="w-full min-w-0" style={{ minHeight: 200 }}>
                {indicatorSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={indicatorSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} minTickGap={20} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} tickCount={5} padding={{ top: 8, bottom: 8 }} tickFormatter={(v) => (Number.isFinite(v) ? v.toFixed(0) : "")} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} />
                      <Line type="monotone" dataKey="rsi" stroke="#22c55e" strokeWidth={2} dot={renderLastDot(indicatorSeries.length, "#22c55e")} name="RSI" isAnimationActive={false} />
                      <Line type="monotone" dataKey={() => 70} stroke="#f59e0b" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey={() => 30} stroke="#f59e0b" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="stochK" stroke="#38bdf8" strokeWidth={1} strokeOpacity={0.7} dot={false} name="%K" isAnimationActive={false} />
                      <Line type="monotone" dataKey="stochD" stroke="#a855f7" strokeWidth={1} strokeOpacity={0.7} dot={false} name="%D" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-400">{t("loadingRSI")}</p>
                )}
              </div>
            </Card>

            <Card title={t("macdChart")} icon={TrendingUp}>
              <div className="w-full min-w-0" style={{ minHeight: 200 }}>
                {indicatorSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={indicatorSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} />
                      <Legend verticalAlign="top" height={24} wrapperStyle={{ color: "#cbd5e1" }} />
                      <Line type="monotone" dataKey="macd" stroke="#22c55e" dot={false} name="MACD" isAnimationActive={false} />
                      <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" dot={false} name="Signal" isAnimationActive={false} />
                      <Bar dataKey="macdHist" fill="#60a5fa" barSize={8} name="Histogram" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-400">{t("loadingMACD")}</p>
                )}
              </div>
            </Card>

            <Card title={t("flowsCard")} icon={Activity}>
              <div className="w-full min-w-0" style={{ minHeight: 200 }}>
                {volumeBuckets.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={volumeBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={70} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} formatter={(v, n) => [formatUSD(v), n]} />
                      <Legend verticalAlign="top" height={24} wrapperStyle={{ color: "#cbd5e1" }} />
                      <Bar dataKey="buy" stackId="vol" fill="#22c55e" barSize={10} name="Buy Vol" isAnimationActive={false} />
                      <Bar dataKey="sell" stackId="vol" fill="#ef4444" barSize={10} name="Sell Vol" isAnimationActive={false} />
                      <Line type="monotone" dataKey="net" stroke="#38bdf8" dot={renderLastDot(volumeBuckets.length, "#38bdf8")} name="Net" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-400">{t("loadingFlows")}</p>
                )}
              </div>
              <div className="mt-3 max-h-28 overflow-y-auto overscroll-contain touch-pan-y rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs text-slate-200">
                {trades.length > 0 ? (
                  trades.map((trade, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-slate-800/60 py-1 last:border-b-0">
                      <span className={`font-semibold ${trade.side === "buy" ? "text-emerald-300" : "text-red-300"}`}>
                        {trade.side === "buy" ? t("buyLabel") : t("sellLabel")}
                      </span>
                      <span>{formatUSD(trade.usd)}</span>
                      <span className="text-slate-400">{new Date(trade.ts).toLocaleTimeString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">{t("waitingTrades")}</p>
                )}
              </div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title={t("trendStoch")} icon={TrendingUp}>
              <div className="h-40 flex flex-col justify-center">
                {indicatorSeries.length > 0 ? (
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Stoch RSI</span>
                      <span className="font-semibold text-emerald-300">
                        {indicatorSeries.at(-1)?.stochPriceK ? indicatorSeries.at(-1).stochPriceK.toFixed(1) : "-"} /{" "}
                        {indicatorSeries.at(-1)?.stochPriceD ? indicatorSeries.at(-1).stochPriceD.toFixed(1) : "-"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {indicatorSeries.at(-1)?.stochPriceK && indicatorSeries.at(-1)?.stochPriceD
                        ? indicatorSeries.at(-1).stochPriceK > indicatorSeries.at(-1).stochPriceD
                          ? "Bullish crossover"
                          : "Bearish crossover"
                        : "N/A"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("loadingStoch")}</p>
                )}
              </div>
            </Card>

            <Card title={t("cciCard")} icon={TrendingUp}>
              <div className="h-40 flex flex-col justify-center">
                {indicatorSeries.length > 0 ? (
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>CCI</span>
                      <span className={`font-semibold ${Number(indicatorSeries.at(-1)?.cci) > 100 ? "text-emerald-300" : Number(indicatorSeries.at(-1)?.cci) < -100 ? "text-red-300" : "text-slate-100"}`}>
                        {indicatorSeries.at(-1)?.cci ? indicatorSeries.at(-1).cci.toFixed(1) : "-"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">+100 overbought, -100 oversold</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("loadingCCI")}</p>
                )}
              </div>
            </Card>

            <Card title={t("volatilityCard")} icon={TrendingUp}>
              <div className="h-40 flex flex-col justify-center">
                {indicatorSeries.length > 0 ? (
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>ATR%</span>
                      <span className="font-semibold text-emerald-300">
                        {indicatorSeries.at(-1)?.atrPct ? indicatorSeries.at(-1).atrPct.toFixed(2) : "-"}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">Higher = wider SL/TP</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("loadingATR")}</p>
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
};

ChartSection.propTypes = {
  selectedMarket: PropTypes.shape({
    id: PropTypes.string.isRequired,
    assetClass: PropTypes.string,
  }).isRequired,
  timeFrame: PropTypes.string.isRequired,
  onTimeFrameChange: PropTypes.func,
  t: PropTypes.func.isRequired,
  indicatorSeries: PropTypes.arrayOf(PropTypes.object).isRequired,
  aiSignal: PropTypes.object,
  priceValue: PropTypes.number,
  Card: PropTypes.elementType.isRequired,
  LazyRender: PropTypes.elementType.isRequired,
  Skeleton: PropTypes.elementType.isRequired,
  renderLastDot: PropTypes.func.isRequired,
  formatUSD: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(["desktop", "mobile"]),
};

export default ChartSection;
