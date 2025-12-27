// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React from "react";

export default function PortfolioPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="pointer-events-none absolute -right-20 top-0 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
              <span className="text-sm font-semibold text-emerald-200">AI</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Portfolio</p>
              <h1 className="text-3xl font-bold text-white">Coming Soon</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-slate-300">
            Die Portfolio Suite fuer Vision AI Mind wird gerade finalisiert. Hier entsteht das zentrale Control-Center
            fuer Performance, Risiko und Automationen.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Geplante Module</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li className="flex items-start gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-emerald-400" />
                KI-gesteuertes Risikomanagement
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-cyan-400" />
                Copy-Trading Integration
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-emerald-400" />
                Echtzeit-Performance-Tracking
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
