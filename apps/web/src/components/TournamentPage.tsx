import { useCallback, useEffect, useState } from "react";
import type { TournamentDetail } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { Modal } from "./Modal";
import { TournamentProfileForm } from "./TournamentProfileForm";
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
            <button className="ghost" onClick={() => setProfileOpen(true)}>
              Matchprofil festlegen
            </button>
          )}
          {isAdmin && (
            <button className={detail.published ? "ghost" : "primary"} onClick={togglePublished}>
              {detail.published ? "Zurückziehen" : "Für Teilnehmer freigeben"}
            </button>
          )}
          <button className="ghost" onClick={load}>
            ↻ Aktualisieren
          </button>
        </div>
      </div>

      {error && <div className="hint">{error}</div>}

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
