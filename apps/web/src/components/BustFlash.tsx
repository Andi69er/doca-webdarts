import { useEffect, useRef, useState } from "react";
import { findCheckout, type MatchState, type X01LegState } from "@webdarts/engine";

/**
 * „BUST"-Einblendung: tauct groß aus dem Nichts auf, bleibt 3 s, fliegt
 * seitlich wieder raus. Ausgelöst bei echtem Bust (überworfen / Rest 1 /
 * auf 0 ohne Doppel) oder wenn jemand auf einem Finish stand und 0 geworfen hat.
 */
export function BustFlash({ match }: { match: MatchState }) {
  const [key, setKey] = useState(0); // > 0 = anzeigen; neuer Key = Animation neu
  const seen = useRef(0);

  useEffect(() => {
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
    const out = match.config.x01?.out ?? "double";
    const remAfter = leg.remaining[v.teamIndex] ?? 0;
    const remBefore = v.bust ? remAfter : remAfter + v.scored;
    const wasOnFinish = findCheckout(remBefore, 3, out) !== null;
    if (v.bust || (wasOnFinish && v.scored === 0)) {
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
