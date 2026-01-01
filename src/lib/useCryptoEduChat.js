import { useState, useCallback } from "react";
import { safeFixed } from "./safeFixed";

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

// Hook that accepts platform context for intelligent responses
export const useCryptoEduChat = (platformContext = {}) => {
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
      
      // Pass platform context (price, RSI, MACD, etc.) to API
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: content.trim(),
          messages: history,
          context: platformContext
        })
      });
      
      const data = await res.json();
      
      if (data.ok && data.response) {
        setMessages((prev) => [...prev, { 
          role: "assistant", 
          content: data.response,
          source: data.source || "vision-ai"
        }]);
      } else {
        throw new Error(data.error || "Keine Antwort erhalten");
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message);
      
      // Intelligent fallback based on keywords
      const fallback = getFallbackAnswer(content, platformContext);
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        content: fallback,
        source: "vision-ai-local"
      }]);
    } finally {
      setIsSending(false);
    }
  }, [messages, platformContext]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sendMessage, clearMessages, isSending, error, isRelevantQuestion };
};

// Local fallback answers that use platform context
function getFallbackAnswer(prompt, ctx = {}) {
  const lower = (prompt || "").toLowerCase();
  const hasCtx = ctx.asset && ctx.price;
  
  if (lower.includes("rsi")) {
    if (hasCtx && ctx.rsi !== undefined) {
      const status = ctx.rsi < 30 ? "überverkauft" : ctx.rsi > 70 ? "überkauft" : "neutral";
      return `Vision AI: Der RSI für ${ctx.asset} liegt bei ${safeFixed(ctx.rsi, 1)} (${status}). RSI misst Momentum: Unter 30 = überverkauft, über 70 = überkauft. ⚠️ Keine Anlageberatung.`;
    }
    return "Vision AI: RSI misst Momentum von 0-100. Unter 30 = überverkauft, über 70 = überkauft. Auf Vision AI Mind siehst du den Live-RSI im Chart. ⚠️ Keine Anlageberatung.";
  }
  if (lower.includes("macd")) {
    if (hasCtx && ctx.macd !== undefined) {
      const status = ctx.macd > (ctx.macdSignal || 0) ? "bullish" : "bearish";
      return `Vision AI: MACD für ${ctx.asset} ist aktuell ${status}. MACD über Signal = Aufwärtsmomentum. ⚠️ Keine Anlageberatung.`;
    }
    return "Vision AI: MACD zeigt Trend-Momentum. MACD über Signallinie = bullish, darunter = bearish. ⚠️ Keine Anlageberatung.";
  }
  if (lower.includes("preis") || lower.includes("price")) {
    if (hasCtx) {
      return `Vision AI: ${ctx.asset} notiert bei $${ctx.price?.toLocaleString()}. ${ctx.signal ? `Signal: ${ctx.signal}` : ""} ⚠️ Keine Anlageberatung.`;
    }
  }
  if (lower.includes("stop") || lower.includes("loss")) {
    if (hasCtx && ctx.sl) {
      return `Vision AI: Stop Loss für ${ctx.asset} bei $${ctx.sl?.toLocaleString()} (basierend auf ATR). Immer max 1-2% Risiko pro Trade! ⚠️ Keine Anlageberatung.`;
    }
    return "Vision AI: Stop Loss begrenzt Verluste automatisch. Platziere unter Support oder nutze ATR. Nie mehr als 1-2% des Portfolios pro Trade riskieren! ⚠️ Keine Anlageberatung.";
  }
  if (lower.includes("take profit") || lower.includes("tp")) {
    if (hasCtx && ctx.tp) {
      return `Vision AI: Take Profit für ${ctx.asset} bei $${ctx.tp?.toLocaleString()}. Gestaffeltes TP empfohlen: 30% bei +40%, 30% bei +80%, Rest mit Trailing. ⚠️ Keine Anlageberatung.`;
    }
    return "Vision AI: Take Profit sichert Gewinne. Strategien: Feste %, Fibonacci-Extensions, oder gestaffelt. ⚠️ Keine Anlageberatung.";
  }
  if (lower.includes("signal")) {
    if (hasCtx && ctx.signal) {
      return `Vision AI: ${ctx.asset} zeigt "${ctx.signal}" mit ${safeFixed((ctx.confidence || 0) * 100, 0)}% Konfidenz. Unsere Signale sind Education, keine Kaufempfehlung! ⚠️ Keine Anlageberatung.`;
    }
  }
  
  return `Vision AI: Auf Vision AI Mind findest du Live-Preise, RSI, MACD, Signale und TP/SL-Berechnung. Frag mich zu spezifischen Themen! ⚠️ Dies ist keine Anlageberatung.`;
}

