#!/usr/bin/env node
/**
 * API Sync Diagnostic Tool
 * Vision AI Mind - Price Gap Analyzer
 * 
 * Compares prices from different sources to identify sync issues:
 * - Internal API (/api/price)
 * - Binance WebSocket (live ticker)
 * - CoinGecko REST API
 * - Gold/Forex fallback sources
 * 
 * Usage:
 *   node scripts/check-api-sync.js --asset bitcoin
 *   node scripts/check-api-sync.js --asset XAUUSD --type gold
 *   node scripts/check-api-sync.js --all
 */

import https from 'https';
import http from 'http';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  internalApiUrl: 'http://localhost:5000/api/price',
  binanceApiUrl: 'https://api.binance.com/api/v3/ticker/price',
  coinGeckoUrl: 'https://api.coingecko.com/api/v3/simple/price',
  metalsLiveUrl: 'https://api.metals.live/v1/spot',
  timeout: 10000,
};

// Asset mapping for testing
const TEST_ASSETS = {
  crypto: ['bitcoin', 'ethereum', 'solana', 'ripple', 'dogecoin'],
  gold: ['XAUUSD', 'XAGUSD'],
  forex: ['EURUSD', 'GBPUSD', 'USDJPY'],
};

const SYMBOL_MAP = {
  bitcoin: { symbol: 'BTC', binance: 'BTCUSDT', coingecko: 'bitcoin' },
  ethereum: { symbol: 'ETH', binance: 'ETHUSDT', coingecko: 'ethereum' },
  solana: { symbol: 'SOL', binance: 'SOLUSDT', coingecko: 'solana' },
  ripple: { symbol: 'XRP', binance: 'XRPUSDT', coingecko: 'ripple' },
  dogecoin: { symbol: 'DOGE', binance: 'DOGEUSDT', coingecko: 'dogecoin' },
};

// ============================================
// FETCH UTILITIES
// ============================================

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout after ${CONFIG.timeout}ms`));
    }, CONFIG.timeout);
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeoutId);
        try {
          resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => JSON.parse(data), text: () => data });
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      clearTimeout(timeoutId);
      reject(e);
    });
  });
}

// ============================================
// PRICE FETCHERS
// ============================================

async function fetchInternalApiPrice(asset) {
  try {
    const url = `${CONFIG.internalApiUrl}?asset=${encodeURIComponent(asset)}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Handle both price and value field names
    const price = data.data?.price ?? data.data?.value;
    if (data.ok && price) {
      return {
        source: 'Internal API',
        price: price,
        provider: data.data.provider || data.data.source || 'unknown',
        timestamp: data.data.timestamp || Date.now(),
        cached: data.cached || false,
      };
    }
    return { source: 'Internal API', error: data.error || 'No price data' };
  } catch (e) {
    return { source: 'Internal API', error: e.message };
  }
}

