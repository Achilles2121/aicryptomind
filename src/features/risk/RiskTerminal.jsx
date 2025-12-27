import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Shield, Target } from "lucide-react";
import { computePositionSize, computeStopAndTarget } from "../../lib/riskEngine";
import { usePriceStore } from "../../stores/usePriceStore";

const toNumber = (value) => {
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(num) ? num : null;
};

const formatUSD = (value) => {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
};

const formatPct = (value) => {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
};

const CardShell = ({ title, icon: Icon, children, actions }) => (
  <div className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg shadow-black/30 backdrop-blur">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-200">
        {Icon ? <Icon className="h-5 w-5 text-emerald-400" /> : null}
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
    {children}
  </div>
);

CardShell.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  actions: PropTypes.node,
};

function RiskTerminal({ selectedAssetId, balance }) {
  const storeSelectedAssetId = usePriceStore((state) => state.selectedAssetId);
  const resolvedAssetId = selectedAssetId ?? storeSelectedAssetId;
  const priceAsset = usePriceStore((state) => state.selectPriceAsset(resolvedAssetId));
  const livePrice = priceAsset.livePrice;

  const [equity, setEquity] = useState(() => {
    if (Number.isFinite(balance)) return balance;
    const stored = Number(localStorage.getItem("risk:balance"));
    return Number.isFinite(stored) ? stored : 10000;
  });
  const [entry, setEntry] = useState(null);
  const [direction, setDirection] = useState("long");
  const [riskPct, setRiskPct] = useState(1);
  const [tpPct, setTpPct] = useState(4);
  const [slPct, setSlPct] = useState(3);
  const [leverage, setLeverage] = useState(5);
  const [quantity, setQuantity] = useState(0);
  const [aiNote, setAiNote] = useState("");

  useEffect(() => {
    if (Number.isFinite(balance) && balance !== equity) setEquity(balance);
  }, [balance, equity]);

  useEffect(() => {
    if (!Number.isFinite(entry) && Number.isFinite(livePrice)) {
      // Only auto-fill entry if it's currently null/empty
      setEntry(livePrice);
    }
  }, [entry, livePrice]);

  useEffect(() => {
    if (Number.isFinite(equity)) {
      localStorage.setItem("risk:balance", String(equity));
    }
  }, [equity]);

  const entryPrice = toNumber(entry);
  const riskPctValue = toNumber(riskPct);
  const tpPctValue = toNumber(tpPct);
  const slPctValue = toNumber(slPct);
  const leverageValue = toNumber(leverage) ?? 1;
  const quantityValue = toNumber(quantity) ?? 0;

  const tpPrice = useMemo(() => {
    if (!entryPrice || !tpPctValue) return null;
    return direction === "long"
      ? entryPrice * (1 + tpPctValue / 100)
      : entryPrice * (1 - tpPctValue / 100);
  }, [direction, entryPrice, tpPctValue]);

  const slPrice = useMemo(() => {
    if (!entryPrice || !slPctValue) return null;
    return direction === "long"
      ? entryPrice * (1 - slPctValue / 100)
      : entryPrice * (1 + slPctValue / 100);
  }, [direction, entryPrice, slPctValue]);

  const profit = useMemo(() => {
    if (!entryPrice || !tpPrice) return null;
    const delta = direction === "long" ? tpPrice - entryPrice : entryPrice - tpPrice;
    return delta * quantityValue;
  }, [direction, entryPrice, tpPrice, quantityValue]);

  const loss = useMemo(() => {
    if (!entryPrice || !slPrice) return null;
    const delta = direction === "long" ? entryPrice - slPrice : slPrice - entryPrice;
    return delta * quantityValue;
  }, [direction, entryPrice, slPrice, quantityValue]);

  const rr = profit !== null && loss !== null && loss !== 0 ? profit / loss : null;

  const suggestedSize = useMemo(() => {
    const eq = toNumber(equity);
    const pct = toNumber(riskPctValue);
    if (!eq || !pct || !entryPrice || !slPrice) return null;
    return computePositionSize({ equity: eq, riskPct: pct / 100, entry: entryPrice, sl: slPrice });
  }, [equity, riskPctValue, entryPrice, slPrice]);

  const notional = entryPrice && quantityValue ? entryPrice * quantityValue : null;
  const marginRequired = notional ? notional / Math.max(1, leverageValue) : null;
  const marginOk = Number.isFinite(marginRequired) && Number.isFinite(equity) ? marginRequired <= equity : null;

  const suggestStops = () => {
    const price = entryPrice ?? livePrice;
    if (!price) return;
    const result = computeStopAndTarget({
      entry: price,
      direction,
      atrPct: null,
      regimeLabel: "default",
      setupType: "trend",
    });
    if (result.tp && result.sl) {
      const tp = direction === "long" ? ((result.tp - price) / price) * 100 : ((price - result.tp) / price) * 100;
      const sl = direction === "long" ? ((price - result.sl) / price) * 100 : ((result.sl - price) / price) * 100;
      setTpPct(Number(tp.toFixed(2)));
      setSlPct(Number(sl.toFixed(2)));
      setAiNote("ATR-based stops loaded.");
      if (!Number.isFinite(entryPrice)) setEntry(price);
    }
  };

  return (
    <CardShell
      title="Risk Terminal"
      icon={Shield}
      actions={
        <span className={`rounded-full px-2 py-1 text-[11px] ${marginOk === false ? "bg-red-500/15 text-red-200" : "bg-emerald-500/15 text-emerald-200"}`}>
          {marginOk === false ? "Margin Low" : "Margin OK"}
        </span>
      }
    >
      <div className="space-y-4 text-sm text-slate-200">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Balance (USD)
            <input
              type="number"
              value={Number.isFinite(equity) ? equity : ""}
              onChange={(e) => setEquity(e.target.value ? Number(e.target.value) : 0)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              placeholder="10000"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Direction
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Entry Price
            <input
              type="number"
              value={entryPrice ?? ""}
              onChange={(e) => setEntry(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              placeholder={livePrice ? String(livePrice) : "62000"}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Risk %
            <input
              type="number"
              value={riskPctValue ?? ""}
              onChange={(e) => setRiskPct(e.target.value ? Number(e.target.value) : 0)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              placeholder="1"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            TP %
            <input
              type="number"
              value={tpPctValue ?? ""}
              onChange={(e) => setTpPct(e.target.value ? Number(e.target.value) : 0)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              placeholder="4"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            SL %
            <input
              type="number"
              value={slPctValue ?? ""}
              onChange={(e) => setSlPct(e.target.value ? Number(e.target.value) : 0)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              placeholder="3"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Leverage
            <input
              type="number"
              value={leverageValue ?? ""}
              onChange={(e) => setLeverage(e.target.value ? Number(e.target.value) : 1)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              placeholder="5"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Quantity
            <input
              type="number"
              value={quantityValue ?? ""}
              onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : 0)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
              placeholder="1"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={suggestStops}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            Auto Stops
            <Target className="h-4 w-4" />
          </button>
          {aiNote ? <span className="text-xs text-emerald-300">{aiNote}</span> : null}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
          <div className="flex justify-between">
            <span>TP Price</span>
            <span className="font-semibold">{formatUSD(tpPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span>SL Price</span>
            <span className="font-semibold">{formatUSD(slPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span>Profit @ TP</span>
            <span className="font-semibold text-emerald-300">{profit !== null ? formatUSD(profit) : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Loss @ SL</span>
            <span className="font-semibold text-red-300">{loss !== null ? formatUSD(-loss) : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Risk/Reward</span>
            <span className="font-semibold">{rr !== null ? rr.toFixed(2) : "-"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
            <div className="flex justify-between">
              <span>Suggested Size</span>
              <span className="font-semibold">{suggestedSize ? suggestedSize.toFixed(4) : "-"}</span>
            </div>
            <div className="flex justify-between">
              <span>Risk Budget</span>
              <span className="font-semibold">{formatUSD(Number.isFinite(equity) && riskPctValue ? equity * (riskPctValue / 100) : null)}</span>
            </div>
            <div className="flex justify-between">
              <span>Risk %</span>
              <span className="font-semibold">{formatPct(riskPctValue)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
            <div className="flex justify-between">
              <span>Notional</span>
              <span className="font-semibold">{formatUSD(notional)}</span>
            </div>
            <div className="flex justify-between">
              <span>Margin Req</span>
              <span className={`font-semibold ${marginOk === false ? "text-red-300" : "text-emerald-300"}`}>
                {marginRequired ? formatUSD(marginRequired) : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Margin Status</span>
              <span className={`font-semibold ${marginOk === false ? "text-red-300" : "text-emerald-300"}`}>
                {marginOk === false ? "Insufficient" : "OK"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

RiskTerminal.propTypes = {
  selectedAssetId: PropTypes.string,
  balance: PropTypes.number,
};

export default RiskTerminal;
