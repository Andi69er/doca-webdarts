/**
 * Checkout-Finder für X01.
 *
 * Sucht einen möglichst „schönen“ Finish-Weg für einen Restwert mit einer
 * bestimmten Anzahl verbleibender Darts. Ersetzt die reine Tabelle des alten
 * doca.at-Rechners durch einen generischen Suchalgorithmus, der auch Master-Out
 * und Straight-Out abdeckt.
 */

import type { Dart, InOutMode, Multiplier } from "./types";
import { dartPoints, isDouble } from "./types";

export interface CheckoutRoute {
  darts: Dart[];
  label: string; // z.B. "T20 T20 D12"
}

interface Segment {
  dart: Dart;
  label: string;
}

/** Alle sinnvollen Einzelfelder eines Dartboards. */
function allSegments(): Segment[] {
  const segs: Segment[] = [];
  for (let v = 1; v <= 20; v++) {
    segs.push({ dart: { value: v, multiplier: 1 }, label: `${v}` });
    segs.push({ dart: { value: v, multiplier: 2 }, label: `D${v}` });
    segs.push({ dart: { value: v, multiplier: 3 }, label: `T${v}` });
  }
  segs.push({ dart: { value: 25, multiplier: 1 }, label: "25" });
  segs.push({ dart: { value: 25, multiplier: 2 }, label: "Bull" });
  return segs;
}

const SEGMENTS = allSegments();

/** Darf dieser Dart das Leg beenden? */
function isValidFinisher(d: Dart, out: InOutMode): boolean {
  if (out === "straight") return true;
  if (out === "double") return isDouble(d);
  // master: Double oder Triple
  return d.multiplier === 2 || d.multiplier === 3;
}

/**
 * Bewertung eines Finishs – kleiner ist besser.
 * Bevorzugt: weniger Darts, hohe erste Darts (Triple), „Standard“-Doubles.
 */
function scoreRoute(route: Segment[]): number {
  let s = route.length * 1000;
  route.forEach((seg, i) => {
    // frühe Darts möglichst hoch
    s -= dartPoints(seg.dart) * (route.length - i);
  });
  const last = route[route.length - 1]!;
  // gängige Doubles leicht bevorzugen
  const nice = new Set([40, 32, 24, 20, 16, 8, 4, 50]);
  if (!nice.has(dartPoints(last.dart))) s += 15;
  return s;
}

/**
 * Findet den besten Checkout-Weg oder null.
 * @param remaining Restpunkte
 * @param dartsLeft verfügbare Darts (1..3)
 * @param out Finish-Regel
 */
export function findCheckout(
  remaining: number,
  dartsLeft: number,
  out: InOutMode = "double",
): CheckoutRoute | null {
  if (remaining <= 0 || dartsLeft <= 0) return null;
  if (out === "double" && remaining > 170) return null;
  if (out === "double" && (remaining === 169 || remaining === 168 || remaining === 166 || remaining === 165 || remaining === 163 || remaining === 162 || remaining === 159)) {
    return null; // klassische „No score“-Bogeys
  }

  let best: { route: Segment[]; score: number } | null = null;

  const search = (rest: number, left: number, acc: Segment[]) => {
    if (rest === 0) {
      const last = acc[acc.length - 1];
      if (last && isValidFinisher(last.dart, out)) {
        const sc = scoreRoute(acc);
        if (!best || sc < best.score) best = { route: [...acc], score: sc };
      }
      return;
    }
    if (left === 0 || rest < 0) return;
    // Reihenfolge: Triples zuerst, dann Doubles, dann Singles → findet „schöne“ Wege früh
    for (const seg of SEGMENTS) {
      const p = dartPoints(seg.dart);
      if (p > rest) continue;
      const isLastDart = left === 1;
      if (isLastDart && p !== rest) continue;
      if (p === rest && !isValidFinisher(seg.dart, out)) {
        if (isLastDart) continue;
        // in double-out darf man nicht auf 0 gehen ohne Double
        continue;
      }
      // in double-out: rest 1 ist tot
      if (out === "double" && rest - p === 1) continue;
      acc.push(seg);
      search(rest - p, left - 1, acc);
      acc.pop();
    }
  };

  search(remaining, Math.min(dartsLeft, 3), []);

  if (!best) return null;
  const b = best as { route: Segment[]; score: number };
  return {
    darts: b.route.map((s: Segment) => s.dart),
    label: b.route.map((s: Segment) => s.label).join(" "),
  };
}

/** Ist der Restwert mit `dartsLeft` Darts überhaupt finishbar? */
export function isCheckoutPossible(
  remaining: number,
  dartsLeft: number,
  out: InOutMode = "double",
): boolean {
  return findCheckout(remaining, dartsLeft, out) !== null;
}

/**
 * Grobe Möglichkeitsprüfung (kein Beweis): könnte dieser Checkout-Endwert mit
 * `dartsUsed` Darts über Bull (Doppel-25 = 50) gefinished worden sein? Viele
 * Werte in diesem Bereich gehen AUCH ohne Bull – dient nur dazu, die
 * "War das ein Bullfinish?"-Rückfrage nicht bei offensichtlich unmöglichen
 * Werten (z.B. 12 mit 1 Dart) zu zeigen. Bereich 50–170 deckt sich mit 3Ks
 * eigener "Bullfinish"-Kategorie.
 */
export function bullFinishPossible(score: number, dartsUsed: number): boolean {
  if (dartsUsed < 1 || score < 50 || score > 170) return false;
  const rest = score - 50;
  return rest <= 60 * (dartsUsed - 1);
}

export type { Multiplier };
