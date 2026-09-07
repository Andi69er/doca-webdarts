/**
 * Einfache Match-Historie als JSON-Lines-Datei (data/results.jsonl).
 * Kein DB-Server nötig; reicht für Vereinsbetrieb und lässt sich später
 * problemlos nach doca.at übernehmen.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const FILE = resolve(process.env.RESULTS_FILE ?? "data/results.jsonl");

export async function appendResult(record: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(dirname(FILE), { recursive: true });
    await appendFile(FILE, JSON.stringify(record) + "\n", "utf8");
  } catch (err) {
    console.warn("[results] konnte nicht schreiben:", (err as Error).message);
  }
}

export async function recentResults(limit = 50): Promise<unknown[]> {
  try {
    const text = await readFile(FILE, "utf8");
    const lines = text.split("\n").filter(Boolean);
    return lines
      .slice(-Math.max(1, Math.min(500, limit)))
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}
