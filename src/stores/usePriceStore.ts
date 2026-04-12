import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type PriceWsStatus = "connecting" | "live" | "reconnecting" | "polling" | "unavailable";
export type TradeSide = "buy" | "sell";
export type HealthStatus = "ok" | "error" | "degraded" | "fallback" | "disabled";
export type LogLevel = "info" | "warn" | "error";

export interface PriceTick {
  price: number;
  qty: number;
  usd: number;
  side: TradeSide;
  ts: number;
}

export interface PriceAssetState {
  livePrice: number | null;
  trades: PriceTick[];
  wsStatus: PriceWsStatus;
  wsAttempts: number;
  lastUpdatedAt: number | null;
  restPrice: number | null;
  restChange24h: number | null;
  restUpdatedAt: number | null;
  restProvider: string | null;
  restLatencyMs: number | null;
  integrityWarning: boolean;
  integrityDelta: number | null;
}

export interface MarketDataAsset {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  image: string;
  marketCap: number;
  basePrice: number | null;
  change24h: number | null;
  priceSource?: string | null;
  binanceSymbol: string;
  // Extended for Gold/Forex
  assetClass?: 'crypto' | 'commodity' | 'forex';
  tradingViewSymbol?: string;
}

export interface MarketDataCacheEntry {
  data: MarketDataAsset[];
  updatedAt: number;
}

export type AssetClass = 'crypto' | 'commodity' | 'forex';

export interface PriceConnectArgs {
  assetId: string;
  binanceSymbol?: string | null;
  isCrypto: boolean;
  // Extended for Gold/Forex
  assetClass?: AssetClass;
  tradingViewSymbol?: string | null;
  onHealthUpdate?: (source: string, status: HealthStatus, message?: string) => void;
  onLog?: (source: string, level: LogLevel, message: string) => void;
  onFallbackPoll?: () => void;
  resetOnConnect?: boolean;
}

// Single Source of Truth for price data
export interface UnifiedPriceState {
  lastPrice: number | null;
  lastUpdatedAt: number | null;
  source: 'websocket' | 'rest' | 'fallback';
  provider: string | null;
}

export interface PriceStoreState {
  assets: Record<string, PriceAssetState>;
  activeAssetId: string | null;
  selectedAssetId: string | null;
  marketDataCache: MarketDataCacheEntry | null;
  connect: (args: PriceConnectArgs) => void;
  connectMany: (args: PriceConnectArgs[]) => void;
  disconnect: (assetId?: string) => void;
  disconnectMany: () => void;
  clearAsset: (assetId: string) => void;
  setActiveAsset: (assetId: string | null) => void;
  setSelectedAssetId: (assetId: string | null) => void;
  setMarketDataCache: (data: MarketDataAsset[], updatedAt?: number) => void;
  getMarketDataCache: () => MarketDataAsset[] | null;
  setRestSnapshot: (assetId: string, snapshot: { price?: number | null; change24h?: number | null; updatedAt?: number | null; provider?: string | null; latencyMs?: number | null }) => void;
  setIntegrityWarning: (assetId: string, warning: boolean, delta?: number | null) => void;
  getAssetState: (assetId: string) => PriceAssetState;
  selectPriceAsset: (assetId?: string | null) => PriceAssetState;
  // Single Source of Truth - ensures all components use the same price
  getUnifiedPrice: (assetId: string) => UnifiedPriceState;
}

const MAX_TRADES = 50;
const RECONNECT_LIMIT = 5;
const RECONNECT_DELAY_MS = 1500;
const FALLBACK_INTERVAL_MS = 10000;
const POLLING_RECONNECT_MS = 30000;
const MARKET_DATA_TTL_MS = 60 * 1000;

const createDefaultAssetState = (): PriceAssetState => ({
  livePrice: null,
  trades: [],
  wsStatus: "connecting",
  wsAttempts: 0,
  lastUpdatedAt: null,
  restPrice: null,
  restChange24h: null,
  restUpdatedAt: null,
  restProvider: null,
  restLatencyMs: null,
  integrityWarning: false,
  integrityDelta: null,
});

const DEFAULT_ASSET_STATE: PriceAssetState = Object.freeze(createDefaultAssetState());

let wsRef: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pollingReconnectTimer: ReturnType<typeof setInterval> | null = null;
let fallbackTimer: ReturnType<typeof setInterval> | null = null;
let activeAssetRef: string | null = null;
let attemptsRef = 0;

