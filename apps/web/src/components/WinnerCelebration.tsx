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
    if (match.phase === "finished") {
      // Auch beim Unentschieden (legsCap erreicht, matchWinnerTeamIndex null)
      // eine Meldung zeigen - "beendet" heißt nicht zwingend "es gibt einen Sieger".
      const key = match.history.length; // pro (Re-)Match neu
      if (shownFor.current !== key) {
        shownFor.current = key;
        setOpen(true);
      }
    } else {
      shownFor.current = -1;
      setOpen(false);
    }
  }, [match.phase, match.history.length]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 14000);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const wi = match.matchWinnerTeamIndex;
  const isTie = wi === null;
  const team = isTie ? null : match.teams[wi]!;
  const players = team
    ? team.playerIds
        .map((id) => match.players.find((p) => p.id === id)?.name)
        .filter(Boolean)
        .join(" & ")
    : "";
  const isTeam = !!team && team.playerIds.length > 1;

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
        {isTie ? (
          <>
            <div className="wincele-trophy">🤝</div>
            <div className="wincele-sub">Unentschieden</div>
            <div className="wincele-name">
              {match.teams[0]!.name} vs. {match.teams[1]!.name}
            </div>
          </>
        ) : (
          <>
            <div className="wincele-trophy">🏆</div>
            <div className="wincele-sub">🎯 {isTeam ? "Siegerteam" : "Sieger"} 🎯</div>
            <div className="wincele-name">{isTeam ? team!.name : players || team!.name}</div>
            {isTeam && players && <div className="wincele-players">{players}</div>}
          </>
        )}
        <div className="wincele-hint">Tippen zum Schließen</div>
      </div>
    </div>
  );
}
