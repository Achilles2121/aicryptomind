import { fetchCoinstatsNews } from "../_lib/providers/coinstats.js";
import { fetchEtfNews } from "../_lib/providers/fmp.js";
import { createHealthTracker } from "../_lib/health.js";
import { ok, fail, okEnvelope, failEnvelope, sendEnvelope, ApiStatus } from "../_utils/apiEnvelope.js";

export const config = { runtime: "edge" };

const isAbortError = (err) => {
  const message = (err?.message || "").toLowerCase();
  return err?.name === "AbortError" || message.includes("abort") || message.includes("timeout");
};

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

  try {
    for (const attempt of attempts) {
      try {
        const news = await attempt.exec();
        if (news?.length) {
          return sendEnvelope(
            ok(news.slice(0, limit), {
              source: "etf_news",
              statusCode: 200,
              health: tracker.toArray(),
              generatedAt: new Date().toISOString(),
            })
          );
        }
        tracker.set(attempt.key, "warn", "empty news");
      } catch (err) {
        lastError = normalizeError(err);
        tracker.set(attempt.key, "warn", lastError.message);
      }
    }

    const fallback = {
      title: "ETF news temporarily unavailable",
      source: "system",
      url: "https://status.developer",
      publishedAt: new Date().toISOString(),
      description: "ETF news provider did not return data.",
    };
    return sendEnvelope(
      fail("degraded", {
        statusCode: lastError?.statusCode || 502,
        source: "etf_news",
        data: [fallback],
        hint: lastError?.hint || "upstream_error",
        errors: [lastError?.message || "ETF news unavailable"],
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    const normalized = normalizeError(err);
    return sendEnvelope(
      fail("degraded", {
        statusCode: normalized.statusCode,
        source: "etf_news",
        hint: normalized.hint || "runtime_error",
        errors: [normalized.message],
        data: [],
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      })
    );
  }
}
