import { useCallback, useEffect, useState } from "react";
import type { TournamentDetail } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { Modal } from "./Modal";
import { TournamentProfileForm } from "./TournamentProfileForm";

const ADMIN_NAME = "Andi69er";

/**
 * "Zum Turnier"-Seite: DL-Copilot-Ersatz. Zeigt den 3K-Spielplan, meine
 * eigenen Paarungen sind klickbar und starten direkt ein vorbefülltes Match.
 */
export function TournamentPage({
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
  const [profileOpen, setProfileOpen] = useState(false);
  const isAdmin = app.name === ADMIN_NAME;

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

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="ghost" onClick={onBack}>
          ← Zurück zur Lobby
        </button>
        <h2 className="room-title">{detail.name}</h2>
        <div className="row">
          {isAdmin && (
            <button className="ghost" onClick={() => setProfileOpen(true)}>
              Matchprofil festlegen
            </button>
          )}
          <button className="ghost" onClick={load}>
            ↻ Aktualisieren
          </button>
        </div>
      </div>

      {error && <div className="hint">{error}</div>}

      {!detail.hasProfile && (
        <div className="card hint">
          {isAdmin
            ? "Für dieses Turnier ist noch kein Matchprofil festgelegt – Paarungen können erst gestartet werden, sobald das erledigt ist."
            : "Für dieses Turnier ist noch kein Matchprofil festgelegt. Bitte kurz warten."}
        </div>
      )}

      {detail.rounds.every((round) => round.pairings.length === 0) && (
        <div className="card hint">Noch kein Spielplan bei 3K hinterlegt.</div>
      )}

      {detail.rounds
        .filter((round) => round.pairings.length > 0)
        .map((round) => (
        <div key={round.name} className="card stack">
          <h3 className="section-title">{round.name}</h3>
          <div className="room-list">
            {round.pairings.map((p) => {
              const unresolved = !p.resolved;
              const canStart = detail.hasProfile && p.isMine && p.status === "open" && !unresolved;
              return (
                <div key={p.matchId} className="room-card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>
                      {p.homeName} vs. {p.awayName}
                    </strong>
                    <span className={`badge ${p.status === "open" ? "" : "live"}`}>
                      {p.status === "open"
                        ? "offen"
                        : `beendet ${p.legsHome ?? "?"}:${p.legsAway ?? "?"}`}
                    </span>
                  </div>
                  {unresolved && (
                    <div className="hint">
                      Nicht automatisch zuordenbar (Namen mehrdeutig oder unbekannt) – bitte manuell spielen.
                    </div>
                  )}
                  {canStart && (
                    <button className="primary" disabled={busy === p.matchId} onClick={() => start(p.matchId)}>
                      {p.iAmHome
                        ? busy === p.matchId
                          ? "Öffne Raum…"
                          : "Spiel starten"
                        : busy === p.matchId
                          ? "Trete bei…"
                          : "Beitreten"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {profileOpen && (
        <Modal title="Matchprofil festlegen" onClose={() => setProfileOpen(false)}>
          <TournamentProfileForm
            initial={detail.profile}
            isDouble={detail.isDouble}
            onCancel={() => setProfileOpen(false)}
            onSave={(config) => {
              app
                .setTournamentProfile(tournamentId, config)
                .then(() => {
                  setProfileOpen(false);
                  load();
                })
                .catch((e) => setError((e as Error).message));
            }}
          />
        </Modal>
      )}
    </div>
  );
}
