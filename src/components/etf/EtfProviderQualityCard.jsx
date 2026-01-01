import React, { useSyncExternalStore } from "react";
import PropTypes from "prop-types";
import { Activity } from "lucide-react";
import { getEtfProviderMetrics, subscribeEtfProviderMetrics } from "../../stores/etfProviderMetrics";
import { safeFixed } from "../../lib/safeFixed";

const statusColor = (status) => (status === "healthy" ? "text-emerald-300" : status === "degraded" ? "text-amber-300" : "text-red-300");

const formatMs = (v) => (v ? `${Math.round(v)} ms` : "-");
const formatPct = (v) => (v || v === 0 ? `${safeFixed(v, 0)}%` : "-");
const formatTime = (ts) => (ts ? new Date(ts).toLocaleTimeString() : "-");

const rows = [
  { key: "fmp", label: "FMP" },
  { key: "sosovalue", label: "SosoValue" },
  { key: "coinstats", label: "CoinStats" },
];

const EtfProviderQualityCard = () => {
  const metrics = useSyncExternalStore(subscribeEtfProviderMetrics, getEtfProviderMetrics, getEtfProviderMetrics);
  return (
    <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg shadow-black/30 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">ETF Provider Quality</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm text-slate-200">
        {rows.map((r) => {
          const m = metrics[r.key] || {};
          return (
            <div key={r.key} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{r.label}</span>
                <span className={`text-xs font-semibold ${statusColor(m.status || "healthy")}`}>{m.status || "healthy"}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Latenz</span>
                  <span className="text-slate-100">{formatMs(m.latencyMs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Success</span>
                  <span className="text-slate-100">{formatPct(m.successRate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fallbacks</span>
                  <span className="text-slate-100">{m.fallbackCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Requests</span>
                  <span className="text-slate-100">{m.requestCount ?? 0}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Letzter Erfolg</span>
                <span>{formatTime(m.lastSuccessAt)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Letzter Fehler</span>
                <span>{formatTime(m.lastErrorAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

EtfProviderQualityCard.propTypes = {
  provider: PropTypes.string,
};

export default EtfProviderQualityCard;
