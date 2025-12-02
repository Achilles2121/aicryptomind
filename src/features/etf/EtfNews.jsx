import React from "react";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/formatters";

export function EtfNews() {
  const { data, loading, error } = useDataFetch(() => api.get("/etfNews"), [], {
    initialData: { news: [] },
    refreshMs: 60_000,
  });

  return (
    <Card title="ETF News Desk">
      {loading ? <Skeleton className="h-20 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <ul className="space-y-3">
          {(data?.news ?? []).map((item) => (
            <li key={item.id} className="rounded border border-slate-800/70 p-3">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="text-xs text-slate-400">{item.summary}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span>{item.source}</span>
                <span>•</span>
                <span>{formatDate(item.publishedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
