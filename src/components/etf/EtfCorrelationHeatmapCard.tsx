import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import EtfCorrelationCard from "./EtfCorrelationCard";

type CorrelationPoint = {
  pair: string;
  corr7d: number | null;
  corr30d: number | null;
};

type HeatCell = {
  etf: string;
  asset: string;
  value: number | null;
};

const assets = ["BTC", "ETH", "^GSPC", "XAU"];
const etfs = ["IBIT", "FBTC", "ARKB", "BITB", "HODL"];

const colorFor = (val: number | null) => {
  if (val === null || val === undefined) return "bg-slate-800 text-slate-300";
  if (val >= 0.7) return "bg-emerald-500/60 text-emerald-50";
  if (val >= 0.3) return "bg-emerald-500/30 text-emerald-50";
  if (val <= -0.7) return "bg-red-600/70 text-red-50";
  if (val <= -0.3) return "bg-red-500/50 text-red-50";
  return "bg-slate-700 text-slate-100";
};

const formatVal = (v: number | null) => (v === null || v === undefined ? "N/A" : v.toFixed(2));

// helper to reuse data already loaded in EtfCorrelationCard
let lastCorrelationData: CorrelationPoint[] = [];
let lastUpdated: string | null = null;
export const setCorrelationCache = (data: CorrelationPoint[], updated: string) => {
  lastCorrelationData = data;
  lastUpdated = updated;
};

const EtfCorrelationHeatmapCard: React.FC = () => {
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (lastCorrelationData.length) {
      const mapped: HeatCell[] = [];
      etfs.forEach((e) =>
        assets.forEach((a) => {
          const entry = lastCorrelationData.find((p) => p.pair === `${e}-${a}`);
          mapped.push({ etf: e, asset: a, value: entry?.corr7d ?? null });
        })
      );
      setCells(mapped);
      setHasData(true);
    } else {
      setCells([]);
      setHasData(false);
    }
  }, [lastCorrelationData]);

  return (
    <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg shadow-black/30 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">ETF Correlation Heatmap (7d)</h3>
        </div>
        <span className="text-[11px] text-slate-400">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"}</span>
      </div>
      {!hasData ? <p className="text-sm text-slate-400">Noch keine Korrelationsdaten verfügbar</p> : null}
      {hasData ? (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            <div className="grid grid-cols-[100px_repeat(5,minmax(60px,1fr))] gap-1 text-xs text-slate-200">
              <div className="text-slate-400">Asset \\ ETF</div>
              {etfs.map((e) => (
                <div key={e} className="text-center text-slate-400">
                  {e}
                </div>
              ))}
              {assets.map((a) => (
                <React.Fragment key={a}>
                  <div className="text-slate-400 py-1">{a}</div>
                  {etfs.map((e) => {
                    const cell = cells.find((c) => c.asset === a && c.etf === e);
                    return (
                      <div
                        key={`${a}-${e}`}
                        className={`flex items-center justify-center rounded ${colorFor(cell?.value ?? null)} py-2 px-1 text-[11px]`}
                        title={`${e} vs ${a}: ${formatVal(cell?.value ?? null)}`}
                      >
                        {formatVal(cell?.value ?? null)}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EtfCorrelationHeatmapCard;
