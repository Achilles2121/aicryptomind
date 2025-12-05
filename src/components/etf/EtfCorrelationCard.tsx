import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { fetchEtfCorrelationsLive } from "../../services/etfCorrelationLive";
import { type ApiHealthUpdateFn, type ToastFn } from "../../lib/safeFetch";
import { setCorrelationCache, type CorrelationPoint } from "./EtfCorrelationHeatmapCard";

const statusColor = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "text-slate-400";
  if (val >= 0.6) return "text-emerald-300";
  if (val >= 0.2) return "text-emerald-200";
  if (val <= -0.6) return "text-red-400";
  if (val <= -0.2) return "text-red-300";
  return "text-slate-300";
};

const formatCorr = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "N/A";
  return Number.isFinite(val) ? val.toFixed(2) : "N/A";
};

interface EtfCorrelationCardProps {
  onHealthUpdate?: ApiHealthUpdateFn;
  onToast?: ToastFn;
}

const EtfCorrelationCard = ({ onHealthUpdate, onToast }: EtfCorrelationCardProps) => {
  const [data, setData] = useState<CorrelationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchEtfCorrelationsLive(onHealthUpdate, onToast);
      setData(res.data || []);
      setLastUpdated(res.lastUpdated);
      setCorrelationCache(res.data || [], res.lastUpdated);
      setError(res.error ? "Daten derzeit nicht verfügbar" : "");
    } catch (err) {
      console.error("etf correlation fetch failed", err);
      setError("Daten derzeit nicht verfügbar");
    } finally {
      setLoading(false);
    }
  }, [onHealthUpdate, onToast]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const assets = ["BTC", "ETH", "^GSPC", "XAU"];
  const etfs = ["IBIT", "FBTC", "ARKB", "BITB", "HODL"];

  const lookup = (etf: string, asset: string) => data.find((d) => d.pair === `${etf}-${asset}`) || null;

  return (
    <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg shadow-black/30 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">ETF Correlations</h3>
        </div>
        <span className="text-[11px] text-slate-400">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"}</span>
      </div>
      {loading ? <p className="text-sm text-slate-400">Lade Korrelationen...</p> : null}
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      {!loading && !error && !data.length ? <p className="text-sm text-slate-400">Keine ETF-Daten verfügbar.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-200">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-1 pr-2">ETF</th>
              {assets.map((asset) => (
                <th key={asset} className="py-1 pr-2">
                  {asset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {etfs.map((etf) => (
              <tr key={etf} className="border-t border-slate-800">
                <td className="py-2 pr-2 font-semibold">{etf}</td>
                {assets.map((asset) => {
                  const entry = lookup(etf, asset);
                  return (
                    <td key={`${etf}-${asset}`} className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${statusColor(entry?.corr30d)}`}>
                          30d: {formatCorr(entry?.corr30d)}
                        </span>
                        <span className={`text-[11px] ${statusColor(entry?.corr7d)}`}>
                          7d: {formatCorr(entry?.corr7d)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EtfCorrelationCard;
