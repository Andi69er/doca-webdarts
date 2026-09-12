/**
 * X01-Teilspiel (ein Leg).
 *
 * Reine Funktion: nimmt den aktuellen Leg-Zustand + eine Aufnahme und liefert
 * den neuen Zustand. Kümmert sich um Bust-Regeln und Double-/Master-/Straight-Out.
 */

import type { Dart, X01LegState, X01Options } from "./types";
import { dartPoints, isDouble } from "./types";

export function createX01Leg(options: X01Options, teamCount: number): X01LegState {
  return {
    mode: "x01",
    remaining: Array.from({ length: teamCount }, () => options.startScore),
    visits: [],
    winnerTeamIndex: null,
  };
}

/** Darf dieser Dart im gewählten Out-Modus das Leg beenden? */
function canFinishWith(d: Dart, out: X01Options["out"]): boolean {
  if (out === "straight") return true;
  if (out === "double") return isDouble(d);
  return d.multiplier === 2 || d.multiplier === 3; // master
}

export interface X01VisitResult {
  state: X01LegState;
  bust: boolean;
  legWon: boolean;
  /** Punkte, die tatsächlich gezählt haben (0 bei Bust). */
  scored: number;
}

/**
 * Wendet eine komplette Aufnahme (bis zu 3 Darts) des Teams `teamIndex` an.
 * Bricht die Wertung ab, sobald das Leg gewonnen ist (weitere Darts ignoriert).
 */
export function applyX01Visit(
  state: X01LegState,
  options: X01Options,
  teamIndex: number,
  playerId: string,
  darts: Dart[],
  dartsUsed?: number,
  doubleAttempts = 0,
  bullFinish?: boolean,
): X01VisitResult {
  const startRemaining = state.remaining[teamIndex]!;
  let rem = startRemaining;
  let bust = false;
  let legWon = false;
  const counted: Dart[] = [];

  for (const d of darts) {
    if (legWon) break;
    const p = dartPoints(d);
    const next = rem - p;

    if (next < 0) {
      bust = true;
      break;
    }
    if (next === 0) {
      if (canFinishWith(d, options.out)) {
        rem = 0;
        counted.push(d);
        legWon = true;
        break;
      }
      // auf 0 gelandet, aber kein gültiger Finisher → Bust
      bust = true;
      break;
    }
    if (next === 1 && options.out === "double") {
      // Rest 1 ist im Double-Out nicht finishbar → Bust
      bust = true;
      break;
    }
    rem = next;
    counted.push(d);
  }

  const newRemaining = state.remaining.slice();
  newRemaining[teamIndex] = bust ? startRemaining : rem;
  const scored = bust ? 0 : startRemaining - rem;
  const used = dartsUsed ?? darts.length;

  const newState: X01LegState = {
    ...state,
    remaining: newRemaining,
    visits: [
      ...state.visits,
      {
        teamIndex,
        playerId,
        darts: bust ? darts : counted,
        dartsUsed: used,
        scored,
        doubleAttempts,
        bust,
        bullFinish: legWon ? bullFinish : undefined,
      },
    ],
    winnerTeamIndex: legWon ? teamIndex : state.winnerTeamIndex,
  };

  return { state: newState, bust, legWon, scored };
}

/** 3-Dart-Average eines Teams im Leg. */
export function legAverage(state: X01LegState, teamIndex: number, startScore: number): number {
  const teamVisits = state.visits.filter((v) => v.teamIndex === teamIndex);
  const dartsThrown = teamVisits.reduce((n, v) => n + v.dartsUsed, 0);
  if (dartsThrown === 0) return 0;
  const scored = startScore - state.remaining[teamIndex]!;
  return (scored / dartsThrown) * 3;
}
