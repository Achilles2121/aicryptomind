// Copyright (c) 2025 Vision AI Mind. All rights reserved.

/**
 * TradingView Symbol Mapping (Crypto only)
 *
 * NOTE: This file is kept for backwards compatibility.
 * For new code, use: import { getTVSymbolForAsset } from '../config/assets';
 */

import { ASSETS, getAssetById, getTVSymbolForAsset as getConfigTVSymbol } from "../config/assets";

const buildSymbolMap = (assets) => {
  const map = {};
  assets.forEach((asset) => {
    map[asset.id] = asset.tvSymbol;
    if (asset.base) map[asset.base] = asset.tvSymbol;
  });
  return map;
};

const CRYPTO_SYMBOLS = buildSymbolMap(ASSETS.crypto);

const ALL_SYMBOLS = {
  ...CRYPTO_SYMBOLS,
};

export function getTradingViewSymbol(assetId, assetClass) {
  if (!assetId) return "BINANCE:BTCUSDT";

  const configSymbol = getConfigTVSymbol(assetId);
  if (configSymbol && configSymbol !== "BINANCE:BTCUSDT") {
    return configSymbol;
  }

  const asset = getAssetById(assetId);
  if (asset?.tvSymbol) {
    return asset.tvSymbol;
  }

  const normalized = assetId.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");

  if (ALL_SYMBOLS[normalized]) {
    return ALL_SYMBOLS[normalized];
  }

  const withoutSuffix = normalized.replace(/(USD|USDT)$/, "");
  if (ALL_SYMBOLS[withoutSuffix]) {
    return ALL_SYMBOLS[withoutSuffix];
  }

  if (assetClass === "crypto" || !assetClass) {
    return `BINANCE:${normalized}USDT`;
  }

  return `BINANCE:${normalized}USDT`;
}

export function getTradingViewInterval(minutes) {
  const mins = Number(minutes) || 60;

  if (mins >= 1440) return "D";
  if (mins >= 240) return "240";
  if (mins >= 60) return "60";
  if (mins >= 15) return "15";
  if (mins >= 5) return "5";
  return "1";
}

export function getTickerSymbols(assetClass) {
  const buildTickers = (assets, limit = 5) =>
    assets.slice(0, limit).map((a) => ({ proName: a.tvSymbol, title: a.label }));

  const cryptoTickers = buildTickers(ASSETS.crypto, 8);

  if (assetClass === "crypto" || !assetClass) return cryptoTickers;

  return cryptoTickers;
}

export { getAssetById, getTVSymbolForAsset as getAssetTVSymbol } from "../config/assets";

export default {
  getTradingViewSymbol,
  getTradingViewInterval,
  getTickerSymbols,
  CRYPTO_SYMBOLS,
};
