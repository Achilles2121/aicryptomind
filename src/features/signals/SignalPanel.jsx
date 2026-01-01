import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Activity, AlertTriangle, Gauge, PlugZap, RefreshCw, Shield, Signal, TrendingUp } from "lucide-react";
import LockedCard from "../../components/LockedCard";
import CryptoEduChatCard from "../../components/CryptoEduChatCard";
import VolatilityGauge from "../../components/VolatilityGauge";
import VolatilityAlerts from "../../components/VolatilityAlerts";
import BacktestDashboard from "../../components/BacktestDashboard";
import { buildBacktestSignals } from "../../lib/signalsV2";
import { computeVolatilityScore } from "../../lib/strategyEngineV3";
import { usePriceStore } from "../../stores/usePriceStore";
import { useUnifiedPrice } from "../../hooks/useUnifiedPrice";
import { safeFixed } from "../../lib/safeFixed";

function SignalPanel({
  selectedAssetId,
  timeFrame,
  t,
  lang,
  effectiveTier,
  trialActive,
  trialEnd,
  trialExpired,
  showCryptoEduChat,
  chatContext,
  indicators,
  indicatorSeries,
  aiSignal,
  visionSignal,
  proSignal,
  backtestStats,
  volatilityData,
  loadPrice,
  loadOHLC,
  loadFearGreed,
  lastError,
  sourceHealth,
  apiHealth,
  dataSourceList,
  apiSources,
  apiStatuses,
  loadApiPlaybook,
  priceValue,
  Card,
  IndicatorBadge,
  Paywall,
  formatUSD,
}) {
  const storeSelectedAssetId = usePriceStore((state) => state.selectedAssetId);
  const resolvedAssetId = selectedAssetId ?? storeSelectedAssetId;
  const priceAsset = usePriceStore((state) => state.selectPriceAsset(resolvedAssetId));
  
  // SINGLE SOURCE OF TRUTH - Use unified price for consistency
  const unifiedPrice = useUnifiedPrice(resolvedAssetId, priceValue);
  const displayPrice = unifiedPrice.lastPrice;
  
  const wsStatus = priceAsset.wsStatus;
  const wsAttempts = priceAsset.wsAttempts;

  const signalBadges = useMemo(
    () => [
      {
        label: "RSI",
        value: indicators.rsi ? safeFixed(indicators.rsi, 1) : "-",
        intent: indicators.rsi && (indicators.rsi < 30 || indicators.rsi > 70) ? "warn" : "ok",
      },
      {
        label: "MACD",
        value:
          indicators.macd && indicators.signal
            ? indicators.macd - indicators.signal >= 0
              ? "Bullish"
              : "Bearish"
            : "-",
        intent:
          indicators.macd && indicators.signal
            ? indicators.macd - indicators.signal >= 0
              ? "ok"
              : "warn"
            : "neutral",
      },
      { label: "Bollinger", value: "20 / 2 std", intent: "neutral" },
    ],
    [indicators]
  );

  const healthColor = (status) => {
    if (status === "ok") return "text-emerald-300";
    if (status === "error") return "text-red-300";
    if (status === "disabled") return "text-slate-400";
    if (status === "degraded") return "text-amber-300";
    return "text-amber-300";
  };

  const formatHealthLabel = (status) => {
    switch (status) {
      case "ok":
        return "OK";
      case "error":
        return "Fehler";
      case "cors":
        return "CORS";
      case "disabled":
        return "Disabled";
      case "degraded":
        return "Degraded";
      default:
        return "Warn";
    }
  };

  const dataSourceStatuses = useMemo(
    () =>
      (dataSourceList || [])
        .map((cfg) => {
          const entry = sourceHealth?.[cfg.key] || null;
          const fallbackStatus = cfg.enabled ? "ok" : "disabled";
          return {
            key: cfg.key,
            label: cfg.label,
            status: entry?.status || fallbackStatus,
            message: entry?.message || (cfg.enabled ? "" : "Quelle deaktiviert"),
          };
        })
        .sort((a, b) => {
          const order = { ok: 0, warn: 1, degraded: 1, fallback: 1, error: 2, cors: 2, disabled: 3 };
          return (order[a.status] ?? 4) - (order[b.status] ?? 4);
        }),
    [dataSourceList, sourceHealth]
  );

  const runtimeHealthEntries = useMemo(
    () =>
      Object.entries(apiHealth || {}).filter((entry) => {
        const key = entry[0];
        return !Object.prototype.hasOwnProperty.call(Object.fromEntries((dataSourceList || []).map((cfg) => [cfg.key, true])), key);
      }),
    [apiHealth, dataSourceList]
  );

  const lastPoint = useMemo(() => (indicatorSeries.length > 0 ? indicatorSeries[indicatorSeries.length - 1] : null), [indicatorSeries]);
  const lastClose = lastPoint?.close ?? null;
  const volatilityScore = useMemo(() => computeVolatilityScore(lastPoint?.atrPct), [lastPoint?.atrPct]);
  const fallbackSignalCount = useMemo(() => {
    if (backtestStats?.trades) return null;
    if (!indicatorSeries.length) return null;
    return buildBacktestSignals(indicatorSeries).length;
  }, [backtestStats?.trades, indicatorSeries]);

  return (
    <div
      className="flex flex-col gap-4"
      data-timeframe={timeFrame ?? ""}
      data-volatility-score={Number.isFinite(volatilityScore) ? safeFixed(volatilityScore, 2) : undefined}
      data-backtest-signals={Number.isFinite(fallbackSignalCount) ? fallbackSignalCount : undefined}
    >
      <Card title={t("signals")} icon={Signal}>
        <div className="flex flex-wrap gap-2">
          {signalBadges.map((s) => (
            <IndicatorBadge key={s.label} label={s.label} value={s.value} intent={s.intent} />
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-slate-800/60 p-3 text-sm text-slate-300">
          <div className="flex items-center gap-2 text-emerald-300">
            <AlertTriangle className="h-4 w-4" />
            {t("signalsLive")}
          </div>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            <li>{t("signalsOversold")}</li>
            <li>{t("signalsOverbought")}</li>
            <li>{t("signalsFallback")}</li>
          </ul>
        </div>
      </Card>

      <Card title={t("systemStatus")} icon={Shield}>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <span>{t("systemWs")}</span>
            <span className={`rounded-full px-2 py-1 text-xs ${wsStatus === "live" ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
              {wsStatus} (Retries {wsAttempts}/5)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("systemCache")}</span>
            <span className="text-slate-100">5 Minuten</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("systemPoll")}</span>
            <span className="text-slate-100">30s</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("systemError")}</span>
            <span className="text-xs text-slate-400">{lastError || t("systemNone")}</span>
          </div>
          <div className="pt-2 space-y-1 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Data Sources</p>
            {dataSourceStatuses.map((item) => (
              <div key={item.key} className="flex items-center justify-between" title={item.message || ""}>
                <span className="text-slate-400">{item.label}</span>
                <span className={`font-semibold ${healthColor(item.status)}`}>{formatHealthLabel(item.status)}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 space-y-1 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Service Modules</p>
            {runtimeHealthEntries
              .filter(([, val]) => val && typeof val === "object" && "status" in val)
              .map(([key, val]) => (
                <div key={key} className="flex items-center justify-between" title={val?.message || ""}>
                  <span className="uppercase text-slate-400">{key}</span>
                  <span className={`font-semibold ${healthColor(val.status)}`}>{formatHealthLabel(val.status)}</span>
                </div>
              ))}
          </div>
        </div>
      </Card>

      <Card title={t("manualControls")} icon={PlugZap}>
        <div className="flex flex-col gap-2 text-sm text-slate-300">
          <button onClick={loadPrice} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
            <span>{t("manualPrice")}</span>
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={loadOHLC} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
            <span>{t("manualKraken")}</span>
            <Activity className="h-4 w-4" />
          </button>
          <button onClick={loadFearGreed} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
            <span>{t("manualFG")}</span>
            <Gauge className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {showCryptoEduChat ? (
        effectiveTier === "elite" ? (
          <CryptoEduChatCard platformContext={chatContext} />
        ) : (
          <LockedCard
            title="Vision AI Assistant"
            requiredTier="elite"
            description="Nur fuer Elite-Mitglieder. Der Vision AI Assistant analysiert Ihre Plattform-Daten in Echtzeit."
          />
        )
      ) : null}

      <Paywall minTier="elite" userTier={effectiveTier} lockText={t("eliteRequired")}>
        <Card title={t("aiSignalTitle")} icon={Signal}>
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-center">
              <span
                className={`rounded-xl px-4 py-2 text-lg font-bold ${
                  aiSignal.action === "Kaufen" || aiSignal.action === "Buy" || aiSignal.action === "High Probability Buy"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : aiSignal.action === "Verkaufen" || aiSignal.action === "Sell"
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}
              >
                {aiSignal.action === "High Probability Buy"
                  ? "HIGH PROB BUY"
                  : aiSignal.action === "Kaufen"
                  ? "ÐY\"^ LONG"
                  : aiSignal.action === "Verkaufen"
                  ? "ÐY\"% SHORT"
                  : "ƒ?ü WARTEN"}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Konfidenz</span>
                <span className={`font-bold ${aiSignal.confidence >= 0.65 ? "text-emerald-300" : aiSignal.confidence >= 0.55 ? "text-amber-300" : "text-slate-400"}`}>
                  {safeFixed(aiSignal.confidence * 100, 0)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    aiSignal.confidence >= 0.65 ? "bg-emerald-500" : aiSignal.confidence >= 0.55 ? "bg-amber-500" : "bg-slate-600"
                  }`}
                  style={{ width: `${Math.min(100, aiSignal.confidence * 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-emerald-400 mb-1">Take Profit</div>
                <div className="text-lg font-bold text-emerald-300">{aiSignal.tp ? formatUSD(aiSignal.tp) : "-"}</div>
                {aiSignal.tp && displayPrice ? (
                  <div className="text-[10px] text-emerald-400/70">+{safeFixed(((aiSignal.tp - displayPrice) / displayPrice) * 100, 1)}%</div>
                ) : null}
              </div>
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-red-400 mb-1">Stop Loss</div>
                <div className="text-lg font-bold text-red-300">{aiSignal.sl ? formatUSD(aiSignal.sl) : "-"}</div>
                {aiSignal.sl && displayPrice ? (
                  <div className="text-[10px] text-red-400/70">-{safeFixed(((displayPrice - aiSignal.sl) / displayPrice) * 100, 1)}%</div>
                ) : null}
              </div>
            </div>

            {aiSignal.tp && aiSignal.sl && displayPrice ? (
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-center text-xs text-slate-300">
                Risiko/Reward: <span className="text-emerald-300 font-semibold">1:{safeFixed((aiSignal.tp - displayPrice) / (displayPrice - aiSignal.sl), 1)}</span>
              </div>
            ) : null}
            <div className="text-[10px] text-slate-500">{aiSignal.reason}</div>
            {visionSignal ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
                <span className="font-semibold text-emerald-300">{visionSignal.label}</span>
                <span className="text-slate-400"> - {visionSignal.reason}</span>
              </div>
            ) : null}
          </div>
        </Card>
      </Paywall>

      <Paywall minTier="pro" userTier={effectiveTier} lockText={t("proRequired")}>
        <Card title="Volatility Engine" icon={Activity}>
          {volatilityData ? (
            <VolatilityGauge volatilityData={volatilityData} lang={lang} />
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="text-xs text-slate-500">{lang === "de" ? "Volatilitaetsdaten werden geladen..." : "Loading volatility data..."}</div>
            </div>
          )}
        </Card>
      </Paywall>

      {volatilityData ? <VolatilityAlerts volatilityData={volatilityData} lang={lang} /> : null}

      <Paywall minTier="elite" userTier={effectiveTier} lockText={t("eliteRequired")}>
        <BacktestDashboard asset={resolvedAssetId} lang={lang} />
      </Paywall>

      <Paywall
        minTier="pro"
        userTier={effectiveTier}
        isTrialActive={trialActive}
        trialEndText={trialActive ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}` : trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
        lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
      >
        <Card title={t("proSignalsTitle")} icon={TrendingUp}>
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Aktion</span>
              <span
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                  proSignal.action === "long" ? "bg-emerald-500/10 text-emerald-200" : proSignal.action === "short" ? "bg-red-500/10 text-red-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                {proSignal.action}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t("setupType")}</span>
              <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-100">{proSignal.setupLabel}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{t("regime")}</span>
              <span
                className={`rounded px-2 py-1 text-[11px] font-semibold ${
                  proSignal.regimeIntent === "ok" ? "bg-emerald-500/10 text-emerald-200" : proSignal.regimeIntent === "warn" ? "bg-red-500/10 text-red-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                {proSignal.regimeLabel}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Reason: <span className="text-slate-200">{proSignal.reason}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Confidence</span>
              <span className="font-semibold text-emerald-300">{safeFixed(proSignal.confidence * 100, 0)}%</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span>TP</span>
                <span className="font-semibold">{proSignal.tp ? formatUSD(proSignal.tp) : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>SL</span>
                <span className="font-semibold">{proSignal.sl ? formatUSD(proSignal.sl) : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("rrLabel")}</span>
                <span className="font-semibold">
                  {proSignal.tp && proSignal.sl && lastClose
                    ? safeFixed((proSignal.action === "long" ? proSignal.tp - lastClose : lastClose - proSignal.tp) / (proSignal.action === "long" ? lastClose - proSignal.sl : proSignal.sl - lastClose || 1), 2)
                    : "-"}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                <span>ATR%: {proSignal.meta?.atrPct ? safeFixed(proSignal.meta.atrPct, 2) : "-"}</span>
                <span>MACD ?: {proSignal.meta?.macdDiff ? safeFixed(proSignal.meta.macdDiff, 2) : "-"}</span>
                <span>VWAP: {proSignal.meta?.vwap ? formatUSD(proSignal.meta.vwap) : "-"}</span>
                <span>Vol Spike: {proSignal.meta?.volSpike ? "Ja" : "Nein"}</span>
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-[11px] text-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t("checks")}:</span>
                <span className="text-slate-300">{safeFixed(proSignal.score * 100, 0)}%</span>
              </div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.trend === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.trend === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"}`}>
                  {t("checkTrend")}
                </span>
                <span
                  className={`rounded px-2 py-1 text-[10px] font-semibold ${
                    proSignal.meta?.checks?.momentum === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.momentum === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {t("checkMomentum")}
                </span>
                <span
                  className={`rounded px-2 py-1 text-[10px] font-semibold ${
                    proSignal.meta?.checks?.flow === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.flow === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {t("checkFlow")}
                </span>
                <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.vol === "ok" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-200"}`}>
                  {t("checkVol")}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </Paywall>
      {effectiveTier === "basic" ? (
        <LockedCard title={t("backtestTitle")} requiredTier="pro" description="Schalte Pro frei, um historische Trefferquote und Risiko-Kennzahlen zu sehen." />
      ) : (
        <Card title={t("backtestTitle")} icon={TrendingUp}>
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>{t("backtestTrades")}</span>
              <span className="font-semibold">{backtestStats.trades}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("backtestWinRate")}</span>
              <span className="font-semibold text-emerald-300 whitespace-nowrap overflow-hidden text-ellipsis">
                {backtestStats.winRate !== null ? `${safeFixed(backtestStats.winRate, 0)}%` : "-"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("backtestWinsLosses")}</span>
              <span className="font-semibold whitespace-nowrap">
                {backtestStats.wins} / {backtestStats.losses}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("backtestAvgRR")}</span>
              <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                {backtestStats.avgRR !== null ? safeFixed(backtestStats.avgRR, 2) : "-"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{t("backtestNote")}</p>
          </div>
        </Card>
      )}
      <Paywall
        minTier="pro"
        userTier={effectiveTier}
        isTrialActive={trialActive}
        trialEndText={trialActive ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}` : trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
        lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
      >
        <Card
          title={t("apiPlaybook")}
          icon={PlugZap}
          actions={
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Limits &amp; Snippets</span>
              <button onClick={loadApiPlaybook} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-500/60">
                {t("liveCheck")}
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(apiSources || []).map((api) => {
              const status = apiStatuses?.[api.name]?.state || "idle";
              const note = apiStatuses?.[api.name]?.note || "";
              const dataPoint = apiStatuses?.[api.name]?.data || "";
              const tone =
                status === "ok"
                  ? "bg-emerald-500/15 text-emerald-200"
                  : status === "auth"
                  ? "bg-amber-500/15 text-amber-200"
                  : status === "fail"
                  ? "bg-red-500/15 text-red-200"
                  : "bg-slate-800 text-slate-200";
              const label = status === "ok" ? t("liveLabel") : status === "auth" ? t("keyNeeded") : status === "fail" ? t("errorLabel") : "--";
              return (
                <div key={api.name} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-100">{api.name}</span>
                      <span className="text-[11px] text-slate-400">{api.limit}</span>
                    </div>
                    {!(api.name === "HuggingFace" && status === "auth") ? (
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-2 py-[3px] text-[10px] font-semibold whitespace-nowrap max-w-[72px] overflow-hidden text-ellipsis text-center ${tone}`}
                        title={label}
                      >
                        {label}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-300 leading-snug">{api.desc}</p>
                  {status === "fail" ? (
                    <div className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-red-400">{note || t("unavailable")}</div>
                  ) : status === "auth" ? (
                    <div className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-amber-300">{note || t("apiKeyNeeded")}</div>
                  ) : (
                    <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2 text-sm text-slate-200">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">{t("liveData")}</div>
                      <div className="text-sm text-slate-200 break-words">{note || t("reachable")}</div>
                      {dataPoint ? <div className="text-xs text-slate-400 break-words">{dataPoint}</div> : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </Paywall>
    </div>
  );
}

SignalPanel.propTypes = {
  selectedAssetId: PropTypes.string,
  timeFrame: PropTypes.string,
  t: PropTypes.func.isRequired,
  lang: PropTypes.string.isRequired,
  effectiveTier: PropTypes.string.isRequired,
  trialActive: PropTypes.bool.isRequired,
  trialEnd: PropTypes.string,
  trialExpired: PropTypes.bool.isRequired,
  showCryptoEduChat: PropTypes.bool.isRequired,
  chatContext: PropTypes.object,
  indicators: PropTypes.shape({
    rsi: PropTypes.number,
    macd: PropTypes.number,
    signal: PropTypes.number,
  }).isRequired,
  indicatorSeries: PropTypes.arrayOf(PropTypes.object).isRequired,
  aiSignal: PropTypes.shape({
    action: PropTypes.string,
    confidence: PropTypes.number,
    tp: PropTypes.number,
    sl: PropTypes.number,
    reason: PropTypes.string,
  }).isRequired,
  visionSignal: PropTypes.shape({
    label: PropTypes.string,
    reason: PropTypes.string,
    meta: PropTypes.object,
  }),
  proSignal: PropTypes.shape({
    action: PropTypes.string,
    confidence: PropTypes.number,
    tp: PropTypes.number,
    sl: PropTypes.number,
    reason: PropTypes.string,
    score: PropTypes.number,
    setupLabel: PropTypes.string,
    regimeLabel: PropTypes.string,
    regimeIntent: PropTypes.string,
    meta: PropTypes.object,
  }).isRequired,
  backtestStats: PropTypes.object.isRequired,
  volatilityData: PropTypes.object,
  loadPrice: PropTypes.func.isRequired,
  loadOHLC: PropTypes.func.isRequired,
  loadFearGreed: PropTypes.func.isRequired,
  lastError: PropTypes.string,
  sourceHealth: PropTypes.object,
  apiHealth: PropTypes.object,
  dataSourceList: PropTypes.arrayOf(PropTypes.object),
  apiSources: PropTypes.arrayOf(PropTypes.object),
  apiStatuses: PropTypes.object,
  loadApiPlaybook: PropTypes.func.isRequired,
  priceValue: PropTypes.number,
  Card: PropTypes.elementType.isRequired,
  IndicatorBadge: PropTypes.elementType.isRequired,
  Paywall: PropTypes.elementType.isRequired,
  formatUSD: PropTypes.func.isRequired,
};

export default SignalPanel;
