/**
 * Schreibender Zugriff auf 3K (Ergebnis-Rückschreibung) – Gegenstück zum
 * lesenden threeK.ts. Bewusst NICHT an den Match-Ende-Ablauf angehängt;
 * erstmal nur manuell testbar (siehe /admin/threek-test-write in index.ts),
 * bis das am "Dummy TEST"-Turnier ausgiebig geprüft wurde. Siehe Memory
 * webdarts-3k-tournament-integration.md.
 */

import { getThreeKToken, invalidateThreeKToken, MANDANT_KEY, MANDANT_DATABASE, threeKWriteEnabled } from "./threeKAuth.js";

const BASE = "https://backend3.3k-darts.com/2k-backend3/api/v1/";

async function authedRequest(path: string, body: unknown, retry = true): Promise<Response> {
  const token = await getThreeKToken();
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Mandant-Key": MANDANT_KEY,
      "Mandant-Database": MANDANT_DATABASE,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 && retry) {
    invalidateThreeKToken();
    return authedRequest(path, body, false);
  }
  return res;
}

export { threeKWriteEnabled };

/** Ergebnis eines Matches nach 3K schreiben. 3K bestimmt selbst anhand von
 *  legsBestOf, ob das Match damit beendet ist (setzt statusCd/endDate). */
export async function writeThreeKResult(matchId: number, legsHome: number, legsAway: number): Promise<void> {
  const res = await authedRequest(`match/${matchId}/update`, { legsHome, legsAway });
  if (!res.ok) {
    throw new Error(`3K-Ergebnis-Update fehlgeschlagen: HTTP ${res.status}`);
  }
}
