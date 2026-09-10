import { useEffect, useRef, useState } from "react";
import type { MatchState, X01LegState } from "@webdarts/engine";

/**
 * „BUST"-Einblendung: taucht groß aus dem Nichts auf, bleibt 3 s, fliegt
 * seitlich wieder raus. Ausgelöst, sobald eine X01-Aufnahme 0 zählt –
 * echter Bust (überworfen / Rest 1 / auf 0 ohne Doppel) genauso wie drei
 * Nieten. Nicht beim Ausbullen: dort landen keine Visits im Leg.
 */
export function BustFlash({ match }: { match: MatchState }) {
  const [key, setKey] = useState(0); // > 0 = anzeigen; neuer Key = Animation neu
  const seen = useRef(0);

  useEffect(() => {
    if (match.phase !== "playing") return;
    if (match.leg.mode !== "x01") return;
    const leg = match.leg as X01LegState;
    const n = leg.visits.length;
    if (n <= seen.current) {
      seen.current = n; // neues Leg / Undo → zurücksetzen
      return;
    }
    seen.current = n;
    const v = leg.visits[n - 1];
    if (!v) return;
    if (v.bust || v.scored === 0) {
      setKey((k) => k + 1);
    }
  }, [match]);

  useEffect(() => {
    if (key === 0) return;
    const t = setTimeout(() => setKey(0), 3000);
    return () => clearTimeout(t);
  }, [key]);

  if (key === 0) return null;
  return (
    <div className="bustflash" key={key} aria-hidden="true">
      <span className="bustflash-word">BUST</span>
      <span className="bustflash-emo">😢 😈</span>
    </div>
  );
}
