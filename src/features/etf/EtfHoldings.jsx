import React from "react";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";
import { formatPercent } from "../../lib/formatters";

export function EtfHoldings({ fund = "ELITE" }) {
  const { data, loading, error } = useDataFetch(
    () => api.get("/etf/holdings", { symbol: fund }),
    [fund],
    { initialData: { holdings: [] }, refreshMs: 60_000 }
  );

  return (
    <Card title={`${fund} Holdings`}>
      {loading ? <Skeleton className="h-24 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(data?.holdings ?? []).map((holding) => (
            <div
              key={holding.symbol}
              className="rounded border border-slate-800/60 bg-slate-900/50 p-2"
            >
              <p className="font-semibold text-white">{holding.symbol}</p>
              <p className="text-xs text-slate-400">Weight {formatPercent(holding.weight / 100, 2)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
