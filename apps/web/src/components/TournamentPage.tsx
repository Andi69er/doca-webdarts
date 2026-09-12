import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchConfig, TournamentDetail } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { Modal } from "./Modal";
import { TournamentProfileForm } from "./TournamentProfileForm";
import { TournamentBracket, slotLabel } from "./TournamentBracket";
import { formatSummary } from "./RoomLobby";
import { embed } from "../embed";

const ADMIN_NAME = "Andi69er";

/** Bei Doppel: welcher der beiden Nachnamen aus "Nachname1 & Nachname2" steckt in diesem Slot. */
function namePart(full: string, slot: 0 | 1, isDouble: boolean): string {
  if (!isDouble) return full;
  const parts = full.split("&").map((s) => s.trim());
  return parts[slot] || full;
}

/** Admin-Picker: DOCA-Mitglied per Namenseingabe (Datalist) auswählen und zuordnen. */
function PlayerPicker({ label, onAssign }: { label: string; onAssign: (uid: string) => void }) {
  const [txt, setTxt] = useState("");
  const members = embed?.members ?? [];
  const commit = () => {
    const v = txt.trim();
    if (!v) return;
    const m = members.find((x) => x.name.toLowerCase() === v.toLowerCase());
    if (m) {
      onAssign(m.id);
      setTxt("");
    }
  };
  return (
    <div className="row" style={{ gap: 6, alignItems: "center" }}>
      <span className="hint" style={{ minWidth: 100 }}>
        {label}:
      </span>
      <input
        list="wd-tournament-members"
        placeholder="DOCA-Mitglied wählen"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={{ minWidth: 0, flex: 1 }}
      />
    </div>
  );
}

/**
 * "Zum Turnier"-Seite: DL-Copilot-Ersatz. Zeigt den 3K-Spielplan, meine
 * eigenen Paarungen sind klickbar und starten direkt ein vorbefülltes Match.
 */
