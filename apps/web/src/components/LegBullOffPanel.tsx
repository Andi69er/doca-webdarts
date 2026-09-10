import { useState } from "react";
import { nextLegBullOffPlayer, type BullOffThrow, type MatchState } from "@webdarts/engine";
import type { AppApi } from "../useApp";

const DART_LABEL: Record<string, string> = {
  DBULL: "Bull 50",
  SBULL: "25",
  MISS: "—",
};
const throwText = (t: BullOffThrow): string =>
  t.kind === "mm" ? `${t.mm} mm` : (DART_LABEL[t.kind] ?? t.kind);

/**
 * Leg-Entscheidungs-Ausbullen: das laufende Leg hat das Runden-Limit erreicht.
 * Alle Spieler werfen in fester Reihenfolge (A1 → B1 → A2 → B2 …) je 3 Darts
 * auf Bull; der beste Wurf eines Teams gewinnt das Leg.
 */
export function LegBullOffPanel({ app, disabled = false }: { app: AppApi; disabled?: boolean }) {
  const room = app.room!;
  const match = room.match as MatchState;
  const lbo = match.legBullOff;
  const [darts, setDarts] = useState<BullOffThrow[]>([]);
  if (!lbo) return null;

  const nextPid = nextLegBullOffPlayer(lbo);
  const playerName = (pid: string) =>
    match.players.find((p) => p.id === pid)?.name ??
    room.seats.find((s) => s.playerId === pid)?.playerName ??
    "Spieler";
  const teamOf = (pid: string) => {
    const i0 = match.teams[0]!.playerIds.indexOf(pid);
    return i0 >= 0 ? 0 : 1;
  };
  const nextSeat = nextPid ? room.seats.find((s) => s.playerId === nextPid) ?? null : null;
  const myTurn = !disabled && !!nextSeat && nextSeat.occupantId === app.myId;

  const add = (t: BullOffThrow) => darts.length < 3 && setDarts([...darts, t]);
  const submit = async () => {
    if (!nextPid || darts.length === 0) return;
    await app.dispatch({
      type: "LEG_BULLOFF_THROW",
      playerId: nextPid,
      teamIndex: teamOf(nextPid),
      darts,
    });
    setDarts([]);
  };

  const round = Math.floor(lbo.attempts.length / lbo.order.length) + 1;

  return (
    <div className="card stack">
      <h3 className="section-title">Leg wird ausgebullt</h3>
      <div className="hint">
        Das Leg hat das Runden-Limit erreicht. Reihenfolge:{" "}
        {lbo.order.map((pid) => playerName(pid)).join(" → ")}. Bester Wurf eines Teams gewinnt das
        Leg{round > 1 ? ` · Nachwerfen (Runde ${round})` : ""}.
      </div>

      {lbo.attempts.length > 0 && (
        <div className="bulloff-round">
          {lbo.attempts.map((a, j) => (
            <span key={j} className="chip">
              {playerName(a.playerId)}: {a.darts.map(throwText).join(" · ")}
            </span>
          ))}
        </div>
      )}

      {lbo.done ? (
        <div className="hint">
          Anwurf-Team hat das Leg – {match.teams[lbo.winnerTeamIndex!]!.name} gewinnt das Leg.
        </div>
      ) : myTurn ? (
        <div className="stack">
          <div className="hint">
            Du wirfst für <strong>{playerName(nextPid!)}</strong> – trag deine 3 Darts ein:
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
            <button
              className="ghost"
              disabled={darts.length === 0}
              onClick={() => setDarts(darts.slice(0, -1))}
            >
              letzten zurück
            </button>
          </div>
        </div>
      ) : (
        <div className="hint">
          {nextPid ? `Warte auf ${playerName(nextPid)}…` : "wird ausgewertet…"}
        </div>
      )}
    </div>
  );
}
