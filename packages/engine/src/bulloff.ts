/**
 * Ausbullen ("Bull-Off") zur Bestimmung des Anwurfs.
 *
 * Ablauf wie bei darts-live: jede Person wirft **bis zu 3 Darts** auf das Bull.
 * Gewertet wird **wertebasiert und reihenfolge-unabhängig**: der beste Dart jedes
 * Teams gegeneinander, bei Gleichstand der zweitbeste, dann der drittbeste.
 * Nur wenn die drei Darts wertgleich sind, wird nachgeworfen.
 * Punkte je Dart: Bulls Eye (DBULL) = 50, äußeres Bull (SBULL) = 25, daneben = 0.
 */

import type { BullOffAttempt, BullOffState, BullOffThrow } from "./types";

export function createBullOff(): BullOffState {
  return { rounds: [], currentRound: [], winnerTeamIndex: null, done: false };
}

/** Punktwert eines einzelnen Bull-Darts (höher = besser). */
export function throwPoints(t: BullOffThrow): number {
  switch (t.kind) {
    case "DBULL":
      return 50;
    case "SBULL":
      return 25;
    case "MISS":
      return 0;
    case "mm":
      // Feinwertung: näher an der Mitte = mehr Punkte (25–50).
      return Math.max(0, Math.min(50, 50 - t.mm));
  }
}

/** Die Darts eines Wurfs als absteigend sortierte Punktliste (bester zuerst). */
export function attemptScores(darts: BullOffThrow[]): number[] {
  return darts.map(throwPoints).sort((a, b) => b - a);
}

/**
 * Vergleicht zwei Würfe: bester Dart gegen besten, dann zweitbester usw.
 * Rückgabe < 0 wenn `a` besser ist, > 0 wenn `b` besser ist, 0 bei Wertgleichheit.
 */
export function compareAttempts(a: BullOffThrow[], b: BullOffThrow[]): number {
  const as = attemptScores(a);
  const bs = attemptScores(b);
  const n = Math.max(as.length, bs.length, 1);
  for (let i = 0; i < n; i++) {
    const av = as[i] ?? 0;
    const bv = bs[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

/**
 * Welches Team wirft in der laufenden Runde als Nächstes?
 * Die Reihenfolge ist in jeder Runde gleich: Team 0, dann Team 1, … – auch beim
 * Nachwerfen nach einem Gleichstand (s1 → s2 → s1 → s2 …).
 */
export function nextBullOffTeam(state: BullOffState, teamCount = 2): number | null {
  if (state.done) return null;
  return state.currentRound.length % teamCount;
}

/**
 * Fügt einen kompletten Wurf hinzu und wertet die Runde aus, sobald jedes Team
 * geworfen hat. Würfe außer der Reihe werden ignoriert.
 */
export function addBullOffThrow(
  state: BullOffState,
  attempt: BullOffAttempt,
  teamCount = 2,
): BullOffState {
  if (state.done) return state;
  if (attempt.teamIndex !== nextBullOffTeam(state, teamCount)) return state;

  const currentRound = [...state.currentRound, attempt];
  if (currentRound.length < teamCount) {
    return { ...state, currentRound };
  }

  const sorted = [...currentRound].sort((x, y) => compareAttempts(x.darts, y.darts));
  const best = sorted[0]!;
  const tieCount = sorted.filter((s) => compareAttempts(s.darts, best.darts) === 0).length;
  const rounds = [...state.rounds, currentRound];

  if (tieCount > 1) {
    return { ...state, rounds, currentRound: [] };
  }
  return { ...state, rounds, currentRound: [], winnerTeamIndex: best.teamIndex, done: true };
}
