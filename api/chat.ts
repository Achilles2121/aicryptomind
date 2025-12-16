// Vision AI Mind - Intelligent Crypto Trading Assistant
// Analyzes platform data and provides contextual answers

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
const GROQ_MODEL = "llama-3.1-8b-instant";

// Platform context for intelligent responses
type PlatformContext = {
  asset?: string;
  price?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  trend?: string;
  regime?: string;
  fearGreed?: number;
  signal?: string;
  confidence?: number;
  tp?: number;
  sl?: number;
};

const buildSystemPrompt = (ctx: PlatformContext) => {
  let contextInfo = "";
  
  if (ctx.asset && ctx.price) {
    contextInfo += `\n\nAKTUELLE MARKTDATEN (Vision AI Mind Platform):
- Asset: ${ctx.asset}
- Preis: $${ctx.price?.toLocaleString() || "N/A"}`;
    
    if (ctx.rsi !== undefined) {
      const rsiStatus = ctx.rsi < 30 ? "überverkauft" : ctx.rsi > 70 ? "überkauft" : "neutral";
      contextInfo += `\n- RSI: ${ctx.rsi.toFixed(1)} (${rsiStatus})`;
    }
    if (ctx.macd !== undefined && ctx.macdSignal !== undefined) {
      const macdStatus = ctx.macd > ctx.macdSignal ? "bullish" : "bearish";
      contextInfo += `\n- MACD: ${macdStatus} (${ctx.macd.toFixed(2)} vs Signal ${ctx.macdSignal.toFixed(2)})`;
    }
    if (ctx.trend) contextInfo += `\n- Trend: ${ctx.trend}`;
    if (ctx.regime) contextInfo += `\n- Markt-Regime: ${ctx.regime}`;
    if (ctx.fearGreed !== undefined) contextInfo += `\n- Fear & Greed Index: ${ctx.fearGreed}`;
    if (ctx.signal) contextInfo += `\n- Aktuelles Signal: ${ctx.signal} (${(ctx.confidence || 0) * 100}% Konfidenz)`;
    if (ctx.tp) contextInfo += `\n- Take Profit Ziel: $${ctx.tp.toLocaleString()}`;
    if (ctx.sl) contextInfo += `\n- Stop Loss: $${ctx.sl.toLocaleString()}`;
  }

  return `Du bist Vision AI, der intelligente Trading-Assistent der Vision AI Mind Plattform.

DEINE IDENTITÄT:
- Du heißt "Vision AI" und bist Teil der Vision AI Mind Trading-Plattform
- Du analysierst Echtzeit-Marktdaten und erklärst Trading-Konzepte
- Du bist ein Educator, KEIN Finanzberater

DEINE EXPERTISE:
- Technische Analyse (RSI, MACD, Bollinger Bands, EMA, VWAP, Order Blocks, Fair Value Gaps)
- Fundamentalanalyse (On-Chain-Metriken, TVL, Funding Rates, Open Interest)
- Risk Management (Position Sizing, Stop Loss, Take Profit, R/R-Verhältnis)
- Marktzyklen (BTC Dominance, Alt Season, Market Regimes)
- DeFi-Konzepte (Liquidity Mining, Yield Farming, AMMs)
${contextInfo}

REGELN:
1. Beginne JEDE Antwort mit "Vision AI:" 
2. Analysiere die aktuellen Plattform-Daten wenn relevant
3. Erkläre komplexe Konzepte einfach und verständlich
4. Nutze die Marktdaten um Kontext zu geben (KEINE Kaufempfehlungen!)
5. Antworte präzise und strukturiert (max 250 Wörter)
6. Bei Fragen zu aktuellen Werten: Beziehe dich auf die Plattform-Daten oben
7. Warne IMMER: "Dies ist keine Anlageberatung. Eigene Recherche erforderlich."
8. Antworte in der Sprache der Frage (Deutsch oder Englisch)`;
};

