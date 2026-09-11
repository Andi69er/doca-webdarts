/**
 * Holt die schlanke Mitgliederliste von doca.at (webspiele/webdarts/members.php)
 * für den 3K-Namensabgleich. In-Memory-Cache, damit nicht bei jedem
 * Turnier-Seitenaufruf neu gegen die DB gefragt wird.
 */

import type { DirectoryMember } from "./nameMatch.js";

const URL_ = (process.env.WEBDARTS_MEMBERS_URL ?? "").trim();
const SECRET = process.env.WEBDARTS_SECRET ?? "";
const TTL = 10 * 60_000;

let cache: { ts: number; data: DirectoryMember[] } | null = null;

let warnedMissingConfig = false;

export async function getMemberDirectory(): Promise<DirectoryMember[]> {
  if (!URL_ || !SECRET) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn(
        "[memberDirectory] WEBDARTS_MEMBERS_URL oder WEBDARTS_SECRET nicht gesetzt – " +
          "3K-Namenszuordnung liefert bis das behoben ist immer leer.",
      );
    }
    return [];
  }
  if (cache && Date.now() - cache.ts < TTL) return cache.data;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(URL_, { headers: { "x-webdarts-key": SECRET }, signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = (await res.json()) as DirectoryMember[];
    if (!Array.isArray(data)) throw new Error("bad payload");
    cache = { ts: Date.now(), data };
    return data;
  } catch (err) {
    console.warn("[memberDirectory] Abruf fehlgeschlagen:", (err as Error).message);
    return cache?.data ?? [];
  }
}
