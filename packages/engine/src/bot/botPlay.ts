/**
 * Bot-Spiellogik – portiert aus `js/scorer/bot.js` von doca.at.
 * Statt DOM/Events zu benutzen liefert der Bot hier reine `Dart[]`-Aufnahmen,
 * die direkt über `RECORD_VISIT` in die Engine gehen.
 *
 * `average` = Ziel-3-Dart-Average (Skill-Regler). Höher = besser.
 */

import type { CricketLegState, Dart, InOutMode, X01LegState } from "../types";
import { dartPoints } from "../types";
import { CHECKOUT_PATHS, DARTBOARD_NEIGHBORS } from "./boardData";

const rnd = () => Math.random();

/**
 * Zielzahl (Bett) für den nächsten Bot-Dart bei X01. Ein schwächerer Bot
 * plant nicht immer den exakten, lehrbuchmäßigen Mehr-Dart-Pfad durch -
 * beim "Setup-Dart" (nicht dem letzten Dart eines mehrteiligen Checkouts)
 * wirft er manchmal einfach auf eine große Zahl statt auf das geplante Feld,
 * ein sehr typischer Amateur-Fehler ("groß reinhauen statt vorausplanen").
 * Bei Restwerten mit mehreren bekannten Alternativpfaden (z.B. 90, 88, 84)
 * nimmt er außerdem nicht immer den ersten (kanonisch besten) Pfad.
 */
function getBotTarget(score: number, dartsThrownInTurn: number, skill: number): number {
  if (score > 170) return 20;

  const raw = CHECKOUT_PATHS[score];
  if (raw) {
    const weak = 1 - Math.max(1, Math.min(100, skill)) / 100;
    let path: string;
    if (Array.isArray(raw)) {
      path = rnd() < weak * 0.6 ? raw[Math.floor(rnd() * raw.length)]! : raw[0]!;
    } else {
      path = raw;
    }
    const segments = path.split("-");
    const isSetupDart = dartsThrownInTurn < segments.length - 1;
    if (isSetupDart && rnd() < weak * 0.5) {
      return rnd() < 0.5 ? 20 : 19;
    }
    const seg = segments[dartsThrownInTurn];
    if (seg) {
      let num: number;
      if (seg.startsWith("T") || seg.startsWith("D")) num = parseInt(seg.substring(1), 10);
      else if (seg === "Bull") num = 25;
      else num = parseInt(seg, 10);
      if (!Number.isNaN(num)) return num;
    }
  }
  if (score > 60) return 20;
  if (score > 40 && score % 2 === 0) return (score - 40) / 2;
  if (score <= 40 && score % 2 === 0) return score / 2;
  return 19;
}

/**
 * Wirft einen Dart auf `targetBed` mit gegebenem Skill – liefert einen Dart.
 * `pressure`: reduziert die effektive Trefferquote auf ein Double, wenn's
 * gerade um den Matchdart geht (Nervosität) - siehe `botX01Visit`.
 */
function throwDart(targetBed: number, skill: number, remainingScore: number, pressure: boolean): Dart {
  if (!(targetBed in DARTBOARD_NEIGHBORS)) targetBed = 20;
  const s = Math.max(1, Math.min(100, skill));
  const r = rnd();

  // Bull anvisiert
  if (targetBed === 25) {
    const bs = pressure ? s * 0.8 : s;
    if (r < (bs / 100) * 0.2) return { value: 25, multiplier: 2 }; // Bulls Eye (50)
    if (r < (bs / 100) * 0.6) return { value: 25, multiplier: 1 }; // 25
    const miss = [1, 5, 20, 18, 13][Math.floor(rnd() * 5)]!;
    return { value: miss, multiplier: 1 };
  }

  const path = CHECKOUT_PATHS[remainingScore];
  const isDoubleAttempt =
    (remainingScore <= 40 && remainingScore % 2 === 0) ||
    (!!path &&
      (Array.isArray(path) ? path[0]! : path).split("-").some((seg) => seg.startsWith("D")));

  // Trefferquote AUF die Zielzahl (egal welcher Ring) skaliert nichtlinear mit
  // dem Skill - ein schwacher Bot soll die Zahl oft KOMPLETT verfehlen, nicht
  // nur seltener die Treble/Double treffen. Vorher war diese Basis-Trefferquote
  // mit 0.8 fix verdrahtet, wodurch selbst ein "Amateur (Ø 40)"-Preset real
  // einen Average von ~68 gespielt hat statt ~40 (durchsimuliert und gegen die
  // Presets in Hub.tsx kalibriert: 40/55/70/85 -> ~43/55/68/85 tatsächlicher
  // Average, 100 -> ~96, nah am alten Verhalten für die PDC-Star-Bots).
  // Bei "pressure" (Matchdart) sinkt die effektive Trefferquote NUR bei einem
  // Doppel-Versuch spürbar - Nervosität schlägt vor allem beim entscheidenden
  // Wurf zu, nicht beim normalen Punkten.
  const effSkill = isDoubleAttempt && pressure ? s * 0.78 : s;
  const sp = Math.pow(effSkill / 100, 1.2);
  const hitChance = Math.min(1, 0.15 + 0.95 * sp);
  const trebleShare = Math.min(1, 0.3 * sp);
  const doubleShare = Math.min(1, 0.39 * sp);

  if (r < hitChance) {
    const rRing = rnd();
    if (isDoubleAttempt) {
      if (rRing < doubleShare) return { value: targetBed, multiplier: 2 };
      return { value: targetBed, multiplier: 1 };
    }
    if (rRing < trebleShare) return { value: targetBed, multiplier: 3 };
    return { value: targetBed, multiplier: 1 };
  }

  // Verfehlt die Zielzahl - meist knapp daneben (Nachbarfeld), seltener wild verstreut.
  if (rnd() < 0.6) {
    const n = DARTBOARD_NEIGHBORS[targetBed]!;
    return { value: n[Math.floor(rnd() * 2)]!, multiplier: 1 };
  }
  return { value: Math.floor(rnd() * 20) + 1, multiplier: 1 };
}

