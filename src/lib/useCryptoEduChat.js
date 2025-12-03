import { useState } from "react";

export const useCryptoEduChat = () => {
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = async (content) => {
    if (!content?.trim()) return;
    const userMsg = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);
    try {
      // TODO: Hook up backend LLM endpoint here (e.g. /api/crypto-edu-chat)
      // const res = await fetch("/api/crypto-edu-chat", { method: "POST", body: JSON.stringify({ prompt: content }) });
      // const data = await res.json();
      const mock = "Dies ist eine Beispielantwort. Das echte LLM-Backend wird spaeter angebunden.";
      await new Promise((resolve) => setTimeout(resolve, 400));
      setMessages((prev) => [...prev, { role: "assistant", content: mock }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Fehler beim Abruf der AI-Antwort." }]);
    } finally {
      setIsSending(false);
    }
  };

  return { messages, sendMessage, isSending };
};
