import { useEffect, useRef, useState } from "react";
import type { TournamentSummary } from "@webdarts/engine";
import type { AppApi } from "../useApp";

const ADMIN_NAME = "Andi69er";

/** "Turniere"-Block im Hub, unter "Räume": Liste der an 3K angebundenen Turniere. */
export function TournamentsCard({
  app,
  onOpen,
  onEnter,
}: {
  app: AppApi;
  /** Admin-Seite (Matchprofil/Zuordnung/Freigabe). */
  onOpen: (id: string) => void;
  /** Turnier-Lobby (Spieler-Sicht). */
  onEnter: (id: string) => void;
}) {
  const [list, setList] = useState<TournamentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const isAdmin = app.name === ADMIN_NAME;
  // useApp() liefert bei jedem Render ein neues Objekt - mit `[app]` als Dependency
  // würde diese Liste bei jeder Hub-Änderung irgendwo (z.B. fremde Chat-Nachricht)
  // neu geladen, bis der Rate-Limiter zuschlägt. Einmalig beim Mounten laden.
  const appRef = useRef(app);
  useEffect(() => {
    appRef.current = app;
  });

  const load = () => {
    appRef.current
      .listTournaments()
      .then(setList)
      .catch((e) => setError((e as Error).message));
  };

  useEffect(load, []);

  const add = () => {
    const id = Number(eventId.trim());
    if (!Number.isInteger(id) || id <= 0) {
      setError("Bitte eine gültige 3K-Event-ID eingeben.");
      return;
    }
    setAdding(true);
    setError(null);
    app
      .addTournament(id, name.trim() || undefined)
      .then(() => {
        setEventId("");
        setName("");
        load();
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setAdding(false));
  };

  return (
    <div className="card stack">
      <h3 className="section-title">Turniere</h3>

      {isAdmin && (
        <div className="create-box">
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="3K-Event-ID"
            aria-label="3K-Event-ID"
            inputMode="numeric"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anzeigename (optional)"
            aria-label="Anzeigename (optional)"
            maxLength={60}
          />
          <button className="primary" style={{ width: "100%" }} disabled={adding} onClick={add}>
            + Turnier hinzufügen
          </button>
        </div>
      )}

      {error && <div className="hint">{error}</div>}

      <div className="room-list">
        {list && list.length === 0 && <div className="hint">Noch kein Turnier verknüpft.</div>}
        {list?.map((t) => (
          <div key={t.id} className="room-card">
            <strong>{t.name}</strong>
            {isAdmin && (
              <div className="hint">
                {t.hasProfile ? "Matchprofil festgelegt" : "Matchprofil fehlt noch"}
                {!t.published && " · Entwurf (nur für dich sichtbar)"}
              </div>
            )}
            <div className="row" style={{ gap: 6 }}>
              <button onClick={() => onEnter(t.id)}>Turnier beitreten</button>
              {isAdmin && (
                <button className="ghost" onClick={() => onOpen(t.id)}>
                  Verwalten
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