/**
 * Eine komplette Bot-Aufnahme für X01. Liefert 1–3 Darts.
 * Bust-/Finish-Prüfung macht die Engine anschließend selbst.
 *
 * `isMatchDart`: true, wenn ein Checkout in dieser Aufnahme gleich das ganze
 * Match entscheiden würde - der Bot wird dann bei Doppel-Versuchen spürbar
 * nervöser (siehe `throwDart`). Vom Aufrufer (Room.runBotTurn) anhand des
 * aktuellen Spielstands (legsWonInSet/setsWon vs. Config) ermittelt.
 */
export function botX01Visit(
  leg: X01LegState,
  teamIndex: number,
  average: number,
  _out: InOutMode,
  isMatchDart = false,
): Dart[] {
  const darts: Dart[] = [];
  let rem = leg.remaining[teamIndex] ?? 0;

  for (let i = 0; i < 3; i++) {
    const target = getBotTarget(rem, i, average);
    const dart = throwDart(target, average, rem, isMatchDart);
    darts.push(dart);
    const next = rem - dartPoints(dart);
    if (next <= 1) break; // Bust oder Checkout -> Aufnahme endet
    rem = next;
  }
  return darts;
}

// --- Cricket -------------------------------------------------------------

function getCricketBotTarget(
  botMarks: Record<string, number>,
  botPoints: number,
  oppMarks: Record<string, number>,
  oppPoints: number,
): number {
  const targets = [20, 19, 18, 17, 16, 15, 25];
  const key = (t: number) => (t === 25 ? "B" : String(t));
  const open = targets.filter((t) => (botMarks[key(t)] ?? 0) < 3);

  if (oppPoints > botPoints) {
    const threats = targets.filter(
      (t) => (oppMarks[key(t)] ?? 0) === 3 && (botMarks[key(t)] ?? 0) < 3,
    );
    if (threats.length) return Math.max(...threats);
  }
  const scoring = targets.filter(
    (t) => (botMarks[key(t)] ?? 0) === 3 && (oppMarks[key(t)] ?? 0) < 3,
  );
  if (scoring.length) {
    if (open.length && rnd() < 0.5) return Math.max(...open);
    return Math.max(...scoring);
  }
  if (open.length) return Math.max(...open);
  const any = targets.filter((t) => (oppMarks[key(t)] ?? 0) < 3);
  return any.length ? Math.max(...any) : 20;
}

function throwCricketDart(target: number, skill: number): Dart {
  const s = Math.max(1, Math.min(100, skill)) / 100;
  const r = rnd();
  if (target !== 25 && r < 0.15 * s) return { value: target, multiplier: 3 };
  if (r < 0.25 * s) return { value: target, multiplier: 2 };
  if (r < 0.85 * s) return { value: target, multiplier: 1 };
  return { value: 0, multiplier: 1 }; // daneben
}

export function botCricketVisit(
  leg: CricketLegState,
  teamIndex: number,
  average: number,
): Dart[] {
  const darts: Dart[] = [];
  const opp = teamIndex === 0 ? 1 : 0;
  const botMarks = { ...leg.marks[teamIndex]! };
  const oppMarks = leg.marks[opp]!;

  for (let i = 0; i < 3; i++) {
    const target = getCricketBotTarget(
      botMarks,
      leg.points[teamIndex] ?? 0,
      oppMarks,
      leg.points[opp] ?? 0,
    );
    const dart = throwCricketDart(target, average);
    darts.push(dart);
    if (dart.value >= 15) {
      const k = dart.value === 25 ? "B" : String(dart.value);
      botMarks[k as keyof typeof botMarks] = Math.min(
        3,
        (botMarks[k as keyof typeof botMarks] ?? 0) + dart.multiplier,
      );
    }
  }
  return darts;
}

/** Ausbullen: 3 Darts, Trefferwahrscheinlichkeit steigt mit dem Average. */
export function botBullOff(average: number): ("DBULL" | "SBULL" | "MISS")[] {
  const s = Math.max(1, Math.min(100, average));
  const out: ("DBULL" | "SBULL" | "MISS")[] = [];
  for (let i = 0; i < 3; i++) {
    const r = rnd();
    if (r < (s / 100) * 0.25) out.push("DBULL");
    else if (r < (s / 100) * 0.7) out.push("SBULL");
    else out.push("MISS");
  }
  return out;
}
