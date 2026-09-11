import { useState } from "react";
import { useApp } from "./useApp";
import { isEmbedded } from "./embed";
import { ParticlesBackground } from "./components/ParticlesBackground";
import { NameGate } from "./components/NameGate";
import { Hub } from "./components/Hub";
import { RoomLobby } from "./components/RoomLobby";
import { MatchView } from "./components/MatchView";
import { TournamentPage } from "./components/TournamentPage";
import { TournamentLobby } from "./components/TournamentLobby";
import { SponsorStrip } from "./components/SponsorStrip";

export function App() {
  const app = useApp();
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [tournamentLobbyId, setTournamentLobbyId] = useState<string | null>(null);

  let view: JSX.Element;
  if (!app.name) view = <NameGate app={app} />;
  else if (app.room && app.room.phase === "lobby") view = <RoomLobby app={app} />;
  else if (app.room) view = <MatchView app={app} />;
  else if (tournamentId)
    view = (
      <TournamentPage
        app={app}
        tournamentId={tournamentId}
        onBack={() => setTournamentId(null)}
        onOpenLobby={(id) => {
          setTournamentId(null);
          setTournamentLobbyId(id);
        }}
      />
    );
  else if (tournamentLobbyId)
    view = (
      <TournamentLobby app={app} tournamentId={tournamentLobbyId} onBack={() => setTournamentLobbyId(null)} />
    );
  else
    view = <Hub app={app} onOpenTournament={setTournamentId} onEnterTournament={setTournamentLobbyId} />;

  const content = (
    <>
      {!app.connected && app.name && (
        <div className="conn-lost" role="alert">
          <span className="conn-spin" aria-hidden="true" />
          Verbindung unterbrochen – versuche neu zu verbinden … Eingaben sind gesperrt, bis die
          Verbindung wieder steht.
        </div>
      )}
      {app.error && (
        <div className="error-bar" role="alert">
          <span>{app.error}</span>
          <button className="ghost" aria-label="Meldung schließen" onClick={app.clearError}>
            ✕
          </button>
        </div>
      )}
      {view}
      <SponsorStrip />
    </>
  );

  // In doca.at eingebettet: kein eigener Header / Partikel-Hintergrund –
  // die Seite liefert das. Nur der Inhalt.
  if (isEmbedded) {
    return <div className="webdarts-embed">{content}</div>;
  }

  return (
    <>
      <ParticlesBackground />
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            DOCA <span>WEBDARTS</span>
          </div>
          <div className="topbar-right">
            {app.name && <span className="pill">{app.name}</span>}
            <span
              className={`dot ${app.connected ? "on" : "off"}`}
              role="img"
              aria-label={app.connected ? "verbunden" : "keine Verbindung"}
            />
            <span className="hint" aria-hidden="true">
              {app.connected ? "verbunden" : "keine Verbindung…"}
            </span>
          </div>
        </header>
        <main>{content}</main>
      </div>
    </>
  );
}
