import React from "react";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";

export function RiskPanel() {
  const { data, loading, error } = useDataFetch(() => api.get("/correlations"), [], {
    initialData: { correlations: {} },
    refreshMs: 60_000,
  });

  const correlations = data?.correlations ?? {};

  return (
    <Card title="Cross-Asset Correlations">
      {loading ? <Skeleton className="h-20 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <div className="space-y-2 text-sm">
          {Object.entries(correlations).map(([asset, peers]) => (
            <div key={asset} className="rounded border border-slate-800/60 p-2">
              <p className="font-semibold text-white">{asset}</p>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-300">
                {Object.entries(peers).map(([peer, value]) => (
                  <div key={peer} className="flex items-center justify-between">
                    <span>{peer}</span>
                    <span
                      className={`font-semibold ${
                        value > 0.4 ? "text-emerald-300" : value < -0.2 ? "text-red-300" : "text-slate-200"
                      }`}
                    >
                      {value.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
