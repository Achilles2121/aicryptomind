import { Router } from "express";
import { fetchCoingeckoSimplePrice } from "../../api/_lib/providers/coingecko.js";
import { fetchBinanceTicker } from "../../api/_lib/providers/binance.js";
import { fetchCryptoComparePrice } from "../../api/_lib/providers/cryptocompare.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { assetSources } from "../../api/_lib/sources.js";
import { clampNumber } from "../../api/_lib/utils.js";
import { withCache } from "../utils/cache.js";

const router = Router();

router.get("/", async (req, res) => {
  const asset = String(req.query.asset || "BTC").toUpperCase();
  const vs = String(req.query.vs || "USD").toUpperCase();
  const cacheMs = clampNumber(req.query.cacheMs || 500, { min: 0, max: 5000 });
  const cgId = assetSources[asset]?.cg || "bitcoin";
  const binanceSymbol = assetSources[asset]?.binance || `${asset}USDT`;

  const buildResponse = (tracker, { data = null, status = "ok", error = null } = {}) => {
    const payload = {
      ok: status === "ok" && !error,
      status,
      error,
      data,
      health: tracker?.toArray() || [],
      generatedAt: new Date().toISOString(),
    };
    return payload;
  };

  try {
    const result = await withCache(`price:${asset}:${vs}`, cacheMs, async () => {
      const tracker = createHealthTracker();
      const fail = (status = "upstream_error", message = "Failed to fetch price") =>
        buildResponse(tracker, { status, error: message, data: null });

      try {
        const cg = await fetchCoingeckoSimplePrice([cgId], vs.toLowerCase());
        const entry = cg?.[cgId]?.[vs.toLowerCase()];
        if (Number.isFinite(entry)) {
          tracker.set("coingecko", "ok");
          const data = {
            asset,
            vs,
            value: Number(entry),
            change24h: Number(cg?.[cgId]?.[`${vs.toLowerCase()}_24h_change`] ?? 0),
            source: "CoinGecko",
            updatedAt: new Date().toISOString(),
          };
          return buildResponse(tracker, { data });
        }
        tracker.set("coingecko", "degraded", "missing price");
      } catch (err) {
        tracker.set("coingecko", "error", err?.message || "coingecko failed");
      }

      try {
        const ticker = await fetchBinanceTicker(binanceSymbol);
        if (Number.isFinite(ticker.price)) {
          tracker.set("binance", "ok");
          const data = {
            asset,
            vs,
            value: ticker.price,
            change24h: ticker.changePercent ?? null,
            source: "Binance",
            updatedAt: new Date().toISOString(),
          };
          return buildResponse(tracker, { data });
        }
        tracker.set("binance", "degraded", "missing price");
      } catch (err) {
        tracker.set("binance", "error", err?.message || "binance failed");
      }

      try {
        const value = await fetchCryptoComparePrice(asset, vs);
        if (Number.isFinite(value)) {
          tracker.set("cryptocompare", "ok");
          const data = {
            asset,
            vs,
            value,
            change24h: null,
            source: "CryptoCompare",
            updatedAt: new Date().toISOString(),
          };
          return buildResponse(tracker, { data });
        }
        tracker.set("cryptocompare", "error", "missing price");
      } catch (err) {
        tracker.set("cryptocompare", "error", err?.message || "cryptocompare failed");
      }

      return fail("upstream_error");
    });

    return res.status(200).json(result);
  } catch (err) {
    const tracker = createHealthTracker();
    const status = err?.name === "AbortError" ? "timeout" : "upstream_error";
    return res
      .status(200)
      .json(buildResponse(tracker, { status, error: err?.message || "unexpected error", data: null }));
  }
});

export default router;
