import { useCallback, useEffect, useRef, useState } from "react";
import type { TournamentDetail, TournamentPairing } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { LobbyAudio } from "./LobbyAudio";

/**
 * Turnier-Lobby: der Einstieg fürs "Turnier beitreten" (DL-Copilot-Stil) – links die
 * eigenen offenen Paarungen klickbar oben, darunter zur Übersicht der komplette
 * Spielplan; rechts ein eigener Chat + Sprachchat, wie in der Hauptlobby. Getrennt
 * von der Admin-Seite (TournamentPage: Matchprofil/Zuordnung/Freigabe) – bewusst
 * keine Admin-Funktionen hier, nur die Spieler-Sicht. Chat/Sprachkanal sind eigene,
 * pro Turnier getrennte Kanäle (nicht Hub, nicht Match-Räume).
 */
export function TournamentLobby({
  app,
  tournamentId,
  onBack,
}: {
  app: AppApi;
  tournamentId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [text, setText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const chat = app.tournamentChat;

  const load = useCallback(() => {
    app
      .tournamentDetail(tournamentId)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [app, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    app.enterTournamentLobby(tournamentId).catch(() => {});
    return () => {
      void app.leaveTournamentLobby(tournamentId);
    };
  }, [app, tournamentId]);

  useEffect(() => {
    if (nearBottomRef.current) chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat.length]);

  const onChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await app.sendTournamentChat(tournamentId, t);
  };

  const start = (matchId: number) => {
    setBusy(matchId);
    app
      .startTournamentMatch(tournamentId, matchId)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(null));
  };

  if (!detail) {
    return (
      <div className="card stack">
        <button className="ghost" onClick={onBack}>
          ← Zurück
        </button>
        {error ? <div className="hint">{error}</div> : <div className="hint">Turnier wird geladen…</div>}
      </div>
    );
  }

  const myOpenPairings = detail.rounds
    .flatMap((round) => round.pairings.map((p) => ({ ...p, roundName: round.name })))
    .filter((p) => p.isMine && p.status === "open");

  const renderPairing = (p: TournamentPairing) => {
    const unresolved = !p.resolved;
    const canStart = detail.hasProfile && p.isMine && p.status === "open" && !unresolved;
    return (
      <div
        key={p.matchId}
        className="room-card"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 16,
          alignSelf: "flex-start",
          width: "auto",
          padding: "6px 12px",
        }}
      >
        <div style={{ minWidth: 0, lineHeight: 1.25 }}>
          <div style={{ fontWeight: 700 }}>{p.homeName}</div>
          <div className="hint" style={{ margin: 0 }}>
            vs.
          </div>
          <div style={{ fontWeight: 700 }}>{p.awayName}</div>
          {unresolved && (
            <div className="hint" style={{ marginTop: 4 }}>
              Nicht automatisch zuordenbar (Namen mehrdeutig oder unbekannt) – bitte manuell spielen.
            </div>
          )}
        </div>
        {canStart ? (
          <button
            className="primary"
            aria-label={p.iAmHome ? "Spiel starten" : "Beitreten"}
            title={p.iAmHome ? "Spiel starten" : "Beitreten"}
            disabled={busy === p.matchId}
            onClick={() => start(p.matchId)}
            style={{
              flex: "0 0 auto",
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: "50%",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            {busy === p.matchId ? "…" : "▶"}
          </button>
        ) : (
          <span className={`badge ${p.status === "open" ? "" : "live"}`} style={{ flex: "0 0 auto" }}>
            {p.status === "open" ? "offen" : `beendet ${p.legsHome ?? "?"}:${p.legsAway ?? "?"}`}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="ghost" onClick={onBack}>
          ← Zurück zur Lobby
        </button>
        <div style={{ textAlign: "center" }}>
          <div className="hint" style={{ letterSpacing: "0.08em" }}>
            TURNIER-LOBBY
          </div>
          <h2 className="room-title" style={{ margin: 0 }}>
            {detail.name}
          </h2>
        </div>
        <button className="ghost" onClick={load}>
          ↻ Aktualisieren
        </button>
      </div>

      {error && <div className="hint">{error}</div>}

      <div className="match-layout">
        <div className="stack">
          {!detail.hasProfile && (
            <div className="card hint">
              Für dieses Turnier ist noch kein Matchprofil festgelegt. Bitte kurz warten.
            </div>
          )}

          <div className="card stack">
            <h3 className="section-title">Deine nächsten Matches</h3>
            {myOpenPairings.length === 0 ? (
              <div className="hint">Aktuell kein offenes Match für dich.</div>
            ) : (
              <div className="room-list" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {myOpenPairings.map(renderPairing)}
              </div>
            )}
          </div>

          {detail.rounds.every((round) => round.pairings.length === 0) && (
            <div className="card hint">Noch kein Spielplan bei 3K hinterlegt.</div>
          )}

          {detail.rounds
            .filter((round) => round.pairings.length > 0)
            .map((round) => (
              <div key={round.name} className="card stack">
                <h3 className="section-title">{round.name}</h3>
                <div className="room-list" style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {round.pairings.map(renderPairing)}
                </div>
              </div>
            ))}
        </div>

        <div className="card stack chat-card">
          <h3 className="section-title">Turnier-Chat</h3>
          <LobbyAudio tournamentId={tournamentId} />
          <div
            ref={chatScrollRef}
            onScroll={onChatScroll}
            className="chat-scroll"
            role="log"
            aria-live="polite"
            aria-label="Turnier-Chat-Verlauf"
          >
            {chat.length === 0 && <div className="hint">Noch nichts gesagt.</div>}
            {chat.map((m) =>
              m.kind === "system" ? (
                <div key={m.id} className="chat-sys">
                  — {m.text} —
                </div>
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
              placeholder="Nachricht ans Turnier…"
              aria-label="Chat-Nachricht"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="primary" onClick={send}>
              Senden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
