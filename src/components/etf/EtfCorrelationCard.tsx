import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Activity } from "lucide-react";
import { fetchEtfCorrelations } from "../../services/etfCorrelations";

const statusColor = (val) => {
  if (val === null || val === undefined) return "text-slate-400";
  if (val >= 0.6) return "text-emerald-300";
  if (val >= 0.2) return "text-emerald-200";
  if (val <= -0.6) return "text-red-400";
  if (val <= -0.2) return "text-red-300";
  return "text-slate-300";
};

const formatCorr = (val) => (val === null || val === undefined ? "N/A" : val.toFixed(2));

const EtfCorrelationCard = ({ onHealthUpdate, onToast }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetchEtfCorrelations(onHealthUpdate, onToast);
    setData(res.data || []);
    setLastUpdated(res.lastUpdated);
    setError(res.error ? "Daten derzeit nicht verfügbar" : "");
    setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const assets = ["BTC", "ETH", "^GSPC", "XAU"];
  const etfs = ["IBIT", "FBTC", "ARKB", "BITB", "HODL"];

  const lookup = (etf, asset) => data.find((d) => d.pair === `${etf}-${asset}`) || {};

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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-200">
          <thead>
            <tr className="text-xs uppercase text-slate-400">
              <th className="py-1 pr-2">ETF</th>
              {assets.map((a) => (
                <th key={a} className="py-1 pr-2">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {etfs.map((e) => (
              <tr key={e} className="border-t border-slate-800">
                <td className="py-2 pr-2 font-semibold">{e}</td>
                {assets.map((a) => {
                  const entry = lookup(e, a);
                  return (
                    <td key={`${e}-${a}`} className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${statusColor(entry.corr30d)}`}>30d: {formatCorr(entry.corr30d)}</span>
                        <span className={`text-[11px] ${statusColor(entry.corr7d)}`}>7d: {formatCorr(entry.corr7d)}</span>
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

EtfCorrelationCard.propTypes = {
  onHealthUpdate: PropTypes.func,
  onToast: PropTypes.func,
};

EtfCorrelationCard.defaultProps = {
  onHealthUpdate: undefined,
  onToast: undefined,
};

export default EtfCorrelationCard;