async function fetchBinancePrice(symbol) {
  try {
    const binanceSymbol = SYMBOL_MAP[symbol]?.binance || `${symbol.toUpperCase()}USDT`;
    const url = `${CONFIG.binanceApiUrl}?symbol=${binanceSymbol}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.price) {
      return {
        source: 'Binance (Live)',
        price: parseFloat(data.price),
        symbol: data.symbol,
        timestamp: Date.now(),
      };
    }
    return { source: 'Binance', error: data.msg || 'No price' };
  } catch (e) {
    return { source: 'Binance', error: e.message };
  }
}

async function fetchCoinGeckoPrice(asset) {
  try {
    const coinId = SYMBOL_MAP[asset]?.coingecko || asset;
    const url = `${CONFIG.coinGeckoUrl}?ids=${coinId}&vs_currencies=usd`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data[coinId]?.usd) {
      return {
        source: 'CoinGecko',
        price: data[coinId].usd,
        timestamp: Date.now(),
      };
    }
    return { source: 'CoinGecko', error: 'No price data' };
  } catch (e) {
    return { source: 'CoinGecko', error: e.message };
  }
}

async function fetchGoldPrice() {
  // Try internal API first
  try {
    const internal = await fetchInternalApiPrice('XAUUSD');
    if (internal.price) {
      return {
        source: 'Internal (Gold)',
        price: internal.price,
        provider: internal.provider,
        timestamp: Date.now(),
      };
    }
  } catch {
    // Fall through
  }
  
  // Fallback to external API
  try {
    const url = `${CONFIG.metalsLiveUrl}/gold`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (Array.isArray(data) && data[0]?.price) {
      return {
        source: 'Metals.live',
        price: data[0].price,
        timestamp: Date.now(),
      };
    }
    return { source: 'Metals.live', error: 'No gold price' };
  } catch (e) {
    return { source: 'Metals.live', error: e.message };
  }
}

async function fetchSilverPrice() {
  // Try internal API first
  try {
    const internal = await fetchInternalApiPrice('XAGUSD');
    if (internal.price) {
      return {
        source: 'Internal (Silver)',
        price: internal.price,
        provider: internal.provider,
        timestamp: Date.now(),
      };
    }
  } catch {
    // Fall through
  }
  
  // Fallback to external API
  try {
    const url = `${CONFIG.metalsLiveUrl}/silver`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (Array.isArray(data) && data[0]?.price) {
      return {
        source: 'Metals.live',
        price: data[0].price,
        timestamp: Date.now(),
      };
    }
    return { source: 'Metals.live', error: 'No silver price' };
  } catch (e) {
    return { source: 'Metals.live', error: e.message };
  }
}

// ============================================
// ANALYSIS
// ============================================

function calculateGap(prices) {
  const validPrices = prices.filter(p => p.price && !p.error);
  if (validPrices.length < 2) return null;
  
  const values = validPrices.map(p => p.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const gapPercent = ((max - min) / avg) * 100;
  
  return {
    min,
    max,
    avg,
    gapPercent,
    gapAbsolute: max - min,
    sources: validPrices.length,
  };
}

function formatPrice(price, decimals = 2) {
  if (typeof price !== 'number') return 'N/A';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function colorize(text, color) {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
  };
  return `${colors[color] || ''}${text}${colors.reset}`;
}

// ============================================
// MAIN DIAGNOSTIC FUNCTIONS
// ============================================

async function diagnoseCrypto(asset) {
  console.log(colorize(`\n═══════════════════════════════════════════`, 'cyan'));
  console.log(colorize(`  CRYPTO ASSET: ${asset.toUpperCase()}`, 'bold'));
  console.log(colorize(`═══════════════════════════════════════════`, 'cyan'));
  
  const [internal, binance, coingecko] = await Promise.all([
    fetchInternalApiPrice(asset),
    fetchBinancePrice(asset),
    fetchCoinGeckoPrice(asset),
  ]);
  
  const prices = [internal, binance, coingecko];
  
  console.log('\n📊 Price Sources:');
  console.log('─────────────────────────────────────────');
  
  for (const p of prices) {
    if (p.error) {
      console.log(`  ${p.source.padEnd(18)} ${colorize('ERROR', 'red')}: ${p.error}`);
    } else {
      const priceStr = formatPrice(p.price);
      const providerStr = p.provider ? ` (${p.provider})` : '';
      console.log(`  ${p.source.padEnd(18)} ${colorize(priceStr, 'green')}${providerStr}`);
    }
  }
  
  const gap = calculateGap(prices);
  
  if (gap) {
    console.log('\n📏 Gap Analysis:');
    console.log('─────────────────────────────────────────');
    console.log(`  Min Price:       ${formatPrice(gap.min)}`);
    console.log(`  Max Price:       ${formatPrice(gap.max)}`);
    console.log(`  Gap (Absolute):  ${formatPrice(gap.gapAbsolute)}`);
    
    const gapColor = gap.gapPercent < 0.1 ? 'green' : gap.gapPercent < 0.5 ? 'yellow' : 'red';
    console.log(`  Gap (Percent):   ${colorize(gap.gapPercent.toFixed(4) + '%', gapColor)}`);
    
    if (gap.gapPercent < 0.1) {
      console.log(colorize('\n  ✅ SYNC STATUS: EXCELLENT - All sources aligned', 'green'));
    } else if (gap.gapPercent < 0.5) {
      console.log(colorize('\n  ⚠️  SYNC STATUS: WARNING - Minor discrepancy detected', 'yellow'));
    } else {
      console.log(colorize('\n  ❌ SYNC STATUS: CRITICAL - Major price gap!', 'red'));
      console.log('     → Fibonacci levels may be inaccurate');
      console.log('     → TP/SL calculations could be off');
    }
  }
  
  return { asset, prices, gap };
}

async function diagnoseGoldForex(asset) {
  const isGold = asset.toUpperCase() === 'XAUUSD';
  const isSilver = asset.toUpperCase() === 'XAGUSD';
  
  console.log(colorize(`\n═══════════════════════════════════════════`, 'yellow'));
  console.log(colorize(`  ${isGold ? 'GOLD' : isSilver ? 'SILVER' : 'FOREX'}: ${asset.toUpperCase()}`, 'bold'));
  console.log(colorize(`═══════════════════════════════════════════`, 'yellow'));
  
  const prices = [];
  
  // Internal API
  const internal = await fetchInternalApiPrice(asset);
  prices.push(internal);
  
  // Metal price if applicable
  if (isGold) {
    const gold = await fetchGoldPrice();
    prices.push(gold);
  } else if (isSilver) {
    const silver = await fetchSilverPrice();
    prices.push(silver);
  }
  
  console.log('\n📊 Price Sources:');
  console.log('─────────────────────────────────────────');
  
  for (const p of prices) {
    if (p.error) {
      console.log(`  ${p.source.padEnd(18)} ${colorize('ERROR', 'red')}: ${p.error}`);
    } else {
      const priceStr = formatPrice(p.price);
      console.log(`  ${p.source.padEnd(18)} ${colorize(priceStr, 'green')}`);
    }
  }
  
  console.log('\n📍 TradingView Symbol:');
  console.log('─────────────────────────────────────────');
  
  if (isGold) {
    console.log(`  Provider: ${colorize('OANDA:XAUUSD', 'cyan')}`);
  } else if (isSilver) {
    console.log(`  Provider: ${colorize('OANDA:XAGUSD', 'cyan')}`);
  } else {
    console.log(`  Provider: ${colorize(`FX_IDC:${asset.toUpperCase()}`, 'cyan')}`);
  }
  
  return { asset, prices };
}

async function runFullDiagnostic() {
  console.log(colorize('\n╔═══════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║      VISION AI MIND - PRICE SYNC DIAGNOSTIC TOOL          ║', 'bold'));
  console.log(colorize('╚═══════════════════════════════════════════════════════════╝', 'cyan'));
  console.log(`\n  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Server:    ${CONFIG.internalApiUrl}`);
  
  const results = {
    crypto: [],
    goldForex: [],
  };
  
  // Test crypto assets
  for (const asset of TEST_ASSETS.crypto.slice(0, 3)) {
    const result = await diagnoseCrypto(asset);
    results.crypto.push(result);
  }
  
  // Test gold
  for (const asset of TEST_ASSETS.gold) {
    const result = await diagnoseGoldForex(asset);
    results.goldForex.push(result);
  }
  
  // Summary
  console.log(colorize('\n╔═══════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(colorize('║                      SUMMARY                               ║', 'bold'));
  console.log(colorize('╚═══════════════════════════════════════════════════════════╝', 'cyan'));
  
  const cryptoGaps = results.crypto.filter(r => r.gap);
  const avgGap = cryptoGaps.length > 0 
    ? cryptoGaps.reduce((a, r) => a + r.gap.gapPercent, 0) / cryptoGaps.length 
    : 0;
  
  console.log(`\n  Crypto Assets Tested:    ${results.crypto.length}`);
  console.log(`  Gold/Forex Assets:       ${results.goldForex.length}`);
  console.log(`  Average Price Gap:       ${avgGap.toFixed(4)}%`);
  
  if (avgGap < 0.1) {
    console.log(colorize('\n  🎯 Overall: EXCELLENT SYNC', 'green'));
  } else if (avgGap < 0.5) {
    console.log(colorize('\n  ⚠️  Overall: ACCEPTABLE (minor delays)', 'yellow'));
  } else {
    console.log(colorize('\n  ❌ Overall: SYNC ISSUES DETECTED', 'red'));
  }
  
  console.log('\n');
}

// ============================================
// CLI PARSING
// ============================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    asset: null,
    type: 'crypto',
    all: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--asset' && args[i + 1]) {
      options.asset = args[i + 1];
      i++;
    } else if (args[i] === '--type' && args[i + 1]) {
      options.type = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      options.all = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Vision AI Mind - Price Sync Diagnostic Tool

Usage:
  node scripts/check-api-sync.js [options]

Options:
  --asset <name>    Test a specific asset (e.g., bitcoin, XAUUSD)
  --type <type>     Asset type: crypto, gold, forex (default: crypto)
  --all             Run full diagnostic on all test assets
  --help, -h        Show this help message

Examples:
  node scripts/check-api-sync.js --asset bitcoin
  node scripts/check-api-sync.js --asset XAUUSD --type gold
  node scripts/check-api-sync.js --all
      `);
      process.exit(0);
    }
  }
  
  return options;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const options = parseArgs();
  
  try {
    if (options.all) {
      await runFullDiagnostic();
    } else if (options.asset) {
      if (options.type === 'gold' || options.type === 'forex' || 
          ['XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY'].includes(options.asset.toUpperCase())) {
        await diagnoseGoldForex(options.asset);
      } else {
        await diagnoseCrypto(options.asset);
      }
    } else {
      // Default: test Bitcoin
      await diagnoseCrypto('bitcoin');
    }
  } catch (e) {
    console.error(colorize(`\n❌ Error: ${e.message}`, 'red'));
    process.exit(1);
  }
}

main();
