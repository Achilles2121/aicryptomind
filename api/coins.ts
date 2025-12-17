// Copyright (c) 2025 Vision AI Mind. All rights reserved.
// Coins API - Top 100 Cryptocurrencies with Market Data
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  sparkline_in_7d?: { price: number[] };
}

interface CacheEntry {
  data: CoinData[];
  timestamp: number;
}

// In-memory cache
let cache: CacheEntry | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { page = '1', per_page = '100' } = req.query;
    
    // Check cache (only for default request)
    if (page === '1' && per_page === '100' && cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return res.status(200).json({
        success: true,
        data: cache.data,
        cached: true,
        count: cache.data.length,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch from CoinGecko
    const url = `${COINGECKO_API}/coins/markets?` + new URLSearchParams({
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: String(per_page),
      page: String(page),
      sparkline: 'true',
      price_change_percentage: '24h,7d',
    });

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VisionAIMind/1.0',
      },
    });

    if (!response.ok) {
      // Rate limited - return cache if available
      if (response.status === 429 && cache) {
        return res.status(200).json({
          success: true,
          data: cache.data,
          cached: true,
          stale: true,
          count: cache.data.length,
          timestamp: new Date().toISOString(),
        });
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const coins: CoinData[] = await response.json();

    // Update cache for default request
    if (page === '1' && per_page === '100') {
      cache = { data: coins, timestamp: Date.now() };
    }

    return res.status(200).json({
      success: true,
      data: coins,
      cached: false,
      count: coins.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Coins API error:', error);

    // Return stale cache if available
    if (cache) {
      return res.status(200).json({
        success: true,
        data: cache.data,
        cached: true,
        stale: true,
        error: 'Using cached data due to API error',
        count: cache.data.length,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch coins',
      data: [],
      count: 0,
      timestamp: new Date().toISOString(),
    });
  }
}
