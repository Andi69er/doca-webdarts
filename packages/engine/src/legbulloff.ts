/**
 * Leg-Entscheidungs-Ausbullen: läuft ein Leg nach `legBulloffRounds` Aufnahmen
 * pro Spieler noch, wird es durch einen Bull-Wurf entschieden.
 *
 * Ablauf: alle Spieler werfen in fester Reihenfolge (A1 → B1 → A2 → B2 …) je bis
 * zu 3 Darts auf Bull. Der beste Wurf jedes Teams (wertebasiert, reihenfolge-
 * unabhängig – wie beim Match-Ausbullen) entscheidet. Bei Wertgleichheit aller
 * Teams wird komplett nachgeworfen.
 */

import { compareAttempts } from "./bulloff";
import type { LegBullOffAttempt, LegBullOffState, MatchState } from "./types";

/** Wurfreihenfolge als playerId-Liste: Team0-P0, Team1-P0, Team0-P1, Team1-P1 … */
export function legBullOffOrder(state: MatchState): string[] {
  const t0 = state.teams[0]?.playerIds ?? [];
  const t1 = state.teams[1]?.playerIds ?? [];
  const n = Math.max(t0.length, t1.length);
  const order: string[] = [];
  for (let i = 0; i < n; i++) {
    if (t0[i]) order.push(t0[i]!);
    if (t1[i]) order.push(t1[i]!);
  }
  return order;
}

export function createLegBullOff(order: string[]): LegBullOffState {
  return { order, attempts: [], winnerTeamIndex: null, done: false };
}

/** playerId, der als Nächstes werfen muss – oder null. */
export function nextLegBullOffPlayer(state: LegBullOffState): string | null {
  if (state.done) return null;
  return state.order[state.attempts.length] ?? null;
}

/** Bester Wurf eines Teams (kleinster Vergleichswert zuerst). */
function bestOf(attempts: LegBullOffAttempt[]): LegBullOffAttempt | null {
  if (attempts.length === 0) return null;
  return [...attempts].sort((a, b) => compareAttempts(a.darts, b.darts))[0]!;
}

/**
 * Fügt einen Wurf hinzu. Würfe außer der Reihe werden ignoriert. Ist die Runde
 * komplett, wird ausgewertet: klarer Sieger → done, sonst neue Runde.
 */
export function addLegBullOffThrow(
  state: LegBullOffState,
  attempt: LegBullOffAttempt,
): LegBullOffState {
  if (state.done) return state;
  if (attempt.playerId !== nextLegBullOffPlayer(state)) return state;

  const attempts = [...state.attempts, attempt];
  if (attempts.length < state.order.length) {
    return { ...state, attempts };
  }

  const bestA = bestOf(attempts.filter((a) => a.teamIndex === 0));
  const bestB = bestOf(attempts.filter((a) => a.teamIndex === 1));
  const cmp =
    bestA && bestB ? compareAttempts(bestA.darts, bestB.darts) : bestA ? -1 : bestB ? 1 : 0;

  if (cmp === 0) {
    // Wertgleich → komplett nachwerfen.
    return { ...state, attempts: [] };
  }
  return { ...state, attempts, winnerTeamIndex: cmp < 0 ? 0 : 1, done: true };
}

/**
 * Würde das Team `t` mit einem Leg-Sieg JETZT das Match gewinnen? Spiegelt die
 * Logik aus `advanceAfterLeg` (inkl. „2 Clear Legs" im Entscheidungssatz).
 */
export function wouldFinishMatch(state: MatchState, t: number): boolean {
  const cfg = state.config;
  const usesSets = cfg.setsToWin > 1;
  const legs = (state.legsWonInSet[t] ?? 0) + 1;
  const other = state.legsWonInSet[1 - t] ?? 0;
  const decidingSet =
    !usesSets ||
    ((state.setsWon[0] ?? 0) === cfg.setsToWin - 1 && (state.setsWon[1] ?? 0) === cfg.setsToWin - 1);
  const twoClear = !!cfg.twoClearLegs && decidingSet;
  const setWon = twoClear
    ? legs >= cfg.legsToWinSet && (legs - other >= 2 || legs >= cfg.legsToWinSet + 3)
    : legs >= cfg.legsToWinSet;
  if (!setWon) return false;
  if (!usesSets) return true;
  return (state.setsWon[t] ?? 0) + 1 >= cfg.setsToWin;
}

/** Soll jetzt (nach einer nicht-gewinnenden Aufnahme) das Leg-Ausbullen starten? */
export function shouldStartLegBullOff(state: MatchState, legVisits: { teamIndex: number }[]): boolean {
  const limit = state.config.legBulloffRounds ?? 0;
  if (limit <= 0) return false;
  if (state.legBullOff) return false;
  const perTeam = [0, 1].map((t) => legVisits.filter((v) => v.teamIndex === t).length);
  if (Math.min(perTeam[0]!, perTeam[1]!) < limit) return false;
  // Nicht ausbullen, wenn dieses Leg das Match entscheiden könnte.
  if (wouldFinishMatch(state, 0) || wouldFinishMatch(state, 1)) return false;
  return true;
}
