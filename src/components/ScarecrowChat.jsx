import { useEffect, useRef, useState } from "react";

const API_PREFIX = "/api";

const TYPING_STEP = 1;
const TYPING_INTERVAL_MS = 110;

function toPayloadMessages(history) {
  return history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

function getCharacterMeta(character) {
  if (character === "cat") {
    return { name: "小吨", portrait: "/images/FarmSpeakers/小吨.png" };
  }
  if (character === "dog") {
    return { name: "妖妖灵", portrait: "/images/FarmSpeakers/妖妖灵.png" };
  }
  return { name: "稻草人", portrait: "/images/Decorations/grassman.png" };
}

export default function ScarecrowChat({
  open,
  onClose,
  onSummary,
  character = "scarecrow",
  messages,
  setMessages,
  sharedMemory,
  setSharedMemory,
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const typingTimerRef = useRef(null);

  const { name: npcName, portrait } = getCharacterMeta(character);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

  if (!open) return null;

  const streamBotReply = (fullText) => {
    const text = String(fullText || "");
    if (!text) return;

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    setBotTyping(true);
    setMessages([...(messages || []), { role: "bot", text: "" }]);

    let index = 0;

    typingTimerRef.current = setInterval(() => {
      index += TYPING_STEP;

      setMessages((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        if (!arr.length) return arr;

        const next = [...arr];
        const last = next[next.length - 1];
        if (!last || last.role !== "bot") return arr;

        next[next.length - 1] = { ...last, text: text.slice(0, index) };
        return next;
      });

      if (index >= text.length) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        setTimeout(() => setBotTyping(false), 500);
      }
    }, TYPING_INTERVAL_MS);
  };

  const handleSend = async (e) => {
    e.preventDefault();

    const text = input.trim();
    if (!text || sending || botTyping) return;

    const newHistory = [...(messages || []), { role: "user", text }];
    setMessages(newHistory);
    setInput("");
    setSending(true);

    try {
      const payloadMessages = toPayloadMessages(newHistory);

      const res = await fetch(`${API_PREFIX}/scarecrow/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker: character,
          memory: sharedMemory,
          messages: payloadMessages,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("chat bad status:", res.status, t);
        throw new Error("chat bad status");
      }

      const data = await res.json();
      streamBotReply(data.reply || "……");
    } catch (err) {
      console.error("chat fetch error:", err);
      setMessages((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        { role: "bot", text: "嗯……我这会儿好像有点听不清，可以稍后再试吗？" },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleEnd = async () => {
    try {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      setBotTyping(false);

      const payloadMessages = toPayloadMessages(messages || []);

      const res = await fetch(`${API_PREFIX}/scarecrow/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error("summary bad status:", res.status, t);
        throw new Error("summary bad status");
      }

      const data = await res.json();

      onSummary?.({ event: data.event || "", emotion: data.emotion || "" });

      setSharedMemory?.((prev) => ({
        ...(prev || {}),
        lastSpeaker: character,
        lastAt: new Date().toISOString(),
        lastEvent: data.event || prev?.lastEvent || "",
        lastEmotion: data.emotion || prev?.lastEmotion || "",
        lastSummaryText: `${data.event || ""} / ${data.emotion || ""}`.trim(),
      }));
    } catch (err) {
      console.error("summary fetch error:", err);
    } finally {
      onClose?.();
    }
  };

  const speaking = botTyping;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: "80vw",
          maxWidth: 960,
          minHeight: 160,
          marginBottom: 16,
          background: "rgba(10, 10, 15, 0.8)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.18)",
          display: "flex",
          overflow: "hidden",
          color: "#fff",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 14,
          pointerEvents: "auto",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            width: 140,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 4px 4px 10px",
          }}
        >
          <img
            src={portrait}
            alt={npcName}
            style={{
              width: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              transform: speaking
                ? "scale(1.08) translateY(-6px)"
                : "scale(1) translateY(-2px)",
              filter: speaking ? "brightness(1.0)" : "brightness(0.6)",
              transition: "transform 0.25s ease-out, filter 0.25s ease-out",
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "10px 16px 8px 10px",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{npcName}</span>
            <button
              type="button"
              onClick={handleEnd}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffb3b3",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              结束对话
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: 4,
              marginBottom: 6,
            }}
          >
            {(messages || []).length === 0 && (
              <div style={{ opacity: 0.8 }}>
                你好呀，把今天发生的事情告诉我吧，我会帮你整理成“事件 + 心情”。
              </div>
            )}

            {(messages || []).map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    maxWidth: 420,
                    padding: "6px 10px",
                    borderRadius: 10,
                    background:
                      m.role === "user"
                        ? "rgba(255,204,102,0.25)"
                        : "rgba(255,255,255,0.08)",
                    border:
                      m.role === "user"
                        ? "1px solid rgba(255,204,102,0.8)"
                        : "1px solid rgba(255,255,255,0.15)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`对${npcName}说点什么...`}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.25)",
                padding: "0 10px",
                outline: "none",
                background: "rgba(5,5,10,0.9)",
                color: "#fff",
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              disabled={sending || botTyping}
              style={{
                minWidth: 72,
                borderRadius: 8,
                border: "none",
                background:
                  sending || botTyping ? "#777" : "rgba(255,204,102,1)",
                color: "#402000",
                fontWeight: 600,
                cursor: sending || botTyping ? "default" : "pointer",
                fontSize: 13,
                padding: "0 14px",
              }}
            >
              发送
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}