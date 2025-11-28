import React, { useState } from "react";
import PropTypes from "prop-types";
import { useCryptoEduChat } from "../lib/useCryptoEduChat";
import { APP_BRAND } from "../config/brand";

const CryptoEduChatCard = ({ title = "Crypto Education AI Chat", subtitle = "FinGPT / Llama-Style Stub" }) => {
  const { messages, sendMessage, isSending } = useCryptoEduChat();
  const [input, setInput] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">{title}</h3>
          <p className="text-xs text-slate-400 leading-snug">{subtitle}</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200 whitespace-nowrap">
          {APP_BRAND}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <div className="max-h-48 overflow-y-auto overscroll-contain touch-pan-y rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-sm space-y-2">
          {messages.length === 0 ? <p className="text-xs text-slate-500">Stelle eine Frage, z.B. „Was sind Funding Rates?“</p> : null}
          {messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              className={`rounded-lg px-2 py-1 text-sm leading-snug break-words ${m.role === "user" ? "bg-slate-800 text-slate-100" : "bg-emerald-500/10 text-emerald-100"}`}
            >
              <span className="text-[11px] uppercase tracking-tight text-slate-400 mr-2">{m.role}</span>
              <span className="align-middle">{m.content}</span>
            </div>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage zur Crypto Education eingeben..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60 whitespace-nowrap"
          >
            {isSending ? "Sende..." : "Senden"}
          </button>
        </form>
      </div>
    </div>
  );
};

CryptoEduChatCard.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
};

export default CryptoEduChatCard;
