// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL = 8000; // 8s REST fallback polling
const RECONNECT_DELAY = 3000;
const MAX_RECONNECTS = 5;

// In-memory price cache so asset switches show last-known price instantly
const priceCache = new Map();

/**
 * Hook: Real-time price via Binance WebSocket with REST polling fallback.
 * @param {string} symbol - Binance pair, e.g. "BTCUSDT"
 * @returns {{ price: number|null, change24h: number|null, connected: boolean }}
 */
export default function useOptimizedPrice(symbol) {
  const normalizedSymbol = String(symbol || "").toUpperCase();
  const cached = priceCache.get(normalizedSymbol);

  const [price, setPrice] = useState(cached?.price ?? null);
  const [change24h, setChange24h] = useState(cached?.change24h ?? null);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef(null);
  const pollTimer = useRef(null);
  const mountedRef = useRef(true);

  // Update cache whenever price changes
  const updatePrice = useCallback((p, c) => {
    if (!mountedRef.current) return;
    if (p !== null && Number.isFinite(p)) {
      setPrice(p);
      priceCache.set(normalizedSymbol, { price: p, change24h: c, ts: Date.now() });
    }
    if (c !== null && Number.isFinite(c)) {
      setChange24h(c);
    }
  }, [normalizedSymbol]);

  // REST polling fallback
  const pollRest = useCallback(async () => {
    if (!mountedRef.current || !normalizedSymbol) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const base = normalizedSymbol.replace(/USDT$/, "");
      const res = await fetch(`/api/price?asset=${encodeURIComponent(base)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return;
      const json = await res.json();
      const p = Number(json?.data?.price ?? json?.price);
      const c = Number(json?.data?.change24h ?? json?.change24h);
      if (Number.isFinite(p)) {
        updatePrice(p, Number.isFinite(c) ? c : null);
      }
    } catch {
      // Silently fail - will retry on next poll
      clearTimeout(timeout);
    }
  }, [normalizedSymbol, updatePrice]);

  // Start REST polling
  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    pollRest(); // immediate first poll
    pollTimer.current = setInterval(pollRest, POLL_INTERVAL);
  }, [pollRest]);

  // Stop REST polling
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reconnectCount.current = 0;

    if (!normalizedSymbol) {
      return;
    }

    const connectWs = () => {
      if (!mountedRef.current) return;
      const sym = normalizedSymbol.toLowerCase();
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@ticker`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        reconnectCount.current = 0;
        setConnected(true);
        stopPolling();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          const p = Number(data?.c); // current price
          const c = Number(data?.P); // 24h change percent
          if (Number.isFinite(p)) {
            updatePrice(p, Number.isFinite(c) ? c : null);
          }
        } catch {
          // parse error, skip
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setConnected(false);

        if (reconnectCount.current < MAX_RECONNECTS) {
          reconnectCount.current += 1;
          reconnectTimer.current = setTimeout(connectWs, RECONNECT_DELAY);
        } else {
          // Fallback to REST polling
          startPolling();
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      stopPolling();
    };
  }, [normalizedSymbol, updatePrice, startPolling, stopPolling]);

  return { price, change24h, connected };
}
