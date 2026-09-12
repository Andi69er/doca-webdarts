import { useEffect, useRef, useState } from "react";
import type { AppApi } from "../useApp";

/**
 * Text-Chat im Raum – für Spieler UND Zuschauer. Fallback, wenn Mikro/Video
 * streikt. Zuschauer dürfen mitschreiben (aber nicht ins Voice sprechen).
 */
export function RoomChat({ app }: { app: AppApi }) {
  const room = app.room!;
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = room.chat ?? [];

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, open]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await app.sendRoomChat(t);
  };

  return (
    <div className="card stack room-chat">
      <button className="room-chat-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="section-title" style={{ margin: 0 }}>
          Chat
        </span>
        <span className="hint">
          {msgs.length ? `${msgs.length} Nachricht${msgs.length === 1 ? "" : "en"}` : "leer"} · {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <>
          <div className="room-chat-scroll" role="log" aria-live="polite">
            {msgs.length === 0 && <div className="hint">Noch nichts geschrieben.</div>}
            {msgs.map((m) =>
              m.kind === "system" ? (
                <div key={m.id} className="chat-sys">
                  — {m.text} —
                </div>
              ) : (
                <div key={m.id} className="chat-msg">
                  <span className={`cm-name ${m.role === "spectator" ? "spec" : ""}`}>
                    {m.name}
                    {m.role === "spectator" ? " 👁" : ""}
                  </span>
                  <span>{m.text}</span>
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>
          <div className="row" style={{ gap: 6 }}>
            <input
              value={text}
              maxLength={400}
              placeholder="Nachricht…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              style={{ flex: 1 }}
            />
            <button className="primary" disabled={!text.trim()} onClick={send}>
              Senden
            </button>
          </div>
        </>
      )}
    </div>
  );
}
