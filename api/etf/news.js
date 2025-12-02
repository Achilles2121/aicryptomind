import { fetchCoinstatsNews } from "../_lib/providers/coinstats.js";
import { fetchEtfNews } from "../_lib/providers/fmp.js";
import { jsonResponse, errorResponse } from "../_lib/http.js";
import { createHealthTracker } from "../_lib/health.js";

export const config = { runtime: "edge" };

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
      return jsonResponse({ data: items.slice(0, limit), health: tracker.toArray(), generatedAt: new Date().toISOString() });
    } catch (err) {
      const status = i === attempts.length - 1 ? "error" : "degraded";
      tracker.set(attempt.key, status, err?.message || "fetch failed");
    }
  }

  return errorResponse("Failed to fetch ETF news", 502, { health: tracker.toArray() });
}