export function TournamentPage({
  app,
  tournamentId,
  onBack,
  onOpenLobby,
}: {
  app: AppApi;
  tournamentId: string;
  onBack: () => void;
  /** Zur Turnier-Lobby (Spieler-Sicht) wechseln, z.B. um das Ergebnis zu prüfen. */
  onOpenLobby: (id: string) => void;
}) {
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // roundId null = Turnier-Standardprofil, sonst rundenspezifisches Profil (Achtelfinale etc.).
  const [editing, setEditing] = useState<{ roundId: number | null; initial: MatchConfig | null } | null>(null);
  const [showBracket, setShowBracket] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const isAdmin = app.name === ADMIN_NAME;
  // useApp() liefert bei jedem Render ein neues Objekt - load() darf deshalb nicht
  // von `app` selbst abhängen, sonst laedt die Seite bei jeder Hub-Aenderung
  // irgendwo (z.B. fremde Chat-Nachricht) die Turnierdaten neu, bis der
  // Rate-Limiter zuschlaegt ("Zu viele Anfragen"). appRef haelt die aktuellen
  // Methoden, ohne dass der Effekt daran haengen muss.
  const appRef = useRef(app);
  useEffect(() => {
    appRef.current = app;
  });

  const load = useCallback(() => {
    appRef.current
      .tournamentDetail(tournamentId)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profileSaved) return;
    const t = setTimeout(() => setProfileSaved(false), 4000);
    return () => clearTimeout(t);
  }, [profileSaved]);

  const start = (matchId: number) => {
    setBusy(matchId);
    app
      .startTournamentMatch(tournamentId, matchId)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(null));
  };

  const assignOverride = (participantName: string, slot: 0 | 1, uid: string) => {
    app
      .setTournamentPlayerOverride(tournamentId, participantName, slot, uid)
      .then(load)
      .catch((e) => setError((e as Error).message));
  };

  const togglePublished = () => {
    if (!detail) return;
    app
      .setTournamentPublished(tournamentId, !detail.published)
      .then(load)
      .catch((e) => setError((e as Error).message));
  };

  const remove = () => {
    // Nur unsere eigene Verknüpfung, rührt 3K nicht an.
    app.removeTournament(tournamentId).then(onBack).catch((e) => setError((e as Error).message));
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

  const members = embed?.members ?? [];

  return (
    <div className="stack">
      {isAdmin && members.length > 0 && (
        <datalist id="wd-tournament-members">
          {members.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>
      )}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="ghost" onClick={onBack}>
          ← Zurück zur Lobby
        </button>
        <h2 className="room-title">{detail.name}</h2>
        <div className="row">
          {isAdmin && (
            <button className="ghost" onClick={() => setEditing({ roundId: null, initial: detail.profile })}>
              Standard-Matchprofil festlegen
            </button>
          )}
          {isAdmin && (
            <button className={detail.published ? "ghost" : "primary"} onClick={togglePublished}>
              {detail.published ? "Zurückziehen" : "Für Teilnehmer freigeben"}
            </button>
          )}
          <button className="ghost" onClick={() => onOpenLobby(tournamentId)}>
            Zur Turnierlobby
          </button>
          {detail.rounds.some((r) => r.typeCd === "KO" && r.pairings.length > 0) && (
            <button className="ghost" onClick={() => setShowBracket(true)}>
              🌳 Turnierbaum
            </button>
          )}
          <button className="ghost" onClick={load}>
            ↻ Aktualisieren
          </button>
          {isAdmin && (
            <button className="danger ghost" onClick={remove} title="Nur bei uns entfernen, betrifft 3K nicht">
              Turnier entfernen
            </button>
          )}
        </div>
      </div>

      {error && <div className="hint">{error}</div>}

      {showBracket && (
        <Modal title="Turnierbaum" onClose={() => setShowBracket(false)} wide="x">
          <TournamentBracket rounds={detail.rounds} />
        </Modal>
      )}

      {profileSaved && (
        <div className="wd-toast" role="status" onClick={() => setProfileSaved(false)}>
          ✅ Matchprofil gespeichert.
        </div>
      )}

      {isAdmin && !detail.published && (
        <div className="card hint">
          Entwurf – nur du siehst dieses Turnier. Teilnehmer sehen es erst, sobald du auf
          "Für Teilnehmer freigeben" klickst.
        </div>
      )}

      {!detail.hasProfile && (
        <div className="card hint">
          {isAdmin
            ? "Für dieses Turnier ist noch kein Matchprofil festgelegt – Paarungen können erst gestartet werden, sobald das erledigt ist."
            : "Für dieses Turnier ist noch kein Matchprofil festgelegt. Bitte kurz warten."}
        </div>
      )}

      {isAdmin &&
        (() => {
          const missing = detail.rounds.filter((r) => r.pairings.length > 0 && r.profile === null);
          if (missing.length === 0) return null;
          return (
            <div className="card stack">
              <div className="hint">
                ⚠️ {missing.length} von {detail.rounds.filter((r) => r.pairings.length > 0).length} Runden haben noch
                kein Matchprofil (weder eigenes noch Standard):
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {missing.map((r) => (
                  <button
                    key={r.roundId}
                    className="ghost"
                    onClick={() => setEditing({ roundId: r.roundId, initial: null })}
                  >
                    {r.phaseName} · {r.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

      {detail.rounds.every((round) => round.pairings.length === 0) && (
        <div className="card hint">Noch kein Spielplan bei 3K hinterlegt.</div>
      )}

      {detail.rounds
        .filter((round) => round.pairings.length > 0)
        .map((round, i, arr) => {
          const prevPhase = i > 0 ? arr[i - 1]!.phaseName : null;
          const newPhase = round.phaseName !== prevPhase;
          return (
        <div key={round.roundId} className="stack">
          {newPhase && <h2 className="room-title">{round.phaseName}</h2>}
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 className="section-title">{round.name}</h3>
              <div className="hint">
                {round.profile
                  ? formatSummary(round.profile)
                  : "Kein Matchprofil (weder eigenes noch Standard)"}
                {round.hasOwnProfile ? " · eigenes Profil" : " · Standard-Profil"}
              </div>
            </div>
            {isAdmin && (
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="ghost"
                  onClick={() => setEditing({ roundId: round.roundId, initial: round.profile })}
                >
                  Profil für diese Runde
                </button>
                {round.hasOwnProfile && (
                  <button
                    className="ghost"
                    onClick={() =>
                      app
                        .setTournamentRoundProfile(tournamentId, round.roundId, null)
                        .then(load)
                        .catch((e) => setError((e as Error).message))
                    }
                  >
                    Standard verwenden
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="room-list">
            {round.pairings.map((p) => {
              // Ein Freilos-Slot ("?" ohne Gegner) ist kein Namens-Zuordnungsproblem,
              // sondern von 3K automatisch entschieden - kein Zuordnen/Spielen nötig.
              const bye = p.byeHome || p.byeAway;
              const unresolved = !p.resolved && !bye;
              const canStart = round.profile !== null && p.isMine && p.status === "open" && !unresolved && !bye;
              return (
                <div key={p.matchId} className="room-card">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>
                      {slotLabel(p.homeName, p.byeHome, p.homeSourceGameNr, p.homeSourceWinner, p.homeSourceName)} vs.{" "}
                      {slotLabel(p.awayName, p.byeAway, p.awaySourceGameNr, p.awaySourceWinner, p.awaySourceName)}
                    </strong>
                    <span className={`badge ${p.status === "open" ? "" : "live"}`}>
                      {p.status === "open"
                        ? "offen"
                        : p.status === "live"
                          ? "läuft gerade"
                          : `beendet ${p.legsHome ?? "?"}:${p.legsAway ?? "?"}`}
                    </span>
                  </div>
                  {unresolved && (
                    <div className="hint">
                      Nicht automatisch zuordenbar (Namen mehrdeutig oder unbekannt) – bitte manuell spielen.
                    </div>
                  )}
                  {unresolved && isAdmin && (
                    <div className="stack" style={{ gap: 6, marginTop: 4 }}>
                      {!p.homeUid && (
                        <PlayerPicker
                          label={namePart(p.homeName, 0, detail.isDouble)}
                          onAssign={(uid) => assignOverride(p.homeName, 0, uid)}
                        />
                      )}
                      {detail.isDouble && !p.homeUid2 && (
                        <PlayerPicker
                          label={namePart(p.homeName, 1, detail.isDouble)}
                          onAssign={(uid) => assignOverride(p.homeName, 1, uid)}
                        />
                      )}
                      {!p.awayUid && (
                        <PlayerPicker
                          label={namePart(p.awayName, 0, detail.isDouble)}
                          onAssign={(uid) => assignOverride(p.awayName, 0, uid)}
                        />
                      )}
                      {detail.isDouble && !p.awayUid2 && (
                        <PlayerPicker
                          label={namePart(p.awayName, 1, detail.isDouble)}
                          onAssign={(uid) => assignOverride(p.awayName, 1, uid)}
                        />
                      )}
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
        </div>
          );
        })}

      {editing && (
        <Modal
          title={editing.roundId === null ? "Standard-Matchprofil festlegen" : "Matchprofil für diese Runde"}
          onClose={() => {
            setEditing(null);
            setProfileError(null);
          }}
        >
          <TournamentProfileForm
            initial={editing.initial}
            isDouble={detail.isDouble}
            saving={profileSaving}
            error={profileError}
            onCancel={() => {
              setEditing(null);
              setProfileError(null);
            }}
            onSave={(config) => {
              setProfileError(null);
              setProfileSaving(true);
              const req =
                editing.roundId === null
                  ? app.setTournamentProfile(tournamentId, config)
                  : app.setTournamentRoundProfile(tournamentId, editing.roundId, config);
              req
                .then(() => {
                  setEditing(null);
                  setProfileSaved(true);
                  load();
                })
                .catch((e) => setProfileError((e as Error).message))
                .finally(() => setProfileSaving(false));
            }}
          />
        </Modal>
      )}
    </div>
  );
}