let multiWsRef: WebSocket | null = null;
let multiStreamKey: string | null = null;
let multiReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let multiPollingReconnectTimer: ReturnType<typeof setInterval> | null = null;
let multiFallbackTimer: ReturnType<typeof setInterval> | null = null;
let multiAttemptsRef = 0;
let multiStreamAssets: Record<string, PriceConnectArgs> = {};
let multiStreamToAsset: Record<string, string> = {};

const clearTimers = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (fallbackTimer) {
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }
  if (pollingReconnectTimer) {
    clearInterval(pollingReconnectTimer);
    pollingReconnectTimer = null;
  }
};

const clearMultiTimers = () => {
  if (multiReconnectTimer) {
    clearTimeout(multiReconnectTimer);
    multiReconnectTimer = null;
  }
  if (multiFallbackTimer) {
    clearInterval(multiFallbackTimer);
    multiFallbackTimer = null;
  }
  if (multiPollingReconnectTimer) {
    clearInterval(multiPollingReconnectTimer);
    multiPollingReconnectTimer = null;
  }
};

const updateAssetState = (
  set: (fn: (state: PriceStoreState) => PriceStoreState | Partial<PriceStoreState>) => void,
  assetId: string,
  updater: (prev: PriceAssetState) => PriceAssetState
) => {
  set((state) => {
    const prev = state.assets[assetId] ?? DEFAULT_ASSET_STATE;
    const next = updater(prev);
    if (prev === next) return state;
    return { assets: { ...state.assets, [assetId]: next } };
  });
};

const hasOwn = <T extends object>(obj: T, key: keyof T): boolean => Object.hasOwn(obj, key);

