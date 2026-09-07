import { useState } from "react";
import { nextBullOffTeam, type BullOffThrow, type MatchState } from "@webdarts/engine";
import type { AppApi } from "../useApp";

const DART_LABEL: Record<string, string> = {
  DBULL: "Bull 50",
  SBULL: "25",
  MISS: "—",
};

function throwText(t: BullOffThrow): string {
  return t.kind === "mm" ? `${t.mm} mm` : DART_LABEL[t.kind] ?? t.kind;
}

export function BullOffPanel({
  app,
  myTeamIndex,
  disabled = false,
}: {
  app: AppApi;
  myTeamIndex: number | null;
  disabled?: boolean;
}) {
  const match = app.room!.match as MatchState;
  const bo = match.bullOff;
  const [darts, setDarts] = useState<BullOffThrow[]>([]);
  if (!bo) return null;

  const next = nextBullOffTeam(bo);
  const teamNames = match.teams.map((t) => t.name);
  const myTurn = !disabled && myTeamIndex !== null && next === myTeamIndex;

  const add = (t: BullOffThrow) => darts.length < 3 && setDarts([...darts, t]);
  const submit = async () => {
    if (darts.length === 0) return;
    await app.dispatch({
      type: "BULLOFF_THROW",
      teamIndex: myTeamIndex!,
      playerId: app.myId!,
      darts,
    });
    setDarts([]);
  };

  return (
    <div className="card stack">
      <h3 className="section-title">Ausbullen mit 3 Darts</h3>

      {bo.rounds.map((r, i) => (
        <div key={i} className="bulloff-round">
          <span className="hint">Runde {i + 1} · unentschieden</span>
          {r.map((a, j) => (
            <span key={j} className="chip">
              {teamNames[a.teamIndex]}: {a.darts.map(throwText).join(" · ")}
            </span>
          ))}
        </div>
      ))}

      {!bo.done && bo.currentRound.length > 0 && (
        <div className="bulloff-round">
          <span className="hint">Runde {bo.rounds.length + 1}</span>
          {bo.currentRound.map((a, j) => (
            <span key={j} className="chip">
              {teamNames[a.teamIndex]}: {a.darts.map(throwText).join(" · ")}
            </span>
          ))}
          {next !== null && <span className="hint">…{teamNames[next]} fehlt noch</span>}
        </div>
      )}

      {bo.done ? (
        <div className="hint">Anwurf: {teamNames[bo.winnerTeamIndex!]} – Spiel startet…</div>
      ) : myTurn ? (
        <div className="stack">
          <div className="hint">
            Du wirfst für <strong>{teamNames[myTeamIndex!]}</strong>. Trag alle 3 Darts ein –
            gewertet wird der beste, bei Gleichstand der zweitbeste:
          </div>
          <div className="bulloff-slots">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`bull-slot ${darts[i] ? "set" : ""}`}>
                {darts[i] ? throwText(darts[i]!) : `Dart ${i + 1}`}
              </div>
            ))}
          </div>
          <div className="row">
            <button className="primary" disabled={darts.length >= 3} onClick={() => add({ kind: "DBULL" })}>
              Bull (50)
            </button>
            <button disabled={darts.length >= 3} onClick={() => add({ kind: "SBULL" })}>
              25
            </button>
            <button className="ghost" disabled={darts.length >= 3} onClick={() => add({ kind: "MISS" })}>
              daneben
            </button>
          </div>
          <div className="row">
            <button className="primary" disabled={darts.length === 0} onClick={submit}>
              Wurf werten ({darts.length})
            </button>
            <button className="ghost" disabled={darts.length === 0} onClick={() => setDarts(darts.slice(0, -1))}>
              letzten zurück
            </button>
          </div>
        </div>
      ) : (
        <div className="hint">
          {next === null ? "wird ausgewertet…" : `Warte auf ${teamNames[next]}…`}
        </div>
      )}
    </div>
  );
}
