import { scoreboard, type RoomState } from "@webdarts/engine";
import { useBotThrowHold } from "../useBotThrowHold";
import { Avatar } from "./Avatar";

/**
 * `room` statt `match`: bei einem Bot-Zug soll die Anzeige (Score/Legs/
 * Average/Anwurf-Pfeil) synchron mit der Video-Großansicht erst NACH der
 * Dartscheiben-Animation umspringen (siehe useBotThrowHold), nicht schon in
 * dem Moment, in dem der Server den Zug intern schon weitergegeben hat.
 */
export function Scoreboard({ room }: { room: RoomState }) {
  const { effectiveMatch } = useBotThrowHold(room);
  if (!effectiveMatch) return null;
  const match = effectiveMatch;
  const sb = scoreboard(match);
  const usesSets = match.config.setsToWin > 1;
  const isX01 = sb.mode === "x01";

  return (
    <div className="stack" style={{ gap: 10 }}>
      {sb.phase === "finished" && (
        <div className="winner-banner">
          {sb.matchWinnerTeamIndex !== null
            ? `🏆 ${sb.teams[sb.matchWinnerTeamIndex]!.name} gewinnt das Match!`
            : "🤝 Unentschieden!"}
        </div>
      )}

      <div className="sb2-vs">
        {usesSets ? (
          <>
            <div className="sb2-vs-main">
              {sb.teams[0]!.setsWon} : {sb.teams[1]!.setsWon}
            </div>
            <div className="sb2-vs-sub">
              Legs {sb.teams[0]!.legsWonInSet} : {sb.teams[1]!.legsWonInSet}
            </div>
          </>
        ) : (
          <div className="sb2-vs-main">
            {sb.teams[0]!.legsWonInSet} : {sb.teams[1]!.legsWonInSet}
          </div>
        )}
      </div>

      <div className="sb2">
        {sb.teams.map((t, ti) => {
          const onThrow = sb.thrower?.teamIndex === ti;
          return (
            <div key={ti} className={`sb2-team ${onThrow ? "on-throw" : ""}`}>
              <div className="sb2-head">
                <span className="sb2-name">{t.name}</span>
                {onThrow && <span className="sb2-arrow">◀</span>}
              </div>
              <div className="sb2-players">
                {t.players.map((p, i) => (
                  <span key={i} className="sb2-player">
                    <Avatar src={t.playerImages[i]} name={p} size={32} />
                    {p}
                  </span>
                ))}
              </div>

              <div className="sb2-body">
                <div className="sb2-legs">
                  {usesSets && (
                    <>
                      <span>Sets</span>
                      <strong>{t.setsWon}</strong>
                    </>
                  )}
                  <span>Legs</span>
                  <strong>{t.legsWonInSet}</strong>
                </div>
                <div className="sb2-score">{t.score}</div>
              </div>

              <div className="sb2-foot">
                <span>Ø {t.legAverage.toFixed(1)}</span>
                <span>{t.dartsThisLeg} Darts</span>
              </div>

              {isX01 && onThrow && t.checkout && (
                <div className="sb2-checkout">Checkout: {t.checkout}</div>
              )}
            </div>
          );
        })}
      </div>

      {match.phase === "bulloff" && (
        <div className="hint">Ausbullen läuft – wer näher am Bull ist, hat den Anwurf.</div>
      )}
    </div>
  );
}
