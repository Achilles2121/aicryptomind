import { useState, useCallback } from "react";

const CRYPTO_KEYWORDS = [
  "rsi", "macd", "ema", "sma", "bollinger", "vwap", "fibonacci", "support", "resistance",
  "bitcoin", "btc", "ethereum", "eth", "altcoin", "defi", "nft", "trading", "chart",
  "stop loss", "take profit", "entry", "exit", "position", "leverage", "margin",
  "funding", "liquidation", "whale", "hodl", "fomo", "fud", "bullish", "bearish",
  "order block", "fair value gap", "liquidity", "volume", "trend", "momentum",
  "divergenz", "divergence", "indikator", "indicator", "analyse", "analysis"
];

const isRelevantQuestion = (text) => {
  const lower = (text || "").toLowerCase();
  return CRYPTO_KEYWORDS.some((kw) => lower.includes(kw)) || lower.length < 100;
};

export const useCryptoEduChat = () => {
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (content) => {
    if (!content?.trim()) return;
    
    const userMsg = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);
    setError(null);
    
    try {
      // Build message history for context
      const history = [...messages.slice(-6), userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: content.trim(),
          messages: history
        })
      });
      
      const data = await res.json();
      
      if (data.ok && data.response) {
        setMessages((prev) => [...prev, { 
          role: "assistant", 
          content: data.response,
          source: data.source || "ai"
        }]);
      } else {
        throw new Error(data.error || "Keine Antwort erhalten");
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message);
      
      // Intelligent fallback based on keywords
      const fallback = getFallbackAnswer(content);
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        content: fallback,
        source: "fallback"
      }]);
    } finally {
      setIsSending(false);
    }
  }, [messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sendMessage, clearMessages, isSending, error, isRelevantQuestion };
};

// Local fallback answers for common questions
function getFallbackAnswer(prompt) {
  const lower = (prompt || "").toLowerCase();
  
  if (lower.includes("rsi")) {
    return "RSI (Relative Strength Index) misst Momentum auf einer Skala von 0-100. Unter 30 = überverkauft (Kaufsignal), über 70 = überkauft (Verkaufssignal). Kombiniere RSI mit anderen Indikatoren für bessere Signale.";
  }
  if (lower.includes("macd")) {
    return "MACD zeigt Trend-Momentum durch EMAs. Wenn MACD die Signallinie von unten kreuzt = bullish, von oben = bearish. Das Histogramm zeigt die Stärke des Momentums.";
  }
  if (lower.includes("stop") || lower.includes("loss")) {
    return "Ein Stop Loss begrenzt Verluste automatisch. Platziere ihn unter Support-Levels oder nutze ATR (1-2x ATR unter Entry). Nie mehr als 1-2% des Portfolios pro Trade riskieren!";
  }
  if (lower.includes("take profit") || lower.includes("tp")) {
    return "Take Profit sichert Gewinne. Strategien: Feste % (z.B. +5%), Fibonacci-Extensions, oder gestaffelt (30% bei +40%, 30% bei +80%, Rest mit Trailing Stop).";
  }
  if (lower.includes("funding")) {
    return "Funding Rates sind Zahlungen zwischen Long/Short-Positionen. Positive Rate = Longs zahlen (bullisher Markt). Extreme Rates können Reversals ankündigen.";
  }
  if (lower.includes("order block")) {
    return "Order Blocks sind Zonen mit institutionellem Interesse. Demand Zone = letzte bearishe Candle vor Aufwärtsbewegung. Supply Zone = letzte bullishe vor Abwärtsbewegung.";
  }
  if (lower.includes("leverage") || lower.includes("hebel")) {
    return "Leverage erhöht Gewinne UND Verluste. Anfänger: max 2-3x. Erfahrene: max 5-10x. Höherer Hebel = höheres Liquidationsrisiko. Immer Stop Loss setzen!";
  }
  
  return "Gute Frage! Für Trading-Erfolg kombiniere technische Analyse (RSI, MACD, EMAs), Risikomanagement (Stop Loss, Position Sizing), und Marktverständnis. Frag mich zu spezifischen Themen!";
}

