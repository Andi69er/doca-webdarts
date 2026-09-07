import { useApp } from "./useApp";
import { ParticlesBackground } from "./components/ParticlesBackground";
import { NameGate } from "./components/NameGate";
import { Hub } from "./components/Hub";
import { RoomLobby } from "./components/RoomLobby";
import { MatchView } from "./components/MatchView";

export function App() {
  const app = useApp();

  let view: JSX.Element;
  if (!app.name) view = <NameGate app={app} />;
  else if (!app.room) view = <Hub app={app} />;
  else if (app.room.phase === "lobby") view = <RoomLobby app={app} />;
  else view = <MatchView app={app} />;

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

        {app.error && (
          <div className="error-bar" role="alert">
            <span>{app.error}</span>
            <button
              className="ghost"
              aria-label="Meldung schließen"
              onClick={app.clearError}
            >
              ✕
            </button>
          </div>
        )}

        <main>{view}</main>
      </div>
    </>
  );
}
