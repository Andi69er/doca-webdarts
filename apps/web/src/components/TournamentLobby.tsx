import { useCallback, useEffect, useState } from "react";
import type { TournamentDetail, TournamentPairing } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { LobbyAudio } from "./LobbyAudio";

/**
 * Turnier-Lobby: der Einstieg fürs "Turnier beitreten" (DL-Copilot-Stil) – zeigt zuerst
 * die eigenen offenen Paarungen klickbar oben, darunter zur Übersicht den kompletten
 * Spielplan. Getrennt von der Admin-Seite (TournamentPage: Matchprofil/Zuordnung/
 * Freigabe) – bewusst keine Admin-Funktionen hier, nur die Spieler-Sicht. Eigener
 * Sprachkanal pro Turnier (getrennt von Hub und Match-Räumen).
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
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{p.homeName}</div>
          <div className="hint" style={{ margin: "1px 0" }}>
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

      <div className="card">
        <LobbyAudio tournamentId={tournamentId} />
      </div>

      {!detail.hasProfile && (
        <div className="card hint">Für dieses Turnier ist noch kein Matchprofil festgelegt. Bitte kurz warten.</div>
      )}

      <div className="card stack">
        <h3 className="section-title">Deine nächsten Matches</h3>
        {myOpenPairings.length === 0 ? (
          <div className="hint">Aktuell kein offenes Match für dich.</div>
        ) : (
          <div className="room-list">{myOpenPairings.map(renderPairing)}</div>
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
            <div className="room-list">{round.pairings.map(renderPairing)}</div>
          </div>
        ))}
    </div>
  );
}
