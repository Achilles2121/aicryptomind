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
const safeFixed = (val: number, digits = 2) => (Number(val) || 0).toFixed(digits);

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
    contextInfo += `\n\nCURRENT MARKET DATA (Vision AI Mind Platform):
- Asset: ${ctx.asset}
- Price: $${ctx.price?.toLocaleString() || "N/A"}`;
    
    if (ctx.rsi !== undefined) {
      const rsiStatus = ctx.rsi < 30 ? "oversold" : ctx.rsi > 70 ? "overbought" : "neutral";
      contextInfo += `\n- RSI: ${safeFixed(ctx.rsi, 1)} (${rsiStatus})`;
    }
    if (ctx.macd !== undefined && ctx.macdSignal !== undefined) {
      const macdStatus = ctx.macd > ctx.macdSignal ? "bullish" : "bearish";
      contextInfo += `\n- MACD: ${macdStatus} (${safeFixed(ctx.macd, 2)} vs Signal ${safeFixed(ctx.macdSignal, 2)})`;
    }
    if (ctx.trend) contextInfo += `\n- Trend: ${ctx.trend}`;
    if (ctx.regime) contextInfo += `\n- Market Regime: ${ctx.regime}`;
    if (ctx.fearGreed !== undefined) contextInfo += `\n- Fear & Greed Index: ${ctx.fearGreed}`;
    if (ctx.signal) contextInfo += `\n- Current Signal: ${ctx.signal} (${(ctx.confidence || 0) * 100}% confidence)`;
    if (ctx.tp) contextInfo += `\n- Take Profit Target: $${ctx.tp.toLocaleString()}`;
    if (ctx.sl) contextInfo += `\n- Stop Loss: $${ctx.sl.toLocaleString()}`;
  }

  return `You are Vision AI, the intelligent trading assistant of the Vision AI Mind platform.

YOUR IDENTITY:
- You are called "Vision AI" and are part of the Vision AI Mind Trading Platform
- You analyze real-time market data and explain trading concepts
- You are an educator, NOT a financial advisor

YOUR EXPERTISE:
- Technical Analysis (RSI, MACD, Bollinger Bands, EMA, VWAP, Order Blocks, Fair Value Gaps)
- Fundamental Analysis (On-Chain Metrics, TVL, Funding Rates, Open Interest)
- Risk Management (Position Sizing, Stop Loss, Take Profit, R/R Ratio)
- Market Cycles (BTC Dominance, Alt Season, Market Regimes)
- DeFi Concepts (Liquidity Mining, Yield Farming, AMMs)
${contextInfo}

RULES:
1. Start EVERY response with "Vision AI:" 
2. Analyze current platform data when relevant
3. Explain complex concepts simply and understandably
4. Use market data to provide context (NO buy recommendations!)
5. Answer precisely and structured (max 250 words)
6. For questions about current values: Refer to the platform data above
7. ALWAYS warn: "This is not investment advice. Own research required."
8. Answer in the language of the question (German or English)`;
};

