import React from "react";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";
import { formatCurrency, formatPercent } from "../../lib/formatters";

export function EtfFlows() {
  const { data, loading, error } = useDataFetch(() => api.get("/etf/flows"), [], {
    initialData: { flows: [] },
    refreshMs: 45_000,
  });

  return (
    <Card title="ETF Flows">
      {loading ? <Skeleton className="h-24 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <div className="divide-y divide-slate-800/70">
          {(data?.flows ?? []).map((flow) => (
            <div key={flow.symbol} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-semibold text-white">{flow.symbol}</p>
                <p className="text-xs text-slate-400">Session change</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-300">{formatCurrency(flow.flow, 0)}</p>
                <p className="text-xs text-slate-400">{formatPercent(flow.change / 100, 2)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
