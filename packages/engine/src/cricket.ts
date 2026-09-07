/**
 * Cricket-Teilspiel (ein Leg) für zwei Teams.
 *
 * Ziele: 15,16,17,18,19,20 und Bull ("B").
 * - Jeder Treffer gibt Marks (Single 1, Double 2, Triple 3; Bull-Single 1, Bull-Double 2).
 * - Ab 3 Marks ist die Zahl für das Team „offen“.
 * - Weitere Marks auf einer offenen Zahl, die der Gegner noch NICHT geschlossen hat,
 *   bringen Punkte in Höhe des Zahlenwerts (Bull = 25).
 * - `standard`: Punkte gehören dem Werfer.
 *   `cutthroat`: Punkte werden allen Gegnern gutgeschrieben; Sieger ist, wer alles
 *   geschlossen hat und die WENIGSTEN Punkte hat.
 * - Sieg: alle sieben Ziele geschlossen UND (standard) Punkte >= Gegner bzw.
 *   (cutthroat) Punkte <= Gegner.
 */

import type { CricketLegState, CricketOptions, CricketTarget, Dart } from "./types";
import { CRICKET_TARGETS } from "./types";

const TARGET_VALUE: Record<CricketTarget, number> = {
  "15": 15,
  "16": 16,
  "17": 17,
  "18": 18,
  "19": 19,
  "20": 20,
  B: 25,
};

function emptyMarks(): Record<CricketTarget, number> {
  return { "15": 0, "16": 0, "17": 0, "18": 0, "19": 0, "20": 0, B: 0 };
}

export function createCricketLeg(_options: CricketOptions, teamCount: number): CricketLegState {
  return {
    mode: "cricket",
    marks: Array.from({ length: teamCount }, () => emptyMarks()),
    points: Array.from({ length: teamCount }, () => 0),
    visits: [],
    winnerTeamIndex: null,
  };
}

/** Wandelt einen Dart in Cricket-Ziel + Mark-Anzahl. null = kein gültiges Cricket-Ziel. */
function dartToTarget(d: Dart): { target: CricketTarget; marks: number } | null {
  if (d.value === 25) return { target: "B", marks: d.multiplier === 2 ? 2 : 1 };
  if (d.value >= 15 && d.value <= 20) {
    return { target: String(d.value) as CricketTarget, marks: d.multiplier };
  }
  return null;
}

function isClosedByAll(marks: Record<CricketTarget, number>[], target: CricketTarget): boolean {
  return marks.every((m) => m[target] >= 3);
}

function hasWonEverything(marks: Record<CricketTarget, number>, ): boolean {
  return CRICKET_TARGETS.every((t) => marks[t] >= 3);
}

export interface CricketVisitResult {
  state: CricketLegState;
  legWon: boolean;
  /** In dieser Aufnahme erzielte Punkte (Summe). */
  scored: number;
}

export function applyCricketVisit(
  state: CricketLegState,
  options: CricketOptions,
  teamIndex: number,
  playerId: string,
  darts: Dart[],
): CricketVisitResult {
  const marks = state.marks.map((m) => ({ ...m }));
  const points = state.points.slice();
  const teamCount = state.marks.length;
  let scored = 0;

  for (const d of darts) {
    const hit = dartToTarget(d);
    if (!hit) continue;
    let remainingMarks = hit.marks;

    // Zuerst bis 3 Marks „auffüllen“ (zum Öffnen), Rest zählt als Punkte.
    while (remainingMarks > 0) {
      const cur = marks[teamIndex]![hit.target];
      if (cur < 3) {
        marks[teamIndex]![hit.target] = cur + 1;
        remainingMarks--;
        continue;
      }
      // Zahl ist beim Team offen. Punkte nur, wenn nicht von allen geschlossen.
      if (isClosedByAll(marks, hit.target)) {
        remainingMarks = 0;
        break;
      }
      const val = TARGET_VALUE[hit.target];
      if (options.variant === "cutthroat") {
        for (let t = 0; t < teamCount; t++) {
          if (t === teamIndex) continue;
          if (marks[t]![hit.target] < 3) points[t]! += val;
        }
      } else {
        points[teamIndex]! += val;
      }
      scored += val;
      remainingMarks--;
    }
  }

  // Sieg prüfen
  let winnerTeamIndex: number | null = state.winnerTeamIndex;
  for (let t = 0; t < teamCount; t++) {
    if (!hasWonEverything(marks[t]!)) continue;
    if (options.variant === "cutthroat") {
      const minOther = Math.min(...points.filter((_, i) => i !== t));
      if (points[t]! <= minOther) winnerTeamIndex = t;
    } else {
      const maxOther = Math.max(...points.filter((_, i) => i !== t));
      if (points[t]! >= maxOther) winnerTeamIndex = t;
    }
  }

  return {
    state: {
      ...state,
      marks,
      points,
      visits: [...state.visits, { teamIndex, playerId, darts, dartsUsed: darts.length }],
      winnerTeamIndex,
    },
    legWon: winnerTeamIndex !== null && state.winnerTeamIndex === null,
    scored,
  };
}
