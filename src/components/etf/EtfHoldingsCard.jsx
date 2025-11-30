import React from "react";
import PropTypes from "prop-types";
import { TrendingUp } from "lucide-react";

const formatUSD = (val) => (val === null || val === undefined ? "-" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val));
const formatPct = (val) => (val === null || val === undefined ? "-" : `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`);

const EtfHoldingsCard = ({ holdings, loading, error, lastUpdated }) => {
  return (
    <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg shadow-black/30 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">ETF Holdings</h3>
        </div>
        <span className="text-[11px] text-slate-400">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"}</span>
      </div>
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Lade Holdings...</p> : null}
      {!loading && !holdings.length ? <p className="text-sm text-slate-400">Keine Daten derzeit verfügbar.</p> : null}
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {holdings.map((h) => (
          <div key={h.symbol} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-100">{h.symbol}</span>
              <span className="text-[11px] text-slate-400">{h.provider}</span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>Shares (Daily)</span>
                <span className="font-semibold">{h.shares !== null ? h.shares.toLocaleString() : "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>AUM</span>
                <span className="font-semibold">{formatUSD(h.aumUsd)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>7d Change</span>
                <span className={`font-semibold ${h.change7d >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(h.change7d)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>30d Change</span>
                <span className={`font-semibold ${h.change30d >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(h.change30d)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Market Share</span>
                <span className="font-semibold text-cyan-300">{h.marketShare !== null ? formatPct(h.marketShare) : "-"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

EtfHoldingsCard.propTypes = {
  holdings: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      shares: PropTypes.number,
      aumUsd: PropTypes.number,
      change7d: PropTypes.number,
      change30d: PropTypes.number,
      marketShare: PropTypes.number,
      provider: PropTypes.string,
    })
  ).isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  lastUpdated: PropTypes.string,
};

EtfHoldingsCard.defaultProps = {
  loading: false,
  error: "",
  lastUpdated: "",
};

export default EtfHoldingsCard;
