import type { MatchState } from "@webdarts/engine";
import type { AppApi } from "../useApp";

export function RematchPanel({ app }: { app: AppApi }) {
  const room = app.room!;
  const match = room.match as MatchState;
  const rematch = room.rematch;
  const seated = room.seats.some((s) => s.occupantId === app.myId);
  const winner =
    match.matchWinnerTeamIndex !== null ? room.teamNames[match.matchWinnerTeamIndex] : null;

  const myVote = rematch?.needed.includes(app.myId ?? "");
  const iAccepted = rematch?.accepted.includes(app.myId ?? "");

  return (
    <div className="card stack">
      <h3 className="section-title">Match beendet</h3>
      {winner && (
        <div className="rematch-winner">🏆 {winner}</div>
      )}

      {!rematch ? (
        <>
          {seated && (
            <button className="primary big" onClick={app.offerRematch}>
              Revanche anbieten
            </button>
          )}
          <button className="ghost" onClick={app.leaveRoom}>
            ← Zurück zur Lobby
          </button>
          {seated && (
            <button className="ghost" onClick={app.undo}>
              ↶ Letzte Aufnahme rückgängig
            </button>
          )}
        </>
      ) : (
        <>
          <div className="hint">
            <strong>{rematch.offeredByName}</strong> bietet eine Revanche an –{" "}
            {rematch.accepted.length}/{rematch.needed.length} angenommen.
          </div>

          {myVote && !iAccepted ? (
            <div className="row">
              <button className="primary" onClick={() => app.respondRematch(true)}>
                Revanche annehmen
              </button>
              <button className="danger ghost" onClick={() => app.respondRematch(false)}>
                Ablehnen
              </button>
            </div>
          ) : (
            <div className="hint">
              {iAccepted ? "Du hast angenommen. " : ""}Warte auf Zustimmung der Gegner…
            </div>
          )}

          <button className="ghost" onClick={app.leaveRoom}>
            ← Zurück zur Lobby
          </button>
        </>
      )}
    </div>
  );
}
