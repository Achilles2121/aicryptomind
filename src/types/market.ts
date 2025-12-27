export interface Asset {
  id: string;
  symbol: string;
  name: string;
  class: string;
}

export interface SignalData {
  score: number;
  direction: "bullish" | "bearish" | "neutral" | "long" | "short" | "wait";
  strength: number;
  reason: string;
}

export interface IndicatorState {
  label?: string;
  ts?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  emaFast?: number;
  emaSlow?: number;
  ema200?: number;
  bollUpper?: number;
  bollLower?: number;
  bollBasis?: number;
  atr?: number;
  atrPct?: number;
  adx?: number;
  stochK?: number;
  stochD?: number;
  stochPriceK?: number;
  stochPriceD?: number;
  cci?: number;
  vwap?: number;
  obv?: number;
  donchianHigh?: number;
  donchianLow?: number;
}
