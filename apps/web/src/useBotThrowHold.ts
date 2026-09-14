import { useEffect, useRef, useState } from "react";
import type { CricketLegState, Dart, MatchState, RoomState, X01LegState } from "@webdarts/engine";
import { DART_FLIGHT_MS, DART_STAGGER_MS } from "./dartboardRenderer";

/**
 * Hält die SICHTBARE Darstellung eines Bot-Wurfs (Video-Großansicht +
 * Punktestand-Anzeige) künstlich auf dem Stand "vor dem Wurf" fest, bis die
 * Dartscheiben-Animation (siehe BotDartboard) durchgelaufen ist - der Server
 * schickt Wurf + Zugwechsel als EINE atomare Aktion, ohne das würde die
 * Anzeige sofort zum Menschen springen, während der Dart optisch noch fliegt.
 *
 * WICHTIG: das betrifft NUR die Anzeige (Video-Fokus, Punktestand-Kästchen).
 * Die tatsächliche Spieleingabe (DartInput) bleibt bewusst unberührt und
 * reagiert sofort, sobald der Mensch wirklich dran ist - sonst würde man ihn
 * unnötig ausbremsen, nur damit's hübscher aussieht.
 */
export function useBotThrowHold(room: RoomState) {
  const botSeat = room.bot ? (room.seats.find((s) => s.key === room.bot!.seatKey) ?? null) : null;
  const liveMatch = (room.phase === "match" ? (room.match as MatchState | null) : null) ?? null;

  function countBotVisits(match: MatchState | null): { key: number; darts: Dart[]; bust: boolean } {
    let key = 0;
    let darts: Dart[] = [];
    let bust = false;
    if (botSeat && match) {
      const legs = [
        ...match.history.map((r) => r.leg),
        ...(match.phase === "playing" || match.phase === "finished" ? [match.leg] : []),
      ];
      for (const leg of legs) {
        const visits = (leg as X01LegState | CricketLegState).visits;
        for (const v of visits) {
          if (v.teamIndex === botSeat.teamIndex) {
            key += 1;
            darts = v.darts;
            bust = "bust" in v && v.bust === true;
          }
        }
      }
    }
    return { key, darts, bust };
  }

  const liveVisits = countBotVisits(liveMatch);

  const prevMatchRef = useRef<MatchState | null>(liveMatch);
  const holdUntilRef = useRef(0);
  const lastHeldVisitKeyRef = useRef(0);
  const heldMatchSnapshotRef = useRef<MatchState | null>(null);
  const [, forceTick] = useState(0);

  // Synchron WÄHREND des Renders (nicht erst in einem useEffect danach) -
  // sonst gibt's einen Frame mit veraltetem Haltewert, siehe frühere Fixes.
  if (botSeat && liveVisits.key !== lastHeldVisitKeyRef.current && liveVisits.darts.length > 0) {
    lastHeldVisitKeyRef.current = liveVisits.key;
    // Zustand von VOR diesem Wurf einfrieren (= der Stand beim letzten Render).
    heldMatchSnapshotRef.current = prevMatchRef.current;
    const tailPause = liveVisits.bust ? 400 : 2000;
    const holdMs = (liveVisits.darts.length - 1) * DART_STAGGER_MS + DART_FLIGHT_MS + tailPause;
    holdUntilRef.current = Date.now() + holdMs;
  }
  prevMatchRef.current = liveMatch;

  useEffect(() => {
    const remaining = holdUntilRef.current - Date.now();
    if (remaining <= 0) return;
    const t = setTimeout(() => forceTick((n) => n + 1), remaining + 30);
    return () => clearTimeout(t);
  }, [liveVisits.key]);

  const holdingBot = botSeat != null && Date.now() < holdUntilRef.current;
  const effectiveMatch = holdingBot && heldMatchSnapshotRef.current ? heldMatchSnapshotRef.current : liveMatch;

  return {
    botSeat,
    holdingBot,
    /** Fürs Video/Scoreboard: während der Haltephase der Stand VOR dem
     *  aktuellen Bot-Wurf, danach der echte Live-Stand. */
    effectiveMatch,
    botDarts: liveVisits.darts,
    botVisitKey: liveVisits.key,
  };
}
