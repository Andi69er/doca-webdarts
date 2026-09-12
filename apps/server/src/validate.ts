/**
 * Serverseitige Eingabe-Validierung. Der Client wird als nicht vertrauenswürdig
 * behandelt: Konfiguration wird auf gültige Bereiche geklemmt, Spiel-Aktionen
 * werden strikt geprüft, sonst verworfen.
 */

import type { BullOffThrow, Dart, MatchAction, MatchConfig } from "@webdarts/engine";

const OUT_MODES = new Set(["straight", "double", "master"]);

function clampInt(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

/** Baut aus beliebigem Client-Input eine garantiert gültige MatchConfig. */
export function sanitizeConfig(raw: unknown): MatchConfig {
  const r = (raw ?? {}) as Record<string, any>;
  const outOk = (v: unknown) => (OUT_MODES.has(v as string) ? (v as "straight" | "double" | "master") : null);
  return {
    mode: r.mode === "cricket" ? "cricket" : "x01",
    x01: {
      startScore: clampInt(r.x01?.startScore, 2, 1001, 501),
      out: outOk(r.x01?.out) ?? "double",
      in: outOk(r.x01?.in) ?? "straight",
    },
    cricket: { variant: r.cricket?.variant === "cutthroat" ? "cutthroat" : "standard" },
    legsToWinSet: clampInt(r.legsToWinSet, 1, 21, 3),
    setsToWin: clampInt(r.setsToWin, 1, 13, 1),
    bullOff: Boolean(r.bullOff),
    twoClearLegs: Boolean(r.twoClearLegs),
    legBulloffRounds: clampInt(r.legBulloffRounds, 0, 40, 0),
    legsCap: clampInt(r.legsCap, 0, 41, 0),
    teamSize: r.teamSize === 1 ? 1 : 2,
  };
}

/** Prüft eine Spiel-Aktion. Rückgabe: bereinigte Aktion oder null (= ablehnen). */
export function validateAction(raw: unknown): MatchAction | null {
  const a = raw as Record<string, any>;
  if (!a || typeof a !== "object") return null;

  switch (a.type) {
    case "RECORD_SCORE": {
      const score = Math.round(Number(a.score));
      if (!Number.isFinite(score) || score < 0 || score > 180) return null;
      const darts = [1, 2, 3].includes(a.darts) ? a.darts : 3;
      const doubleDarts =
        Number.isInteger(a.doubleDarts) && a.doubleDarts >= 0 && a.doubleDarts <= 3 ? a.doubleDarts : 0;
      return {
        type: "RECORD_SCORE",
        score,
        darts,
        finishedOnDouble: Boolean(a.finishedOnDouble),
        doubleDarts,
        bullFinish: a.bullFinish === true ? true : undefined,
      };
    }

    case "RECORD_VISIT": {
      if (!Array.isArray(a.darts) || a.darts.length === 0 || a.darts.length > 3) return null;
      const darts: Dart[] = [];
      for (const d of a.darts) {
        const value = Math.round(Number(d?.value));
        const multiplier = d?.multiplier;
        if (![1, 2, 3].includes(multiplier)) return null;
        if (!((value >= 0 && value <= 20) || value === 25)) return null;
        if (value === 25 && multiplier === 3) return null;
        if (value === 0 && multiplier !== 1) return null;
        darts.push({ value, multiplier });
      }
      return { type: "RECORD_VISIT", darts };
    }

    case "BULLOFF_THROW": {
      if (a.teamIndex !== 0 && a.teamIndex !== 1) return null;
      if (typeof a.playerId !== "string") return null;
      if (!Array.isArray(a.darts) || a.darts.length === 0 || a.darts.length > 3) return null;
      const kinds = new Set(["DBULL", "SBULL", "MISS", "mm"]);
      const darts: BullOffThrow[] = [];
      for (const t of a.darts) {
        if (!t || !kinds.has(t.kind)) return null;
        if (t.kind === "mm") {
          const mm = Number(t.mm);
          if (!Number.isFinite(mm) || mm < 0) return null;
          darts.push({ kind: "mm", mm });
        } else {
          darts.push({ kind: t.kind });
        }
      }
      return { type: "BULLOFF_THROW", teamIndex: a.teamIndex, playerId: a.playerId, darts };
    }

    case "LEG_BULLOFF_THROW": {
      if (a.teamIndex !== 0 && a.teamIndex !== 1) return null;
      if (typeof a.playerId !== "string") return null;
      if (!Array.isArray(a.darts) || a.darts.length === 0 || a.darts.length > 3) return null;
      const kinds = new Set(["DBULL", "SBULL", "MISS", "mm"]);
      const darts: BullOffThrow[] = [];
      for (const t of a.darts) {
        if (!t || !kinds.has(t.kind)) return null;
        if (t.kind === "mm") {
          const mm = Number(t.mm);
          if (!Number.isFinite(mm) || mm < 0) return null;
          darts.push({ kind: "mm", mm });
        } else {
          darts.push({ kind: t.kind });
        }
      }
      return { type: "LEG_BULLOFF_THROW", teamIndex: a.teamIndex, playerId: a.playerId, darts };
    }

    default:
      return null;
  }
}

/** Einfacher Token-Bucket pro (Socket, Aktion). */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; ts: number }>();

  allow(socketId: string, key: string, perMinute: number): boolean {
    const k = `${socketId}:${key}`;
    const now = Date.now();
    const b = this.buckets.get(k) ?? { tokens: perMinute, ts: now };
    b.tokens = Math.min(perMinute, b.tokens + ((now - b.ts) / 60000) * perMinute);
    b.ts = now;
    if (b.tokens < 1) {
      this.buckets.set(k, b);
      return false;
    }
    b.tokens -= 1;
    this.buckets.set(k, b);
    return true;
  }

  forget(socketId: string): void {
    for (const k of this.buckets.keys()) {
      if (k.startsWith(`${socketId}:`)) this.buckets.delete(k);
    }
  }
}
