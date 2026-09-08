/**
 * Karriere-Statistik je Spieler (Average, Doppelquote, kürzestes Leg, höchstes Finish).
 *
 * Wird nach jedem beendeten Match fortgeschrieben und in data/player-stats.json
 * gehalten. Kein DB-Server nötig – auf dem Render-Free-Plan liegt die Datei auf
 * einem flüchtigen Dateisystem, d.h. bei einem Deploy/Neustart beginnt die
 * Zählung wieder bei null (gleiches Verhalten wie bei results.jsonl).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PlayerCareer } from "@webdarts/engine";

const FILE = resolve(process.env.PLAYER_STATS_FILE ?? "data/player-stats.json");

/** Roh-Summen je Spieler-ID (stabile cid bzw. "u:<uid>"). */
interface CareerAgg {
  name: string;
  image: string | null;
  matches: number;
  legsWon: number;
  darts: number;
  points: number;
  doubleAttempts: number;
  checkoutHits: number;
  highestFinish: number;
  shortestLegDarts: number | null;
  updatedAt: string;
}

/** Ein Spieler-Beitrag aus einem beendeten Match (siehe rooms.ts). */
export interface FinishedPlayerInput {
  id: string;
  name: string;
  image: string | null;
  darts: number;
  points: number;
  doubleAttempts: number;
  checkoutHits: number;
  highestFinish: number;
  shortestLegDarts: number | null;
  legsWon: number;
}

const store = new Map<string, CareerAgg>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadCareer(): Promise<void> {
  try {
    const raw = JSON.parse(await readFile(FILE, "utf8")) as Record<string, CareerAgg>;
    for (const [k, v] of Object.entries(raw)) store.set(k, v);
    console.log(`[stats] ${store.size} Spieler-Karrieren geladen`);
  } catch {
    // keine Datei -> leer starten
  }
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await mkdir(dirname(FILE), { recursive: true });
      await writeFile(FILE, JSON.stringify(Object.fromEntries(store)), "utf8");
    } catch (err) {
      console.warn("[stats] konnte nicht schreiben:", (err as Error).message);
    }
  }, 2000);
}

/** Match-Beiträge einarbeiten. Bots (`bot:*`) werden ignoriert. */
export function recordCareer(players: FinishedPlayerInput[]): void {
  for (const p of players) {
    if (!p.id || p.id.startsWith("bot:") || p.id.startsWith("partner:")) continue;
    const cur: CareerAgg =
      store.get(p.id) ?? {
        name: p.name,
        image: p.image,
        matches: 0,
        legsWon: 0,
        darts: 0,
        points: 0,
        doubleAttempts: 0,
        checkoutHits: 0,
        highestFinish: 0,
        shortestLegDarts: null,
        updatedAt: "",
      };

    if (p.name) cur.name = p.name;
    if (p.image !== null) cur.image = p.image;
    cur.matches += 1;
    cur.legsWon += p.legsWon;
    cur.darts += p.darts;
    cur.points += p.points;
    cur.doubleAttempts += p.doubleAttempts;
    cur.checkoutHits += p.checkoutHits;
    cur.highestFinish = Math.max(cur.highestFinish, p.highestFinish);
    if (p.shortestLegDarts !== null) {
      cur.shortestLegDarts =
        cur.shortestLegDarts === null
          ? p.shortestLegDarts
          : Math.min(cur.shortestLegDarts, p.shortestLegDarts);
    }
    cur.updatedAt = new Date().toISOString();
    store.set(p.id, cur);
  }
  scheduleSave();
}

/** Aufbereitete Karriere-Werte für die Hub-Liste. null = noch kein gewertetes Match. */
export function careerFor(id: string): PlayerCareer | null {
  const c = store.get(id);
  if (!c || c.matches === 0) return null;
  return {
    matches: c.matches,
    legsWon: c.legsWon,
    average: c.darts ? Number(((c.points / c.darts) * 3).toFixed(2)) : 0,
    checkoutPct: c.doubleAttempts
      ? Number(((c.checkoutHits / c.doubleAttempts) * 100).toFixed(1))
      : 0,
    highestFinish: c.highestFinish,
    shortestLegDarts: c.shortestLegDarts,
  };
}
