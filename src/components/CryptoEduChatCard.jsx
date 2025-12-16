import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { useCryptoEduChat } from "../lib/useCryptoEduChat";
import { APP_BRAND } from "../config/brand";

const QUICK_PROMPTS = [
  { label: "RSI erklärt", prompt: "Erkläre mir den RSI Indikator und wie ich ihn im Trading nutze" },
  { label: "Stop Loss", prompt: "Wie setze ich einen guten Stop Loss?" },
  { label: "MACD Signale", prompt: "Was sind MACD Crossover Signale?" },
  { label: "Aktuelles Signal", prompt: "Was zeigt das aktuelle Signal für diesen Asset?" },
  { label: "Take Profit", prompt: "Wo liegt das Take Profit Ziel?" },
];

const CryptoEduChatCard = ({ 
  title = "Vision AI Assistant", 
  subtitle = "Powered by Vision AI Mind",
  platformContext = {}
}) => {
  // Pass platform context to the chat hook for intelligent responses
  const { messages, sendMessage, clearMessages, isSending, error } = useCryptoEduChat(platformContext);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  const handleQuickPrompt = (prompt) => {
    sendMessage(prompt);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">{title}</h3>
          <p className="text-xs text-slate-400 leading-snug">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            >
              Clear
            </button>
          )}
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200 whitespace-nowrap">
            {APP_BRAND}
          </span>
        </div>
      </div>

      {/* Quick Prompts */}
      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => handleQuickPrompt(qp.prompt)}
              disabled={isSending}
              className="rounded-lg bg-slate-800/80 px-2 py-1 text-[11px] text-cyan-300 hover:bg-slate-700 hover:text-cyan-200 disabled:opacity-50 transition-colors"
            >
              {qp.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="max-h-64 overflow-y-auto overscroll-contain touch-pan-y rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-sm space-y-2">
          {messages.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-2">Frage mich alles über Krypto-Trading!</p>
              <p className="text-[11px] text-slate-600">RSI, MACD, Stop Loss, Order Blocks, Risk Management...</p>
            </div>
          ) : null}
          {messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              className={`rounded-lg px-3 py-2 text-sm leading-relaxed break-words ${
                m.role === "user" 
                  ? "bg-slate-800 text-slate-100 ml-4" 
                  : "bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 text-emerald-50 mr-4 border border-emerald-500/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] uppercase tracking-tight ${m.role === "user" ? "text-slate-400" : "text-emerald-400"}`}>
                  {m.role === "user" ? "Du" : "Vision AI"}
                </span>
                {m.source && m.source.includes("vision-ai") && (
                  <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                    {m.source === "vision-ai-llm" ? "LLM" : "Local"}
                  </span>
                )}
              </div>
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          ))}
          {isSending && (
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 mr-4 animate-pulse">
              <span className="text-[10px] uppercase tracking-tight text-emerald-400">Vision AI</span>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <p className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
            Hinweis: Fallback-Modus aktiv. {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage zur Crypto Education eingeben..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
          >
            {isSending ? "..." : "→"}
          </button>
        </form>
      </div>
    </div>
  );
};

CryptoEduChatCard.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  platformContext: PropTypes.shape({
    asset: PropTypes.string,
    price: PropTypes.number,
    rsi: PropTypes.number,
    macd: PropTypes.number,
    macdSignal: PropTypes.number,
    trend: PropTypes.string,
    regime: PropTypes.string,
    fearGreed: PropTypes.number,
    signal: PropTypes.string,
    confidence: PropTypes.number,
    tp: PropTypes.number,
    sl: PropTypes.number,
  }),
};

export default CryptoEduChatCard;
