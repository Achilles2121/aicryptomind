/**
 * SYMBOL_MAP - Universal Asset Configuration
 * 
 * Maps UI display names to provider-specific tickers
 * Used by /api/market-data and useMarketData hook
 * 
 * @author Vision AI Mind
 * @version 2.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export type AssetType = 'crypto' | 'index' | 'commodity' | 'forex';

export interface AssetConfig {
  /** Yahoo Finance ticker symbol */
  ticker: string;
  /** Asset category for styling and logic */
  type: AssetType;
  /** Milliseconds between updates */
  updateInterval: number;
  /** Use Binance API for faster crypto updates */
  useBinance?: boolean;
  /** Binance symbol (without USDT suffix) */
  binanceSymbol?: string;
  /** Display name override */
  displayName?: string;
  /** Decimal places for price display */
  decimals?: number;
  /** Currency symbol for display */
  currency?: string;
}

// ============================================================================
// SYMBOL MAP - 23 ASSETS
// ============================================================================

export const SYMBOL_MAP: Record<string, AssetConfig> = {
  // ==========================================================================
  // CRYPTO (10) - 1 second updates via Binance
  // ==========================================================================
  'BTC': {
    ticker: 'BTC-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'BTCUSDT',
    decimals: 2,
    currency: '$'
  },
  'ETH': {
    ticker: 'ETH-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'ETHUSDT',
    decimals: 2,
    currency: '$'
  },
  'SOL': {
    ticker: 'SOL-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'SOLUSDT',
    decimals: 2,
    currency: '$'
  },
  'XRP': {
    ticker: 'XRP-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'XRPUSDT',
    decimals: 4,
    currency: '$'
  },
  'ADA': {
    ticker: 'ADA-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'ADAUSDT',
    decimals: 4,
    currency: '$'
  },
  'LTC': {
    ticker: 'LTC-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'LTCUSDT',
    decimals: 2,
    currency: '$'
  },
  'DOGE': {
    ticker: 'DOGE-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'DOGEUSDT',
    decimals: 5,
    currency: '$'
  },
  'BNB': {
    ticker: 'BNB-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'BNBUSDT',
    decimals: 2,
    currency: '$'
  },
  'AVAX': {
    ticker: 'AVAX-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'AVAXUSDT',
    decimals: 2,
    currency: '$'
  },
  'DOT': {
    ticker: 'DOT-USD',
    type: 'crypto',
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: 'DOTUSDT',
    decimals: 3,
    currency: '$'
  },

  // ==========================================================================
  // INDICES (6) - 5 second updates via Yahoo Finance
  // ==========================================================================
  'DAX 40': {
    ticker: '^GDAXI',
    type: 'index',
    updateInterval: 5000,
    displayName: 'DAX 40',
    decimals: 2,
    currency: '€'
  },
  'DAX': {
    ticker: '^GDAXI',
    type: 'index',
    updateInterval: 5000,
    displayName: 'DAX 40',
    decimals: 2,
    currency: '€'
  },
  'S&P 500': {
    ticker: '^GSPC',
    type: 'index',
    updateInterval: 5000,
    displayName: 'S&P 500',
    decimals: 2,
    currency: '$'
  },
  'SPX': {
    ticker: '^GSPC',
    type: 'index',
    updateInterval: 5000,
    displayName: 'S&P 500',
    decimals: 2,
    currency: '$'
  },
  'Nasdaq 100': {
    ticker: '^NDX',
    type: 'index',
    updateInterval: 5000,
    displayName: 'NASDAQ 100',
    decimals: 2,
    currency: '$'
  },
  'NASDAQ': {
    ticker: '^IXIC',
    type: 'index',
    updateInterval: 5000,
    displayName: 'NASDAQ Composite',
    decimals: 2,
    currency: '$'
  },
  'Dow Jones': {
    ticker: '^DJI',
    type: 'index',
    updateInterval: 5000,
    displayName: 'Dow Jones',
    decimals: 2,
    currency: '$'
  },
  'DJI': {
    ticker: '^DJI',
    type: 'index',
    updateInterval: 5000,
    displayName: 'Dow Jones',
    decimals: 2,
    currency: '$'
  },
  'FTSE 100': {
    ticker: '^FTSE',
    type: 'index',
    updateInterval: 5000,
    displayName: 'FTSE 100',
    decimals: 2,
    currency: '£'
  },
  'Nikkei 225': {
    ticker: '^N225',
    type: 'index',
    updateInterval: 5000,
    displayName: 'Nikkei 225',
    decimals: 2,
    currency: '¥'
  },

  // ==========================================================================
  // COMMODITIES (1) - 3 second updates via Yahoo Finance
  // ==========================================================================
  'Gold': {
    ticker: 'GC=F',
    type: 'commodity',
    updateInterval: 3000,
    displayName: 'Gold (COMEX)',
    decimals: 2,
    currency: '$'
  },
  'GOLD': {
    ticker: 'GC=F',
    type: 'commodity',
    updateInterval: 3000,
    displayName: 'Gold (COMEX)',
    decimals: 2,
    currency: '$'
  },
  'XAUUSD': {
    ticker: 'GC=F',
    type: 'commodity',
    updateInterval: 3000,
    displayName: 'Gold/USD',
    decimals: 2,
    currency: '$'
  },
  'Silver': {
    ticker: 'SI=F',
    type: 'commodity',
    updateInterval: 3000,
    displayName: 'Silver (COMEX)',
    decimals: 3,
    currency: '$'
  },
  'Oil': {
    ticker: 'CL=F',
    type: 'commodity',
    updateInterval: 3000,
    displayName: 'Crude Oil (WTI)',
    decimals: 2,
    currency: '$'
  },

  // ==========================================================================
  // FOREX (6) - 3 second updates via Yahoo Finance
  // ==========================================================================
  'EUR / USD': {
    ticker: 'EURUSD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'EUR/USD',
    decimals: 5,
    currency: ''
  },
  'EURUSD': {
    ticker: 'EURUSD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'EUR/USD',
    decimals: 5,
    currency: ''
  },
  'GBP / USD': {
    ticker: 'GBPUSD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'GBP/USD',
    decimals: 5,
    currency: ''
  },
  'GBPUSD': {
    ticker: 'GBPUSD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'GBP/USD',
    decimals: 5,
    currency: ''
  },
  'USD / JPY': {
    ticker: 'JPY=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'USD/JPY',
    decimals: 3,
    currency: ''
  },
  'USDJPY': {
    ticker: 'JPY=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'USD/JPY',
    decimals: 3,
    currency: ''
  },
  'USD / CHF': {
    ticker: 'CHF=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'USD/CHF',
    decimals: 5,
    currency: ''
  },
  'USDCHF': {
    ticker: 'CHF=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'USD/CHF',
    decimals: 5,
    currency: ''
  },
  'AUD / USD': {
    ticker: 'AUDUSD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'AUD/USD',
    decimals: 5,
    currency: ''
  },
  'AUDUSD': {
    ticker: 'AUDUSD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'AUD/USD',
    decimals: 5,
    currency: ''
  },
  'USD / CAD': {
    ticker: 'CAD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'USD/CAD',
    decimals: 5,
    currency: ''
  },
  'USDCAD': {
    ticker: 'CAD=X',
    type: 'forex',
    updateInterval: 3000,
    displayName: 'USD/CAD',
    decimals: 5,
    currency: ''
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get asset config by UI name (case-insensitive lookup)
 */
export function getAssetConfig(symbol: string): AssetConfig | null {
  // Direct match
  if (SYMBOL_MAP[symbol]) {
    return SYMBOL_MAP[symbol];
  }
  
  // Case-insensitive match
  const upperSymbol = symbol.toUpperCase();
  for (const [key, config] of Object.entries(SYMBOL_MAP)) {
    if (key.toUpperCase() === upperSymbol) {
      return config;
    }
  }
  
  return null;
}

/**
 * Get all symbols of a specific type
 */
export function getSymbolsByType(type: AssetType): string[] {
  return Object.entries(SYMBOL_MAP)
    .filter(([_, config]) => config.type === type)
    .map(([symbol]) => symbol);
}

/**
 * Check if symbol uses Binance for data
 */
export function usesBinance(symbol: string): boolean {
  const config = getAssetConfig(symbol);
  return config?.useBinance === true;
}

/**
 * Get update interval for symbol
 */
export function getUpdateInterval(symbol: string): number {
  const config = getAssetConfig(symbol);
  return config?.updateInterval ?? 5000;
}

/**
 * Format price according to asset config
 */
export function formatPrice(symbol: string, price: number): string {
  const config = getAssetConfig(symbol);
  const decimals = config?.decimals ?? 2;
  const currency = config?.currency ?? '$';
  
  const formatted = price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  
  return currency ? `${currency}${formatted}` : formatted;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default SYMBOL_MAP;