export const usePriceStore = create<PriceStoreState>()(
  subscribeWithSelector((set, get) => ({
    assets: {},
    activeAssetId: null,
    selectedAssetId: null,
    marketDataCache: null,
    setActiveAsset: (assetId) => set({ activeAssetId: assetId }),
    setSelectedAssetId: (assetId) => {
      if (get().selectedAssetId === assetId) return;
      set({ selectedAssetId: assetId });
    },
    setMarketDataCache: (data, updatedAt) => set({ marketDataCache: { data, updatedAt: updatedAt ?? Date.now() } }),
    getMarketDataCache: () => {
      const cache = get().marketDataCache;
      if (!cache) return null;
      if (Date.now() - cache.updatedAt > MARKET_DATA_TTL_MS) return null;
      return cache.data;
    },
    getAssetState: (assetId) => get().assets[assetId] ?? DEFAULT_ASSET_STATE,
    setRestSnapshot: (assetId, snapshot) => {
      updateAssetState(set, assetId, (prev) => {
        const nextRestPrice = hasOwn(snapshot, "price") ? snapshot.price ?? null : prev.restPrice;
        const nextRestChange = hasOwn(snapshot, "change24h") ? snapshot.change24h ?? null : prev.restChange24h;
        const nextRestProvider = hasOwn(snapshot, "provider") ? snapshot.provider ?? null : prev.restProvider;
        const nextRestLatency = hasOwn(snapshot, "latencyMs") ? snapshot.latencyMs ?? null : prev.restLatencyMs;
        const hasUpdate = hasOwn(snapshot, "price") || hasOwn(snapshot, "change24h") || hasOwn(snapshot, "updatedAt");
        // Extract nested ternary for clarity
        let nextUpdatedAt: number | null;
        if (hasOwn(snapshot, "updatedAt")) {
          nextUpdatedAt = snapshot.updatedAt ?? null;
        } else {
          nextUpdatedAt = hasUpdate ? Date.now() : prev.restUpdatedAt;
        }
        if (
          prev.restPrice === nextRestPrice &&
          prev.restChange24h === nextRestChange &&
          prev.restUpdatedAt === nextUpdatedAt &&
          prev.restProvider === nextRestProvider &&
          prev.restLatencyMs === nextRestLatency
        ) {
          return prev;
        }
        return {
          ...prev,
          restPrice: nextRestPrice,
          restChange24h: nextRestChange,
          restUpdatedAt: nextUpdatedAt,
          restProvider: nextRestProvider,
          restLatencyMs: nextRestLatency,
        };
      });
    },
    setIntegrityWarning: (assetId, warning, delta = null) => {
      updateAssetState(set, assetId, (prev) => {
        const nextWarning = Boolean(warning);
        const nextDelta = delta ?? prev.integrityDelta;
        if (prev.integrityWarning === nextWarning && prev.integrityDelta === nextDelta) return prev;
        return { ...prev, integrityWarning: nextWarning, integrityDelta: nextDelta };
      });
    },
    selectPriceAsset: (assetId) => {
      const resolved = assetId ?? get().selectedAssetId;
      return resolved ? get().assets[resolved] ?? DEFAULT_ASSET_STATE : DEFAULT_ASSET_STATE;
    },
    // Single Source of Truth: Returns unified price prioritizing WebSocket > REST > Fallback
    getUnifiedPrice: (assetId) => {
      const asset = get().assets[assetId] ?? DEFAULT_ASSET_STATE;
      
      // Priority 1: Live WebSocket price (lowest latency)
      if (asset.livePrice !== null && asset.wsStatus === 'live') {
        return {
          lastPrice: asset.livePrice,
          lastUpdatedAt: asset.lastUpdatedAt,
          source: 'websocket' as const,
          provider: 'binance',
        };
      }
      
      // Priority 2: REST API price
      if (asset.restPrice !== null) {
        return {
          lastPrice: asset.restPrice,
          lastUpdatedAt: asset.restUpdatedAt,
          source: 'rest' as const,
          provider: asset.restProvider,
        };
      }
      
      // Priority 3: Any live price available (polling fallback)
      if (asset.livePrice !== null) {
        return {
          lastPrice: asset.livePrice,
          lastUpdatedAt: asset.lastUpdatedAt,
          source: 'fallback' as const,
          provider: 'binance',
        };
      }
      
      // No price available
      return {
        lastPrice: null,
        lastUpdatedAt: null,
        source: 'fallback' as const,
        provider: null,
      };
    },
    clearAsset: (assetId) => {
      updateAssetState(set, assetId, () => createDefaultAssetState());
    },
    disconnect: (assetId) => {
      if (assetId && activeAssetRef && assetId !== activeAssetRef) return;
      clearTimers();
      attemptsRef = 0;
      if (wsRef) {
        wsRef.close();
        wsRef = null;
      }
      if (activeAssetRef) {
        updateAssetState(set, activeAssetRef, (prev) => ({
          ...prev,
          wsStatus: "unavailable",
          wsAttempts: 0,
        }));
      }
      activeAssetRef = null;
      set({ activeAssetId: null });
    },
    disconnectMany: () => {
      clearMultiTimers();
      multiAttemptsRef = 0;
      if (multiWsRef) {
        multiWsRef.close();
        multiWsRef = null;
      }
      Object.keys(multiStreamAssets).forEach((assetId) => {
        updateAssetState(set, assetId, (prev) => ({
          ...prev,
          wsStatus: "unavailable",
          wsAttempts: 0,
        }));
      });
      multiStreamAssets = {};
      multiStreamToAsset = {};
      multiStreamKey = null;
    },
    connect: ({
      assetId,
      binanceSymbol,
      isCrypto,
      onHealthUpdate,
      onLog,
      onFallbackPoll,
      resetOnConnect = true,
    }) => {
      if (!assetId) return;
      if (activeAssetRef && activeAssetRef !== assetId) {
        clearTimers();
        attemptsRef = 0;
        if (wsRef) {
          wsRef.close();
          wsRef = null;
        }
      }

      activeAssetRef = assetId;
      set({ activeAssetId: assetId });

      if (resetOnConnect) {
        updateAssetState(set, assetId, () => createDefaultAssetState());
      } else {
        updateAssetState(set, assetId, (prev) => ({ ...prev, wsStatus: "connecting" }));
      }

      if (!isCrypto || !binanceSymbol) {
        // Gold/Forex: Use REST polling instead of WebSocket
        updateAssetState(set, assetId, (prev) => ({
          ...prev,
          livePrice: null,
          trades: [],
          wsStatus: "polling", // Mark as polling mode for Gold/Forex
          wsAttempts: 0,
        }));
        
        // Start REST polling for Gold/Forex assets
        if (onFallbackPoll) {
          onHealthUpdate?.("forex", "ok", "Using REST polling for Gold/Forex");
          onLog?.("polling", "info", `Starting REST polling for ${assetId}`);
          
          // Immediate first poll
          onFallbackPoll();
          
          // Set up interval polling (15s for Gold/Forex precision)
          if (!fallbackTimer) {
            fallbackTimer = setInterval(() => {
              if (activeAssetRef === assetId) {
                onFallbackPoll();
              }
            }, 15000); // 15s polling for Gold/Forex
          }
        }
        return;
      }

      const symbol = binanceSymbol.toLowerCase();

      const connectWs = () => {
        if (activeAssetRef !== assetId) return;
        if (wsRef && (wsRef.readyState === WebSocket.OPEN || wsRef.readyState === WebSocket.CONNECTING)) return;

        updateAssetState(set, assetId, (prev) => ({ ...prev, wsStatus: "connecting" }));

        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);
        wsRef = ws;

        ws.onopen = () => {
          if (activeAssetRef !== assetId) return;
          attemptsRef = 0;
          clearTimers();
          updateAssetState(set, assetId, (prev) => ({ ...prev, wsStatus: "live", wsAttempts: 0 }));
          onHealthUpdate?.("binance", "ok");
        };

        ws.onmessage = (event) => {
          if (activeAssetRef !== assetId) return;
          try {
            const payload = JSON.parse(event.data) as { p?: string; q?: string; m?: boolean; T?: number };
            if (!payload?.p) return;
            const px = Number(payload.p);
            if (!Number.isFinite(px)) return;
            const qty = Number(payload.q || 0);
            const side: TradeSide = payload.m ? "sell" : "buy";
            updateAssetState(set, assetId, (prev) => ({
              ...prev,
              livePrice: px,
              lastUpdatedAt: payload.T || Date.now(),
              trades: [{ price: px, qty, usd: px * qty, side, ts: payload.T || Date.now() }, ...prev.trades].slice(0, MAX_TRADES),
            }));
          } catch {
            onLog?.("websocket", "warn", "WS parse error");
          }
        };

        ws.onclose = () => {
          if (wsRef === ws) wsRef = null;
          if (activeAssetRef !== assetId) return;
          attemptsRef += 1;
          updateAssetState(set, assetId, (prev) => ({
            ...prev,
            wsStatus: attemptsRef <= RECONNECT_LIMIT ? "reconnecting" : "polling",
            wsAttempts: attemptsRef,
          }));
          if (attemptsRef <= RECONNECT_LIMIT) {
            reconnectTimer = setTimeout(connectWs, RECONNECT_DELAY_MS);
            return;
          }
          onHealthUpdate?.("binance", "fallback", "WS fallback -> polling");
          if (!fallbackTimer && onFallbackPoll) {
            fallbackTimer = setInterval(onFallbackPoll, FALLBACK_INTERVAL_MS);
          }
          if (!pollingReconnectTimer) {
            pollingReconnectTimer = setInterval(() => {
              if (activeAssetRef !== assetId) return;
              attemptsRef = 0;
              connectWs();
            }, POLLING_RECONNECT_MS);
          }
        };

        ws.onerror = () => {
          onHealthUpdate?.("binance", "error", "WebSocket error");
          onLog?.("websocket", "error", "WebSocket error");
          ws.close();
        };
      };

      connectWs();
    },
    connectMany: (assets) => {
      const entries = (assets || []).filter((entry) => entry?.assetId);
      if (!entries.length) return;

      entries.forEach((entry) => {
        if (!entry.isCrypto || !(entry.binanceSymbol ?? "")) {
          updateAssetState(set, entry.assetId, (prev) => ({
            ...prev,
            wsStatus: "unavailable",
            wsAttempts: 0,
          }));
          return;
        }
        updateAssetState(set, entry.assetId, (prev) => ({
          ...prev,
          wsStatus: "connecting",
        }));
      });

      // Type-safe filter: only crypto assets with valid binanceSymbol
      const streamEntries = entries.filter(
        (entry): entry is PriceConnectArgs & { binanceSymbol: string; isCrypto: true } => {
          const symbol = (entry.binanceSymbol ?? "");
          return entry.isCrypto === true && 
                 typeof symbol === 'string' && 
                 symbol.length > 0 &&
                 entry.assetClass !== 'commodity' && 
                 entry.assetClass !== 'forex';
        }
      );
      if (!streamEntries.length) return;

      const streams = streamEntries.map((entry) => `${(entry.binanceSymbol ?? "").toLowerCase()}@trade`);
      const nextKey = streams.slice().sort((a, b) => a.localeCompare(b)).join("/");

      if (multiWsRef && multiStreamKey === nextKey && multiWsRef.readyState <= WebSocket.OPEN) return;

      clearMultiTimers();
      multiAttemptsRef = 0;
      multiStreamKey = nextKey;
      multiStreamAssets = streamEntries.reduce((acc, entry) => {
        acc[entry.assetId] = entry;
        return acc;
      }, {} as Record<string, PriceConnectArgs>);
      multiStreamToAsset = streamEntries.reduce((acc, entry) => {
        const stream = `${(entry.binanceSymbol ?? "").toLowerCase()}@trade`;
        acc[stream] = entry.assetId;
        return acc;
      }, {} as Record<string, string>);

      if (multiWsRef) {
        multiWsRef.close();
        multiWsRef = null;
      }

      const broadcastHealth = (status: HealthStatus, message?: string) => {
        Object.values(multiStreamAssets).forEach((entry) => entry.onHealthUpdate?.("binance", status, message));
      };

      const broadcastLog = (level: LogLevel, message: string) => {
        Object.values(multiStreamAssets).forEach((entry) => entry.onLog?.("websocket", level, message));
      };

      const connectWs = () => {
        if (multiStreamKey !== nextKey) return;
        if (multiWsRef && (multiWsRef.readyState === WebSocket.OPEN || multiWsRef.readyState === WebSocket.CONNECTING)) return;

        const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`);
        multiWsRef = ws;

        ws.onopen = () => {
          if (multiStreamKey !== nextKey) return;
          multiAttemptsRef = 0;
          clearMultiTimers();
          Object.keys(multiStreamAssets).forEach((assetId) => {
            updateAssetState(set, assetId, (prev) => ({ ...prev, wsStatus: "live", wsAttempts: 0 }));
          });
          broadcastHealth("ok");
        };

        ws.onmessage = (event) => {
          if (multiStreamKey !== nextKey) return;
          try {
            const payload = JSON.parse(event.data) as { stream?: string; data?: { p?: string; q?: string; m?: boolean; T?: number } };
            const stream = payload?.stream;
            const data = payload?.data;
            if (!stream || !data?.p) return;
            const assetId = multiStreamToAsset[stream];
            if (!assetId) return;
            const px = Number(data.p);
            if (!Number.isFinite(px)) return;
            const qty = Number(data.q || 0);
            const side: TradeSide = data.m ? "sell" : "buy";
            updateAssetState(set, assetId, (prev) => ({
              ...prev,
              livePrice: px,
              lastUpdatedAt: data.T || Date.now(),
              trades: [{ price: px, qty, usd: px * qty, side, ts: data.T || Date.now() }, ...prev.trades].slice(0, MAX_TRADES),
            }));
          } catch {
            broadcastLog("warn", "WS parse error");
          }
        };

        ws.onclose = () => {
          if (multiWsRef === ws) multiWsRef = null;
          if (multiStreamKey !== nextKey) return;
          multiAttemptsRef += 1;
          const nextStatus = multiAttemptsRef <= RECONNECT_LIMIT ? "reconnecting" : "polling";
          Object.keys(multiStreamAssets).forEach((assetId) => {
            updateAssetState(set, assetId, (prev) => ({
              ...prev,
              wsStatus: nextStatus,
              wsAttempts: multiAttemptsRef,
            }));
          });
          if (multiAttemptsRef <= RECONNECT_LIMIT) {
            multiReconnectTimer = setTimeout(connectWs, RECONNECT_DELAY_MS);
            return;
          }
          broadcastHealth("fallback", "WS fallback -> polling");
          if (!multiFallbackTimer) {
            multiFallbackTimer = setInterval(() => {
              Object.values(multiStreamAssets).forEach((entry) => entry.onFallbackPoll?.());
            }, FALLBACK_INTERVAL_MS);
          }
          if (!multiPollingReconnectTimer) {
            multiPollingReconnectTimer = setInterval(() => {
              if (multiStreamKey !== nextKey) return;
              multiAttemptsRef = 0;
              connectWs();
            }, POLLING_RECONNECT_MS);
          }
        };

        ws.onerror = () => {
          broadcastHealth("error", "WebSocket error");
          broadcastLog("error", "WebSocket error");
          ws.close();
        };
      };

      connectWs();
    },
  }))
);

export const selectPriceAsset = (assetId: string | null) => (state: PriceStoreState) => {
  const resolved = assetId ?? state.selectedAssetId;
  return resolved ? state.assets[resolved] ?? DEFAULT_ASSET_STATE : DEFAULT_ASSET_STATE;
};
