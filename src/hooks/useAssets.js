// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import { useState, useEffect, useCallback, useRef } from "react";

const CACHE_KEY = "vision_ai_assets_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Maps a CoinGecko coin to a Binance-compatible symbol.
 * @param {string} symbol uppercase symbol, e.g. "BTC"
 * @returns {string} Binance pair, e.g. "BTCUSDT"
 */
const toBinanceSymbol = (symbol) => {
  const base = String(symbol || "").toUpperCase();
  if (!base) return "";
  // Stablecoins that don't have their own pair
  const stablecoins = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD"]);
  if (stablecoins.has(base)) return "";
  return `${base}USDT`;
};

/**
 * Read cached assets from localStorage.
 * Returns null if cache is expired or missing.
 */
const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.assets)) return null;
    if (Date.now() - (parsed.ts || 0) > CACHE_TTL) return null;
    return parsed.assets;
  } catch {
    return null;
  }
};

/**
 * Write assets to localStorage cache.
 */
const writeCache = (assets) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ assets, ts: Date.now() }));
  } catch {
    // Storage full or unavailable
  }
};

/**
 * Hook: Fetches top 100 crypto assets from /api/assets with localStorage cache.
 * @returns {{ assets: Array, loading: boolean }}
 */
export default function useAssets() {
  const [assets, setAssets] = useState(() => readCache() || []);
  const [loading, setLoading] = useState(() => !readCache());
  const controllerRef = useRef(null);

  const fetchAssets = useCallback(async () => {
    // Abort any previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      setLoading(true);
      const res = await fetch("/api/assets", { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = Array.isArray(json?.assets) ? json.assets : [];

      const mapped = list.map((coin) => ({
        id: coin.id || "",
        symbol: String(coin.symbol || "").toUpperCase(),
        name: coin.name || "",
        image: coin.image || "",
        price: Number(coin.current_price) || Number(coin.price) || 0,
        change24h: Number(coin.price_change_percentage_24h) || Number(coin.change24h) || 0,
        marketCap: Number(coin.market_cap) || Number(coin.marketCap) || 0,
        binanceSymbol: toBinanceSymbol(String(coin.symbol || "").toUpperCase()),
      }));

      setAssets(mapped);
      writeCache(mapped);
    } catch (err) {
      if (err?.name === "AbortError") return;
      // Keep stale data if available
      const stale = readCache();
      if (stale && stale.length > 0) {
        setAssets(stale);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const cached = readCache();
    if (cached && cached.length > 0) {
      setAssets(cached);
      setLoading(false);
      return;
    }
    fetchAssets();
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [fetchAssets]);

  return { assets, loading };
}
