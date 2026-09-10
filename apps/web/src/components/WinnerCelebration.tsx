import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { MatchState } from "@webdarts/engine";

const PARTS = ["🎆", "🎇", "✨", "🎉", "🎊", "🏆", "🎯", "⭐", "💥", "🎈"];

/**
 * Sieger-Feier: fliegt beim Match-Ende (nach dem Sieges-Checkdart) über den
 * Bildschirm – Pokal, Darts, Feuerwerk – mit dem Namen des Siegers/Siegerteams.
 * Schließt sich nach 14 s oder per Klick.
 */
export function WinnerCelebration({ match }: { match: MatchState }) {
  const [open, setOpen] = useState(false);
  const shownFor = useRef(-1);

  useEffect(() => {
    if (match.phase === "finished" && match.matchWinnerTeamIndex != null) {
      const key = match.history.length; // pro (Re-)Match neu
      if (shownFor.current !== key) {
        shownFor.current = key;
        setOpen(true);
      }
    } else if (match.phase !== "finished") {
      shownFor.current = -1;
      setOpen(false);
    }
  }, [match.phase, match.history.length, match.matchWinnerTeamIndex]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 14000);
    return () => clearTimeout(t);
  }, [open]);

  if (!open || match.matchWinnerTeamIndex == null) return null;

  const wi = match.matchWinnerTeamIndex;
  const team = match.teams[wi]!;
  const players = team.playerIds
    .map((id) => match.players.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(" & ");
  const isTeam = team.playerIds.length > 1;

  return (
    <div className="wincele" role="dialog" aria-label="Sieger" onClick={() => setOpen(false)}>
      {Array.from({ length: 32 }).map((_, i) => {
        const style: CSSProperties = {
          left: `${4 + ((i * 53) % 92)}%`,
          animationDelay: `${(i % 12) * 0.3}s`,
          animationDuration: `${2.8 + (i % 5) * 0.6}s`,
          fontSize: `${16 + (i % 5) * 9}px`,
        };
        (style as Record<string, string | number>)["--dx"] = `${((i % 7) - 3) * 34}px`;
        return (
          <span key={i} className="wincele-p" style={style}>
            {PARTS[i % PARTS.length]}
          </span>
        );
      })}

      <div className="wincele-card">
        <div className="wincele-trophy">🏆</div>
        <div className="wincele-sub">🎯 {isTeam ? "Siegerteam" : "Sieger"} 🎯</div>
        <div className="wincele-name">{isTeam ? team.name : players || team.name}</div>
        {isTeam && players && <div className="wincele-players">{players}</div>}
        <div className="wincele-hint">Tippen zum Schließen</div>
      </div>
    </div>
  );
}
