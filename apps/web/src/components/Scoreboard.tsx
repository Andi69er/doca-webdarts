import { scoreboard, type MatchState } from "@webdarts/engine";

export function Scoreboard({ match }: { match: MatchState }) {
  const sb = scoreboard(match);
  const usesSets = match.config.setsToWin > 1;
  const isX01 = sb.mode === "x01";

  return (
    <div className="stack" style={{ gap: 10 }}>
      {sb.matchWinnerTeamIndex !== null && (
        <div className="winner-banner">
          🏆 {sb.teams[sb.matchWinnerTeamIndex]!.name} gewinnt das Match!
        </div>
      )}

      <div className="sb2">
        {sb.teams.map((t, ti) => {
          const onThrow = sb.thrower?.teamIndex === ti;
          return (
            <div key={ti} className={`sb2-team ${onThrow ? "on-throw" : ""}`}>
              <div className="sb2-head">
                <span className="sb2-name">{t.name}</span>
                {onThrow && <span className="sb2-arrow">◀</span>}
              </div>
              <div className="sb2-players">{t.players.join(" & ")}</div>

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
