// Standalone Crypto Education Chat API using Groq (free tier, fast inference)
// Uses Llama 3.1 8B - great for crypto education

type VercelRequest = {
  method?: string;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  end: () => void;
  setHeader: (key: string, value: string) => void;
};

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "llama-3.1-8b-instant"; // Fast, free, good for education

const SYSTEM_PROMPT = `Du bist ein erfahrener Krypto-Trading-Educator und Analyst. 
Deine Aufgabe ist es, Trading-Konzepte klar und verständlich zu erklären.

Deine Expertise umfasst:
- Technische Analyse (RSI, MACD, Bollinger Bands, EMA, VWAP, Order Blocks, Fair Value Gaps)
- Fundamentalanalyse (On-Chain-Metriken, TVL, Funding Rates, Open Interest)
- Risk Management (Position Sizing, Stop Loss, Take Profit, R/R-Verhältnis)
- Marktzyklen (BTC Dominance, Alt Season, Market Regimes)
- DeFi-Konzepte (Liquidity Mining, Yield Farming, AMMs)
- Trading-Psychologie und Mindset

Regeln:
- Antworte präzise und strukturiert
- Nutze Beispiele wenn hilfreich
- Erkläre komplexe Konzepte einfach
- Warne vor Risiken ohne Angst zu machen
- Gib niemals konkrete Kauf/Verkauf-Empfehlungen
- Antworte in der Sprache der Frage (Deutsch oder Englisch)
- Halte Antworten unter 300 Wörter`;

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Fallback responses when no API key or rate limited
const FALLBACK_RESPONSES: Record<string, string> = {
  rsi: "Der RSI (Relative Strength Index) misst die Stärke von Preisbewegungen auf einer Skala von 0-100. Werte unter 30 signalisieren 'überverkauft' (potenzielle Kaufgelegenheit), über 70 'überkauft' (möglicher Verkaufsdruck). RSI 50 ist neutral. Kombiniere RSI immer mit anderen Indikatoren wie MACD oder Volumen.",
  macd: "MACD (Moving Average Convergence Divergence) zeigt Trend-Momentum durch den Vergleich zweier EMAs. Signale: MACD über Signal-Linie = bullish, darunter = bearish. Das Histogramm zeigt die Differenz. Divergenzen zwischen MACD und Preis können Trendwenden ankündigen.",
  "stop loss": "Stop Loss ist eine automatische Verkaufsorder bei einem bestimmten Preis, um Verluste zu begrenzen. Typische Platzierung: unter wichtigen Support-Levels oder 1-2 ATR unter Entry. Regel: Riskiere nie mehr als 1-2% deines Portfolios pro Trade.",
  "take profit": "Take Profit ist eine automatische Verkaufsorder bei einem Gewinnziel. Strategien: Feste Prozente (z.B. +5%), Fibonacci-Levels, oder Trailing Stop. Gestaffelte TPs (z.B. 30% bei +40%, 30% bei +80%, Rest mit Trailing) sichern Gewinne und lassen Upside offen.",
  "funding rate": "Funding Rates sind periodische Zahlungen zwischen Long- und Short-Positionen bei Perpetual Futures. Positive Rate = Longs zahlen Shorts (bullisher Markt), negative = Shorts zahlen Longs. Extreme Rates können Reversals ankündigen.",
  "order block": "Order Blocks sind Bereiche mit starkem institutionellem Kauf-/Verkaufsinteresse. Erkennbar an starken Bewegungen nach Konsolidierung. Der letzte bearishe Candle vor einer Aufwärtsbewegung = Demand Zone, der letzte bullishe vor Abwärtsbewegung = Supply Zone.",
  default: "Das ist eine interessante Frage! Als Krypto-Trading-Educator empfehle ich, verschiedene Indikatoren und Konzepte zu kombinieren. Wichtige Grundlagen: Verstehe technische Analyse (RSI, MACD, EMAs), lerne Risk Management (Position Sizing, Stop Loss), und studiere Marktzyklen. Frag mich gerne zu spezifischen Themen!"
};

function getFallbackResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (lower.includes(key)) {
      return response;
    }
  }
  return FALLBACK_RESPONSES.default;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  
  const { prompt, messages } = req.body || {};
  
  if (!prompt && (!messages || !messages.length)) {
    return res.status(400).json({ ok: false, error: "Missing prompt or messages" });
  }
  
  // Rate limiting by IP
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ 
      ok: false, 
      error: "Rate limit exceeded. Please wait a minute.",
      response: getFallbackResponse(prompt || messages?.[messages.length - 1]?.content || "")
    });
  }
  
  // If no Groq API key, use intelligent fallback
  if (!GROQ_API_KEY) {
    const fallbackResponse = getFallbackResponse(prompt || messages?.[messages.length - 1]?.content || "");
    return res.status(200).json({
      ok: true,
      response: fallbackResponse,
      source: "fallback",
      note: "LLM-API nicht konfiguriert. Zeige vordefinierte Antwort."
    });
  }
  
  try {
    // Build messages array for chat completion
    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT }
    ];
    
    if (messages && Array.isArray(messages)) {
      chatMessages.push(...messages.slice(-10)); // Keep last 10 messages for context
    } else if (prompt) {
      chatMessages.push({ role: "user", content: prompt });
    }
    
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: chatMessages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9
      })
    });
    
    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq API error:", errorText);
      
      // Fallback on API error
      const fallbackResponse = getFallbackResponse(prompt || messages?.[messages.length - 1]?.content || "");
      return res.status(200).json({
        ok: true,
        response: fallbackResponse,
        source: "fallback",
        note: "LLM temporär nicht verfügbar. Zeige vordefinierte Antwort."
      });
    }
    
    const data = await groqResponse.json();
    const aiResponse = data.choices?.[0]?.message?.content || "Keine Antwort erhalten.";
    
    return res.status(200).json({
      ok: true,
      response: aiResponse,
      source: "groq",
      model: GROQ_MODEL,
      usage: data.usage
    });
    
  } catch (error) {
    console.error("Chat API error:", error);
    
    const fallbackResponse = getFallbackResponse(prompt || "");
    return res.status(200).json({
      ok: true,
      response: fallbackResponse,
      source: "fallback",
      error: "Internal error, using fallback"
    });
  }
}
