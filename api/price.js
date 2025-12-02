import { fetchCoingeckoSimplePrice } from "./_lib/providers/coingecko.js";
import { fetchBinanceTicker } from "./_lib/providers/binance.js";
import { fetchCryptoComparePrice } from "./_lib/providers/cryptocompare.js";
import { jsonResponse, errorResponse } from "./_lib/http.js";
import { createHealthTracker } from "./_lib/health.js";
import { assetSources } from "./_lib/sources.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get("asset") || "BTC").toUpperCase();
  const vs = (searchParams.get("vs") || "USD").toUpperCase();
  const tracker = createHealthTracker();
  const id = assetSources[asset]?.cg || "bitcoin";
  const symbol = assetSources[asset]?.binance || `${asset}USDT`;
  try {
    const cg = await fetchCoingeckoSimplePrice([id], vs.toLowerCase());
    const entry = cg?.[id]?.[vs.toLowerCase()];
    if (Number.isFinite(entry)) {
      tracker.set("coingecko", "ok");
      return jsonResponse({
        data: {
          asset,
          vs,
          value: Number(entry),
          change24h: Number(cg?.[id]?.[`${vs.toLowerCase()}_24h_change`] ?? 0),
          source: "CoinGecko",
          updatedAt: new Date().toISOString(),
        },
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      });
    }
    tracker.set("coingecko", "degraded", "missing price");
  } catch (err) {
    tracker.set("coingecko", "error", err?.message || "coingecko failed");
  }

  try {
    const ticker = await fetchBinanceTicker(symbol);
    if (Number.isFinite(ticker.price)) {
      tracker.set("binance", "ok");
      return jsonResponse({
        data: {
          asset,
          vs,
          value: ticker.price,
          change24h: ticker.changePercent ?? null,
          source: "Binance",
          updatedAt: new Date().toISOString(),
        },
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      });
    }
    tracker.set("binance", "degraded", "missing price");
  } catch (err) {
    tracker.set("binance", "error", err?.message || "binance failed");
  }

  try {
    const value = await fetchCryptoComparePrice(asset, vs);
    if (Number.isFinite(value)) {
      tracker.set("cryptocompare", "ok");
      return jsonResponse({
        data: {
          asset,
          vs,
          value,
          change24h: null,
          source: "CryptoCompare",
          updatedAt: new Date().toISOString(),
        },
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      });
    }
    tracker.set("cryptocompare", "error", "missing price");
  } catch (err) {
    tracker.set("cryptocompare", "error", err?.message || "cryptocompare failed");
  }

  return errorResponse("Failed to fetch price", 502, { health: tracker.toArray() });
}