// Intelligent context-aware responses
const getContextualResponse = (prompt: string, ctx: PlatformContext): string => {
  const lower = prompt.toLowerCase();
  const hasCtx = ctx.asset && ctx.price;
  
  // RSI questions
  if (lower.includes("rsi")) {
    if (hasCtx && ctx.rsi !== undefined) {
      const status = ctx.rsi < 30 ? "oversold (potentially bullish)" : 
                     ctx.rsi > 70 ? "overbought (caution with longs)" : "neutral";
      return `Vision AI: The current RSI for ${ctx.asset} is at ${safeFixed(ctx.rsi, 1)} - that is ${status}.

The RSI (Relative Strength Index) measures momentum on a scale of 0-100:
- Below 30: Oversold - often followed by recovery
- Above 70: Overbought - consolidation/correction possible
- 40-60: Neutral Zone

Important: RSI alone is not a trading signal. On Vision AI Mind we combine RSI with MACD, volume and Market Regime for better signals.

Note: This is not investment advice. Own research required.`;
    }
    return `Vision AI: The RSI (Relative Strength Index) is a momentum indicator.

Values below 30 = oversold, above 70 = overbought. On our platform you can see the RSI trend in the chart with color highlighting.

Note: This is not investment advice.`;
  }
  
  // MACD questions
  if (lower.includes("macd")) {
    if (hasCtx && ctx.macd !== undefined) {
      const status = ctx.macd > (ctx.macdSignal || 0) ? "bullish (MACD above signal)" : "bearish (MACD below signal)";
      return `Vision AI: The MACD for ${ctx.asset} is currently ${status}.

MACD shows trend momentum:
- MACD above signal line = upward momentum
- MACD below signal line = downward momentum  
- Histogram shows the difference

On Vision AI Mind you see MACD crossovers and divergences automatically marked.

Note: This is not investment advice. Own research required.`;
    }
  }
  
  // Price questions
  if (lower.includes("preis") || lower.includes("price") || lower.includes("aktuell") || lower.includes("current")) {
    if (hasCtx) {
      let response = `Vision AI: ${ctx.asset} is currently trading at $${ctx.price?.toLocaleString()}.`;
      if (ctx.regime) response += ` The market regime is "${ctx.regime}".`;
      if (ctx.signal) response += ` Our signal shows: ${ctx.signal} (${safeFixed((ctx.confidence || 0) * 100, 0)}% confidence).`;
      response += `\n\nNote: This is not investment advice. Own research required.`;
      return response;
    }
  }
  
  // Signal/Trade questions
  if (lower.includes("signal") || lower.includes("trade") || lower.includes("kaufen") || lower.includes("verkaufen") || lower.includes("buy") || lower.includes("sell")) {
    if (hasCtx && ctx.signal) {
      return `Vision AI: Based on our algorithms, ${ctx.asset} shows a "${ctx.signal}" signal with ${safeFixed((ctx.confidence || 0) * 100, 0)}% confidence.

${ctx.tp ? `- Take Profit Target: $${ctx.tp.toLocaleString()}` : ""}
${ctx.sl ? `- Stop Loss: $${ctx.sl.toLocaleString()}` : ""}

Our signals are based on RSI, MACD, Market Regime and other factors - they are NOT buy recommendations, but for educational purposes.

Note: This is not investment advice. Own research and risk management are essential!`;
    }
    return `Vision AI: On Vision AI Mind we calculate signals based on technical analysis (RSI, MACD, Bollinger Bands) and Market Regime.

Signals show probabilities, not guarantees. Always apply your own risk management!

Note: This is not investment advice.`;
  }
  
  // Stop Loss / Take Profit
  if (lower.includes("stop") || lower.includes("loss") || lower.includes("take profit") || lower.includes("tp") || lower.includes("sl")) {
    if (hasCtx && (ctx.tp || ctx.sl)) {
      return `Vision AI: For ${ctx.asset} at $${ctx.price?.toLocaleString()} our platform calculates:

${ctx.tp ? `- Take Profit: $${ctx.tp.toLocaleString()} (+${safeFixed(((ctx.tp - (ctx.price || 0)) / (ctx.price || 1)) * 100, 1)}%)` : ""}
${ctx.sl ? `- Stop Loss: $${ctx.sl.toLocaleString()} (-${safeFixed(((ctx.price || 0) - ctx.sl) / (ctx.price || 1) * 100, 1)}%)` : ""}

These values are based on ATR (Average True Range) and Market Regime. You can adjust them in the TP/SL calculator.

Note: This is not investment advice. Adjust stops to your risk profile!`;
    }
  }
  
  // Fear & Greed
  if (lower.includes("fear") || lower.includes("greed") || lower.includes("sentiment") || lower.includes("stimmung")) {
    if (hasCtx && ctx.fearGreed !== undefined) {
      const status = ctx.fearGreed < 30 ? "Extreme Fear (historically often buying opportunity)" :
                     ctx.fearGreed > 70 ? "Greed (caution with new positions)" : "Neutral";
      return `Vision AI: The Fear & Greed Index is at ${ctx.fearGreed} - ${status}.

The index measures market sentiment from 0 (Extreme Fear) to 100 (Extreme Greed). Historically, extreme fear phases were often good entry points - but no guarantee!

Note: This is not investment advice.`;
    }
  }
  
  // Default response
  return `Vision AI: That's a good question! As a trading educator on Vision AI Mind I'm happy to explain concepts.

On our platform you'll find:
- Live prices with RSI, MACD, Bollinger Bands
- AI-based signals with confidence values
- TP/SL calculator with ATR calculation
- Market Regime Analysis

Ask me about specific topics like RSI, MACD, Stop Loss, Fibonacci or trading strategies!

Note: Vision AI Mind offers education, not investment advice.`;
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
    
  } catch (_error) {
    const response = getContextualResponse(userMessage, platformContext);
    return res.status(200).json({ ok: true, response, source: "vision-ai-fallback" });
  }
}

