import { useEffect, useMemo, useRef, useState } from "react";
import { defaultConfig, type BotConfig, type HubRoomSummary } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { embed } from "../embed";
import { Avatar } from "./Avatar";
import { BotPicker } from "./BotPicker";
import { HelpModal } from "./HelpModal";
import { fetchPortalStats, type PortalStats } from "../portalStats";

const BOT_PRESETS: { key: string; label: string; average: number }[] = [
  { key: "preset:40", label: "Amateur (Ø 40)", average: 40 },
  { key: "preset:55", label: "Fortgeschritten (Ø 55)", average: 55 },
  { key: "preset:70", label: "Halbprofi (Ø 70)", average: 70 },
  { key: "preset:85", label: "Profi (Ø 85)", average: 85 },
];

export function Hub({ app }: { app: AppApi }) {
  const hub = app.hub;
  const [text, setText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [roomName, setRoomName] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [botChoice, setBotChoice] = useState("none");
  const [botCustom, setBotCustom] = useState(60);
  const pdcStars = embed?.pdcStars ?? [];

  // Portal-Karrierewerte der online sichtbaren Mitglieder (für die Hover-Blase)
  const [portal, setPortal] = useState<Record<string, PortalStats>>({});
  const portalAsked = useRef<Set<string>>(new Set());

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [hub?.chat.length]);

  useEffect(() => {
    if (!embed || !hub) return;
    const missing = hub.users
      .filter((u) => u.id.startsWith("u:"))
      .map((u) => u.id.slice(2))
      .filter((uid) => uid && !portalAsked.current.has(uid));
    if (missing.length === 0) return;
    missing.forEach((uid) => portalAsked.current.add(uid));
    void fetchPortalStats(missing).then((got) => {
      if (Object.keys(got).length > 0) setPortal((p) => ({ ...p, ...got }));
    });
  }, [hub]);

  const roomsById = useMemo(() => {
    const m = new Map<string, HubRoomSummary>();
    hub?.rooms.forEach((r) => m.set(r.roomId, r));
    return m;
  }, [hub?.rooms]);

  if (!hub)
    return (
      <div className="card">
        Lobby wird verbunden…
        <div className="hint" style={{ marginTop: 6 }}>
          Dauert es länger? Dann wird der Spielserver gerade aufgeweckt – das kann ca. 30 Sekunden
          brauchen.
        </div>
      </div>
    );

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await app.sendChat(t);
  };

  const botImg = embed ? `${embed.baseUrl}/js/dart-bot.png` : null;

  const resolveBot = (): BotConfig | null => {
    if (botChoice === "none") return null;
    if (botChoice === "custom") {
      const a = Math.max(20, Math.min(110, Math.round(botCustom)));
      return { average: a, name: `Bot (Ø ${a})`, image: botImg };
    }
    if (botChoice.startsWith("preset:")) {
      const p = BOT_PRESETS.find((x) => x.key === botChoice);
      return p ? { average: p.average, name: p.label.split(" (")[0]!, image: botImg } : null;
    }
    if (botChoice.startsWith("pdc:")) {
      const name = botChoice.slice(4);
      const star = pdcStars.find((s) => s.player === name);
      if (!star) return null;
      return {
        average: Math.round(star.average),
        name: star.player,
        image: star.image ? `${embed?.baseUrl ?? ""}/${star.image}` : null,
      };
    }
    return null;
  };

  const createRoom = () => {
    const cfg = defaultConfig(); // Spielart, Team-Größe & Rest werden in der Lobby eingestellt
    app.createRoom({
      name: roomName.trim(),
      config: cfg,
      teamNames: ["Team A", "Team B"],
      bot: resolveBot(),
    });
    setRoomName("");
    setBotChoice("none");
  };

  const statusOf = (roomId: string | null) => {
    if (!roomId) return "in der Lobby";
    const r = roomsById.get(roomId);
    if (!r) return "im Raum";
    return r.phase === "match" ? "spielt gerade" : "im Raum";
  };

  return (
    <>
      <div className="wd-hubhead">
        <div className="wd-hubhead-side">
          {embed && (
            <a className="wd-back-link" href={`${embed.baseUrl}/dart-tools.php`}>
              ← Zurück zum DOCA-Trainer
            </a>
          )}
        </div>
        <h2 className="wd-hubtitle">DOCA Webdarts</h2>
        <div className="wd-hubhead-side wd-hubhead-r">
          <button
            type="button"
            className="wd-help-btn"
            onClick={() => setHelpOpen(true)}
            aria-label="Hilfe – wie funktioniert Webdarts?"
            title="Hilfe – wie funktioniert Webdarts?"
          >
            ?
          </button>
        </div>
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <div className="hub-grid">
      {/* Online */}
      <div className="card stack">
        <h3 className="section-title">Online ({hub.users.length})</h3>
        <div className="user-list">
          {hub.users.map((u) => {
            const uid = u.id.startsWith("u:") ? u.id.slice(2) : "";
            const ps = uid ? portal[uid] : undefined;
            const view = ps
              ? {
                  average: ps.average,
                  checkoutPct: ps.checkoutPct,
                  shortestLeg: ps.shortestLeg,
                  highestFinish: ps.highestFinish,
                }
              : u.stats
                ? {
                    average: u.stats.average,
                    checkoutPct: u.stats.checkoutPct,
                    shortestLeg: u.stats.shortestLegDarts,
                    highestFinish: u.stats.highestFinish,
                  }
                : null;
            return (
              <div key={u.id} className={`user-row ${u.id === app.myId ? "me" : ""}`} tabIndex={0}>
                <Avatar src={u.image} name={u.name} size={24} />
                <span className="uname">{u.name}</span>
                <span className="ustatus">{statusOf(u.roomId)}</span>
                <div className="user-pop" role="tooltip">
                  <div className="user-pop-head">
                    <Avatar src={u.image} name={u.name} size={20} />
                    {u.name}
                  </div>
                  {view ? (
                    <>
                      <div className="user-pop-row">
                        <span>Average</span>
                        <b>{view.average.toFixed(2)}</b>
                      </div>
                      <div className="user-pop-row">
                        <span>Doppelquote</span>
                        <b>{view.checkoutPct.toFixed(1)} %</b>
                      </div>
                      <div className="user-pop-row">
                        <span>Kürzestes Leg</span>
                        <b>{view.shortestLeg != null ? `${view.shortestLeg} Darts` : "–"}</b>
                      </div>
                      <div className="user-pop-row">
                        <span>Höchstes Finish</span>
                        <b>{view.highestFinish || "–"}</b>
                      </div>
                    </>
                  ) : (
                    <div className="user-pop-empty">Noch keine Statistik vorhanden</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div className="card stack chat-card">
        <h3 className="section-title">Lobby-Chat</h3>
        <div className="chat-scroll" role="log" aria-live="polite" aria-label="Lobby-Chat-Verlauf">
          {hub.chat.length === 0 && <div className="hint">Noch nichts gesagt. Frag doch nach einem Spiel!</div>}
          {hub.chat.map((m) =>
            m.kind === "system" ? (
              <div key={m.id} className="chat-sys">— {m.text} —</div>
            ) : (
              <div key={m.id} className="chat-msg">
                <span className="cm-name">{m.name}</span>
                <span className="cm-time">
                  {new Date(m.ts).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="cm-text">{m.text}</div>
              </div>
            ),
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Nachricht an die Lobby…"
            aria-label="Chat-Nachricht"
            maxLength={400}
            style={{ flex: 1 }}
          />
          <button className="primary" onClick={send} disabled={!text.trim()}>
            Senden
          </button>
        </div>
      </div>

      {/* Räume */}
      <div className="card stack">
        <h3 className="section-title">Räume</h3>

        <div className="create-box">
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
            placeholder="Raumname (optional)"
            aria-label="Raumname (optional)"
            maxLength={40}
          />
          <div className="hint">Spielart, Team-Größe und alle Regeln stellst du danach in der Lobby ein.</div>

          <BotPicker
            value={botChoice}
            onChange={setBotChoice}
            presets={BOT_PRESETS}
            pdcStars={pdcStars}
            botImage={botImg}
            baseUrl={embed?.baseUrl ?? ""}
          />
          {botChoice === "custom" && (
            <input
              type="number"
              min={20}
              max={110}
              value={botCustom}
              aria-label="Bot-Average"
              onChange={(e) => setBotCustom(Number(e.target.value))}
            />
          )}

          <button className="primary" style={{ width: "100%" }} onClick={createRoom}>
            Raum erstellen
          </button>
        </div>

        <div className="room-list">
          {hub.rooms.length === 0 && <div className="hint">Kein offener Raum. Mach den ersten auf.</div>}
          {hub.rooms.map((r) => (
            <div key={r.roomId} className="room-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{r.name || `Raum von ${r.hostName}`}</strong>
                <span className={`badge ${r.phase === "match" ? "live" : ""}`}>
                  {r.phase === "match" ? "läuft" : "offen"}
                </span>
              </div>
              <div className="hint">
                {r.name && `Host: ${r.hostName} · `}
                {r.mode.toUpperCase()} · {r.teamSize === 2 ? "Doppel" : "Einzel"} ·{" "}
                {r.seatsFilled}/{r.seatsTotal} Plätze
                {r.spectators > 0 && ` · ${r.spectators} Zuschauer`}
              </div>
              <button onClick={() => app.enterRoom(r.roomId)}>
                {r.phase === "match" ? "Zuschauen" : "Beitreten"}
              </button>
            </div>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
