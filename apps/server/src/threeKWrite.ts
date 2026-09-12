/**
 * Schreibender Zugriff auf 3K (Ergebnis-Rückschreibung) – Gegenstück zum
 * lesenden threeK.ts. Bewusst NICHT an den Match-Ende-Ablauf angehängt;
 * erstmal nur manuell testbar (siehe /admin/threek-test-write in index.ts),
 * bis das am "Dummy TEST"-Turnier ausgiebig geprüft wurde. Siehe Memory
 * webdarts-3k-tournament-integration.md.
 */

import { getThreeKToken, invalidateThreeKToken, MANDANT_KEY, MANDANT_DATABASE, threeKWriteEnabled } from "./threeKAuth.js";

const BASE = "https://backend3.3k-darts.com/2k-backend3/api/v1/";

async function authedRequest(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  retry = true,
): Promise<Response> {
  const token = await getThreeKToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Mandant-Key": MANDANT_KEY,
      "Mandant-Database": MANDANT_DATABASE,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry) {
    invalidateThreeKToken();
    return authedRequest(path, method, body, false);
  }
  return res;
}

export { threeKWriteEnabled };

/** Ergebnis eines Matches nach 3K schreiben. 3K bestimmt selbst anhand von
 *  legsBestOf, ob das Match damit beendet ist (setzt statusCd/endDate). */
export async function writeThreeKResult(matchId: number, legsHome: number, legsAway: number): Promise<void> {
  const res = await authedRequest(`match/${matchId}/update`, "POST", { legsHome, legsAway });
  if (!res.ok) {
    throw new Error(`3K-Ergebnis-Update fehlgeschlagen: HTTP ${res.status}`);
  }
}

// --- Bestleistungen (Highscore/Highfinish/Shortgame Doppel/Bullfinish) ------

/** Eine Bandgrenze für eine Bestleistungs-Kategorie, wie 3K sie pro Event/Match vorgibt. */
export interface ThreeKPerformanceBand {
  id: number;
  performanceTypeCd: string;
  name: string;
  min: number;
  max: number;
  sum: number;
  orderNr: string;
  tournamentKindCd?: string;
}

/** Voller 3K-Spielerdatensatz (eigene player.id, unabhängig von der participantId). */
export interface ThreeKPlayer {
  id: number;
  playerNumber?: string;
  passNr: string | number;
  displayName: string;
  displayNameList: string;
  firstname: string;
  name: string;
  nickname: string;
  username: string;
  genderCd: string;
  participantId: number;
  playerIndex: number;
  participantPosition: number;
  firstnameLastname: string;
}

/** Welche Bestleistungs-Kategorien/Spieler für dieses Match überhaupt infrage
 *  kommen - live pro Event+Match abgefragt (Bandgrenzen sind nicht fix, siehe
 *  Memory webdarts-3k-tournament-integration.md). Braucht denselben Auth wie
 *  das Ergebnis-Schreiben (anders als die öffentlichen Lese-Endpunkte in
 *  threeK.ts). */
export async function fetchPerformanceRequirements(
  eventId: number,
  matchId: number,
): Promise<{ performances: ThreeKPerformanceBand[]; players: ThreeKPlayer[] }> {
  const res = await authedRequest(`performance/requirements/${eventId}/match/${matchId}`, "GET");
  if (!res.ok) {
    throw new Error(`3K-Bestleistungen-Abfrage fehlgeschlagen: HTTP ${res.status}`);
  }
  return (await res.json()) as { performances: ThreeKPerformanceBand[]; players: ThreeKPlayer[] };
}

export interface PerformanceEntry {
  count: number;
  value: string;
  performanceTypeCd: string;
  performance: ThreeKPerformanceBand;
  player: ThreeKPlayer;
  match: { id: number };
  eventId: number;
}

/** Eine oder mehrere Bestleistungen nach 3K schreiben (ein POST für alle). */
export async function writePerformances(entries: PerformanceEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const res = await authedRequest("performance/player", "POST", entries);
  if (!res.ok) {
    throw new Error(`3K-Bestleistungen-Update fehlgeschlagen: HTTP ${res.status}`);
  }
}
