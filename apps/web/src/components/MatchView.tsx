import type { MatchState } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { Scoreboard } from "./Scoreboard";
import { CricketBoard } from "./CricketBoard";
import { DartInput } from "./DartInput";
import { BullOffPanel } from "./BullOffPanel";
import { LegBullOffPanel } from "./LegBullOffPanel";
import { MatchStats } from "./MatchStats";
import { RematchPanel } from "./RematchPanel";
import { PauseBanner } from "./PauseBanner";
import { GameRecorder } from "./GameRecorder";
import { VideoStage } from "./VideoStage";
import { useTurnAlert } from "../useTurnAlert";

export function MatchView({ app }: { app: AppApi }) {
  const state = app.room!;
  const match = state.match as MatchState;
  const isHost = app.myId === state.hostId;

  const mySeat = state.seats.find((s) => s.occupantId === app.myId) ?? null;
  const myTeamIndex = mySeat ? mySeat.teamIndex : null;
  const amSpectator = !mySeat;
  const paused = state.pause !== null;
  const inPlay = match.phase === "playing" || match.phase === "bulloff";

  useTurnAlert(match, app.myId, !amSpectator && !paused);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="ghost" onClick={app.leaveRoom}>
          ← Zurück zur Lobby
        </button>
        {state.name && <h2 className="room-title">{state.name}</h2>}
        <div className="row">
          {!amSpectator && inPlay && !state.pause?.manual && (
            <button className="ghost" onClick={app.pauseMatch}>
              ⏸ Pause
            </button>
          )}
          {!amSpectator && <GameRecorder finished={match.phase === "finished"} />}
          {isHost && (
            <button className="danger ghost" onClick={app.resetMatch}>
              Match abbrechen
            </button>
          )}
        </div>
      </div>

      {paused && <PauseBanner app={app} canResume={!amSpectator} />}

      <div className="match-layout">
        <div className="stack">
          <VideoStage room={state} />
          {amSpectator && <div className="hint">Zuschauer-Ansicht – du wertest nicht mit.</div>}
          {match.phase !== "bulloff" && match.config.mode === "cricket" && (
            <CricketBoard match={match} />
          )}
          {match.phase !== "bulloff" && <MatchStats match={match} />}
        </div>

        <div className="stack">
          <Scoreboard match={match} />

          {match.phase === "bulloff" && (
            <BullOffPanel app={app} myTeamIndex={myTeamIndex} disabled={paused} />
          )}

          {match.phase === "playing" && match.legBullOff && !match.legBullOff.done && (
            <LegBullOffPanel app={app} disabled={paused || amSpectator} />
          )}

          {match.phase === "playing" && !amSpectator && !(match.legBullOff && !match.legBullOff.done) && (
            <DartInput app={app} paused={paused} />
          )}

          {match.phase === "finished" && <RematchPanel app={app} />}
        </div>
      </div>
    </div>
  );
}
