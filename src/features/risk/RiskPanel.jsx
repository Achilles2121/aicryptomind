import React from "react";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";

export function RiskPanel() {
  const { data, loading, error } = useDataFetch(
    async () => {
      try {
        const res = await api.get("/correlations");
        return res;
      } catch (err) {
        return { status: "error", data: [], reason: err?.message || "fetch failed" };
      }
    },
    [],
    {
      initialData: { status: "idle", data: [] },
      refreshMs: 60_000,
    }
  );

  const list = Array.isArray(data?.data) ? data.data : [];
  const hasData = list.length > 0 && data?.status !== "error";
  const unavailable = !hasData || data?.status === "error" || data?.status === "disabled";

  return (
    <Card title="Cross-Asset Correlations">
      {loading ? <Skeleton className="h-20 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        unavailable ? (
          <p className="text-sm text-slate-400">ETF-Korrelationen aktuell nicht verfügbar.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {list.map((row, idx) => {
              const [lhs, rhs] = String(row.pair || "").split("-");
              const corr = Number.isFinite(row.corr30d) ? row.corr30d : Number.isFinite(row.corr7d) ? row.corr7d : null;
              return (
                <div key={row.pair || `${lhs}-${rhs}-${idx}`} className="rounded border border-slate-800/60 p-2">
                  <p className="font-semibold text-white">{lhs || "ETF"} vs {rhs || "Asset"}</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>7d</span>
                      <span
                        className={`font-semibold ${
                          Number.isFinite(row.corr7d) && row.corr7d > 0.4
                            ? "text-emerald-300"
                            : Number.isFinite(row.corr7d) && row.corr7d < -0.2
                            ? "text-red-300"
                            : "text-slate-200"
                        }`}
                      >
                        {Number.isFinite(row.corr7d) ? row.corr7d.toFixed(2) : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>30d</span>
                      <span
                        className={`font-semibold ${
                          Number.isFinite(corr) && corr > 0.4
                            ? "text-emerald-300"
                            : Number.isFinite(corr) && corr < -0.2
                            ? "text-red-300"
                            : "text-slate-200"
                        }`}
                      >
                        {Number.isFinite(row.corr30d) ? row.corr30d.toFixed(2) : "--"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </Card>
  );
}
