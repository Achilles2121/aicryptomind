import { fetchCoinstatsNews } from "../_lib/providers/coinstats.js";
import { fetchEtfNews } from "../_lib/providers/fmp.js";
import { jsonResponse } from "../_lib/http.js";
import { createHealthTracker } from "../_lib/health.js";

export const config = { runtime: "edge" };

const isAbortError = (err) => {
  const message = (err?.message || "").toLowerCase();
  return err?.name === "AbortError" || message.includes("abort") || message.includes("timeout");
};

const buildEnvelope = (payload, status = 200) =>
  jsonResponse(
    {
      statusCode: status,
      ...payload,
    },
    200
  );

const normalizeError = (error) => {
  const statusCode = isAbortError(error) ? 504 : 502;
  return {
    statusCode,
    message: error?.message || "ETF news unavailable",
    hint: statusCode === 504 ? "Provider timeout or aborted request" : "Provider unavailable",
  };
};

const normalizeNews = (rows = []) =>
  rows
    .map((row) => ({
      title: row?.title || "Untitled",
      source: row?.source || row?.site || row?.symbol || "News",
      url: row?.link || row?.url || "",
      publishedAt: row?.feedDate || row?.publishedAt || row?.publishedDate || row?.createdAt || new Date().toISOString(),
      description: row?.description || row?.text || "",
    }))
    .filter((item) => item.url)
    .filter((item) => /etf/i.test(item.title) || /etf/i.test(item.description));

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 8, 1), 20);
  const tracker = createHealthTracker();
  let lastError = null;
  const attempts = [
    {
      key: "ETF_NEWS_COINSTATS",
      exec: async () => {
        const rows = await fetchCoinstatsNews({ limit: limit * 2 });
        tracker.set("ETF_NEWS_COINSTATS", "ok");
        return normalizeNews(rows);
      },
    },
    {
      key: "ETF_NEWS_FMP",
      exec: async () => {
        const rows = await fetchEtfNews(limit * 2);
        tracker.set("ETF_NEWS_FMP", "ok");
        return normalizeNews(rows);
      },
    },
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      const items = await attempt.exec();
      if (!items.length) throw new Error("empty payload");
      return buildEnvelope({
        ok: true,
        status: "ok",
        statusCode: 200,
        source: attempt.key,
        data: items.slice(0, limit),
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const status = i === attempts.length - 1 ? "error" : "degraded";
      lastError = err;
      tracker.set(attempt.key, status, err?.message || "fetch failed");
    }
  }

  const normalized = normalizeError(lastError || new Error("ETF news failed"));
  return buildEnvelope({
    ok: false,
    source: "etfNews",
    status: normalized.statusCode === 504 ? "degraded" : "degraded",
    statusCode: normalized.statusCode,
    message: normalized.message,
    hint: normalized.hint,
    data: [],
    errors: [{ code: "UPSTREAM_ERROR", message: normalized.message }],
    health: tracker.toArray(),
    generatedAt: new Date().toISOString(),
  });
}
