import { Router } from "express";
import { fetchCoinstatsNews } from "../../api/_lib/providers/coinstats.js";
import { fetchEtfNews } from "../../api/_lib/providers/fmp.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { withCache } from "../utils/cache.js";

const router = Router();

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

router.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);
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

  try {
    const result = await withCache(`etfnews:${limit}`, 60_000, async () => {
      for (let i = 0; i < attempts.length; i += 1) {
        const attempt = attempts[i];
        try {
          const items = await attempt.exec();
          if (!items.length) throw new Error("empty payload");
          return { items: items.slice(0, limit), health: tracker.toArray() };
        } catch (err) {
          const status = i === attempts.length - 1 ? "error" : "degraded";
          tracker.set(attempt.key, status, err?.message || "fetch failed");
        }
      }
      return { items: [], health: tracker.toArray() };
    });

    const status = result.items.length ? 200 : 200; // always 200 with degraded health to avoid hard failures
    return res.status(status).json({
      data: result.items,
      health: result.health,
      generatedAt: new Date().toISOString(),
      error: result.items.length ? undefined : "no_news_available",
    });
  } catch (err) {
    tracker.set("ETF_NEWS", "error", err?.message || "news failed");
    return res.status(200).json({
      data: [],
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
      error: "no_news_available",
    });
  }
});

export default router;