// Intelligent context-aware responses
const getContextualResponse = (prompt: string, ctx: PlatformContext): string => {
  const lower = prompt.toLowerCase();
  const hasCtx = ctx.asset && ctx.price;
  
  // RSI questions
  if (lower.includes("rsi")) {
    if (hasCtx && ctx.rsi !== undefined) {
      const status = ctx.rsi < 30 ? "überverkauft (potenziell bullish)" : 
                     ctx.rsi > 70 ? "überkauft (Vorsicht bei Longs)" : "neutral";
      return `Vision AI: Der aktuelle RSI für ${ctx.asset} liegt bei ${ctx.rsi.toFixed(1)} - das ist ${status}.

Der RSI (Relative Strength Index) misst Momentum auf einer Skala von 0-100:
• Unter 30: Überverkauft - oft folgt eine Erholung
• Über 70: Überkauft - Konsolidierung/Korrektur möglich
• 40-60: Neutral Zone

Wichtig: RSI allein ist kein Handelssignal. Auf Vision AI Mind kombinieren wir RSI mit MACD, Volumen und Market Regime für bessere Signale.

⚠️ Dies ist keine Anlageberatung. Eigene Recherche erforderlich.`;
    }
    return `Vision AI: Der RSI (Relative Strength Index) ist ein Momentum-Indikator.

Werte unter 30 = überverkauft, über 70 = überkauft. Auf unserer Plattform siehst du den RSI-Verlauf im Chart mit farblicher Hervorhebung.

⚠️ Dies ist keine Anlageberatung.`;
  }
  
  // MACD questions
  if (lower.includes("macd")) {
    if (hasCtx && ctx.macd !== undefined) {
      const status = ctx.macd > (ctx.macdSignal || 0) ? "bullish (MACD über Signal)" : "bearish (MACD unter Signal)";
      return `Vision AI: Der MACD für ${ctx.asset} ist aktuell ${status}.

MACD zeigt Trend-Momentum:
• MACD über Signallinie = Aufwärtsmomentum
• MACD unter Signallinie = Abwärtsmomentum  
• Histogramm zeigt die Differenz

Auf Vision AI Mind siehst du MACD-Crossovers und Divergenzen automatisch markiert.

⚠️ Dies ist keine Anlageberatung. Eigene Recherche erforderlich.`;
    }
  }
  
  // Price questions
  if (lower.includes("preis") || lower.includes("price") || lower.includes("aktuell")) {
    if (hasCtx) {
      let response = `Vision AI: ${ctx.asset} notiert aktuell bei $${ctx.price?.toLocaleString()}.`;
      if (ctx.regime) response += ` Das Markt-Regime ist "${ctx.regime}".`;
      if (ctx.signal) response += ` Unser Signal zeigt: ${ctx.signal} (${((ctx.confidence || 0) * 100).toFixed(0)}% Konfidenz).`;
      response += `\n\n⚠️ Dies ist keine Anlageberatung. Eigene Recherche erforderlich.`;
      return response;
    }
  }
  
  // Signal/Trade questions
  if (lower.includes("signal") || lower.includes("trade") || lower.includes("kaufen") || lower.includes("verkaufen")) {
    if (hasCtx && ctx.signal) {
      return `Vision AI: Basierend auf unseren Algorithmen zeigt ${ctx.asset} ein "${ctx.signal}"-Signal mit ${((ctx.confidence || 0) * 100).toFixed(0)}% Konfidenz.

${ctx.tp ? `• Take Profit Ziel: $${ctx.tp.toLocaleString()}` : ""}
${ctx.sl ? `• Stop Loss: $${ctx.sl.toLocaleString()}` : ""}

Unsere Signale basieren auf RSI, MACD, Market Regime und weiteren Faktoren - sie sind KEINE Kaufempfehlung, sondern Bildungszwecke.

⚠️ Dies ist keine Anlageberatung. Eigene Recherche und Risikomanagement sind essentiell!`;
    }
    return `Vision AI: Auf Vision AI Mind berechnen wir Signale basierend auf technischer Analyse (RSI, MACD, Bollinger Bands) und Market Regime.

Signale zeigen Wahrscheinlichkeiten, keine Garantien. Immer eigenes Risikomanagement anwenden!

⚠️ Dies ist keine Anlageberatung.`;
  }
  
  // Stop Loss / Take Profit
  if (lower.includes("stop") || lower.includes("loss") || lower.includes("take profit") || lower.includes("tp") || lower.includes("sl")) {
    if (hasCtx && (ctx.tp || ctx.sl)) {
      return `Vision AI: Für ${ctx.asset} bei $${ctx.price?.toLocaleString()} berechnet unsere Plattform:

${ctx.tp ? `• Take Profit: $${ctx.tp.toLocaleString()} (+${(((ctx.tp - (ctx.price || 0)) / (ctx.price || 1)) * 100).toFixed(1)}%)` : ""}
${ctx.sl ? `• Stop Loss: $${ctx.sl.toLocaleString()} (-${(((ctx.price || 0) - ctx.sl) / (ctx.price || 1) * 100).toFixed(1)}%)` : ""}

Diese Werte basieren auf ATR (Average True Range) und Market Regime. Du kannst sie im TP/SL-Rechner anpassen.

⚠️ Dies ist keine Anlageberatung. Passe Stops an dein Risikoprofil an!`;
    }
  }
  
  // Fear & Greed
  if (lower.includes("fear") || lower.includes("greed") || lower.includes("sentiment") || lower.includes("stimmung")) {
    if (hasCtx && ctx.fearGreed !== undefined) {
      const status = ctx.fearGreed < 30 ? "Extreme Fear (oft Kaufgelegenheit historisch)" :
                     ctx.fearGreed > 70 ? "Greed (Vorsicht bei neuen Positionen)" : "Neutral";
      return `Vision AI: Der Fear & Greed Index steht bei ${ctx.fearGreed} - ${status}.

Der Index misst Marktstimmung von 0 (Extreme Fear) bis 100 (Extreme Greed). Historisch waren extreme Fear-Phasen oft gute Einstiegspunkte - aber keine Garantie!

⚠️ Dies ist keine Anlageberatung.`;
    }
  }
  
  // Default response
  return `Vision AI: Das ist eine gute Frage! Als Trading-Educator auf Vision AI Mind erkläre ich gerne Konzepte.

Auf unserer Plattform findest du:
• Live-Preise mit RSI, MACD, Bollinger Bands
• AI-basierte Signale mit Konfidenzwerten
• TP/SL-Rechner mit ATR-Berechnung
• Market Regime Analyse

Frag mich zu spezifischen Themen wie RSI, MACD, Stop Loss, Fibonacci oder Trading-Strategien!

⚠️ Vision AI Mind bietet Education, keine Anlageberatung.`;
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  
  const { prompt, messages, context } = req.body || {};
  
  if (!prompt && (!messages || !messages.length)) {
    return res.status(400).json({ ok: false, error: "Missing prompt" });
  }
  
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) {
    const fallback = getContextualResponse(prompt || "", context || {});
    return res.status(200).json({ ok: true, response: fallback, source: "vision-ai-fallback" });
  }
  
  const platformContext: PlatformContext = context || {};
  const userMessage = prompt || messages?.[messages.length - 1]?.content || "";
  
  // If no API key, use intelligent contextual fallback
  if (!GROQ_API_KEY) {
    const response = getContextualResponse(userMessage, platformContext);
    return res.status(200).json({ ok: true, response, source: "vision-ai" });
  }
  
  try {
    const systemPrompt = buildSystemPrompt(platformContext);
    const chatMessages = [{ role: "system", content: systemPrompt }];
    
    if (messages && Array.isArray(messages)) {
      chatMessages.push(...messages.slice(-8));
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
        max_tokens: 400,
        temperature: 0.7
      })
    });
    
    if (!groqResponse.ok) {
      const response = getContextualResponse(userMessage, platformContext);
      return res.status(200).json({ ok: true, response, source: "vision-ai-fallback" });
    }
    
    const data = await groqResponse.json();
    let aiResponse = data.choices?.[0]?.message?.content || "";
    
    // Ensure response starts with Vision AI branding
    if (!aiResponse.startsWith("Vision AI")) {
      aiResponse = "Vision AI: " + aiResponse;
    }
    
    return res.status(200).json({
      ok: true,
      response: aiResponse,
      source: "vision-ai-llm",
      model: GROQ_MODEL
    });
    
  } catch (error) {
    const response = getContextualResponse(userMessage, platformContext);
    return res.status(200).json({ ok: true, response, source: "vision-ai-fallback" });
  }
}
