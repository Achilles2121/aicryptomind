import { fetchBinanceKlines } from "../../api/_lib/providers/binance.js";
import { jsonResponse, errorResponse } from "../../api/_lib/http.js";
import { clampNumber, mapBinanceInterval } from "../../api/_lib/utils.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const minutes = clampNumber(searchParams.get("interval") || 60, { min: 1, max: 1440 });
    const interval = searchParams.get("binanceInterval") || mapBinanceInterval(minutes);
    const limit = clampNumber(searchParams.get("limit") || 160, { min: 10, max: 720 });
    const data = await fetchBinanceKlines(symbol, { limit, interval });
    return jsonResponse({ data, generatedAt: new Date().toISOString(), provider: "binance" });
  } catch (err) {
    console.error("/api/binance/klines", err);
    const status = err?.status || 502;
    return errorResponse(err?.message || "Binance klines failed", status);
  }
}
