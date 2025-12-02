import React from "react";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";
import { formatCurrency, formatPercent } from "../../lib/formatters";

export function FlowGrid() {
  const { data, loading, error } = useDataFetch(() => api.get("/etfFlows"), [], {
    initialData: { flows: [] },
    refreshMs: 30_000,
  });

  return (
    <Card title="Smart Money Flow">
      {loading ? <Skeleton className="h-24 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {(data?.flows ?? []).map((flow) => (
            <div
              key={flow.symbol}
              className="rounded-lg border border-slate-800/60 bg-slate-900/50 p-3 text-sm"
            >
              <p className="font-semibold text-white">{flow.symbol}</p>
              <p className="text-slate-300">{formatCurrency(flow.flow, 0)}</p>
              <p
                className={`text-xs ${
                  flow.change >= 0 ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {formatPercent(flow.change / 100, 2)} today
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
