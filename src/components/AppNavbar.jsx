// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Briefcase, LayoutGrid } from "lucide-react";
import { APP_BRAND } from "../config/brand";
import VisionAILogo from "./VisionAILogo";
import { usePriceStore } from "../stores/usePriceStore";

const navItems = [
  { path: "/", label: "Market", icon: LayoutGrid },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase },
];

const isActivePath = (pathname, target) => {
  if (target === "/") return pathname === "/";
  return pathname.startsWith(target);
};

export default function AppNavbar() {
  const location = useLocation();
  const { assets, selectedAssetId, activeAssetId } = usePriceStore((state) => ({
    assets: state.assets,
    selectedAssetId: state.selectedAssetId,
    activeAssetId: state.activeAssetId,
  }));
  const tradingViewActive = location.pathname.startsWith("/trading");
  const statusAssetId = selectedAssetId || activeAssetId || Object.keys(assets || {})[0];
  const statusAsset = statusAssetId ? assets?.[statusAssetId] : null;
  const wsLive = statusAsset?.wsStatus === "live";
  const rawSource = tradingViewActive ? "tradingview" : (wsLive ? "binance" : (statusAsset?.restProvider || "coingecko"));
  const source = String(rawSource || "coingecko").toLowerCase();
  const statusLabel = wsLive ? "Connected" : statusAsset ? "Connected" : "Disconnected";
  const sourceLabel =
    source === "tradingview"
      ? "TradingView"
      : source === "binance"
      ? "Binance"
      : source === "coincap"
      ? "CoinCap"
      : source === "kraken"
      ? "Kraken"
      : "CoinGecko";
  const statusColor =
    source === "tradingview"
      ? "bg-cyan-400 shadow-cyan-400/60"
      : source === "binance"
      ? "bg-emerald-400 shadow-emerald-400/60"
      : source === "coincap" || source === "kraken"
      ? "bg-cyan-400 shadow-cyan-400/60"
      : "bg-amber-400 shadow-amber-400/60";
  const latencyValue = tradingViewActive
    ? "stream"
    : Number.isFinite(statusAsset?.restLatencyMs)
    ? `${Math.round(statusAsset.restLatencyMs)}ms`
    : "n/a";
  const statusTitle = `Status: ${statusLabel} | Source: ${sourceLabel} | Latency: ${latencyValue}`;

  return (
    <>
      <nav className="sticky top-0 z-40 hidden w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur md:block">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <VisionAILogo className="h-7 w-7 animate-pulse drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]">
              {APP_BRAND}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {navItems.map(({ path, label, icon: Icon }) => {
              const active = isActivePath(location.pathname, path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-emerald-500/15 text-emerald-200" : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            <div className="relative flex items-center" title={statusTitle} aria-label={statusTitle}>
              <span className={`h-2.5 w-2.5 rounded-full animate-pulse shadow-[0_0_12px] ${statusColor}`} />
            </div>
          </div>
        </div>
      </nav>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-around px-4 py-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = isActivePath(location.pathname, path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs transition-colors ${
                  active ? "text-emerald-200" : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-emerald-300" : ""}`} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
