/**
 * Baut aus den (dummen) Achievement-Kandidaten der Engine + den live von 3K
 * abgefragten Kategorien/Spielern die fertigen Bestleistungen-Einträge fürs
 * Schreiben. Getrennt von threeKWrite.ts (das nur den rohen HTTP-Zugriff
 * kennt) und von tournaments.ts (das die Turnier-/Paarungs-Verwaltung kennt).
 * Siehe Memory webdarts-3k-tournament-integration.md für die Herleitung.
 */

import type { AchievementCandidate } from "@webdarts/engine";
import type { MatchRoomEntry } from "./tournaments.js";
import {
  fetchPerformanceRequirements,
  type PerformanceEntry,
  type ThreeKPlayer,
} from "./threeKWrite.js";

/** Welche Seite (Heim/Gast) und welcher Slot (0/1 bei Doppel) ist dieser Webdarts-Spieler? */
function findSlot(
  playerId: string,
  entry: MatchRoomEntry,
): { participantId: number | null; playerIndex: number } | null {
  if (playerId === entry.homeUid) return { participantId: entry.homeParticipantId, playerIndex: 0 };
  if (playerId === entry.homeUid2) return { participantId: entry.homeParticipantId, playerIndex: 1 };
  if (playerId === entry.awayUid) return { participantId: entry.awayParticipantId, playerIndex: 0 };
  if (playerId === entry.awayUid2) return { participantId: entry.awayParticipantId, playerIndex: 1 };
  return null;
}

/**
 * Lädt die aktuellen 3K-Kategorien/Spieler für dieses Match und baut daraus
 * die fertigen Einträge für writePerformances() – nur für Kandidaten, die
 * tatsächlich in eine der live gemeldeten Bandgrenzen fallen und deren
 * Spieler sich eindeutig zuordnen lässt. Alles andere wird still übersprungen
 * (kein Fehler – z.B. ein Highscore von 140 ist nicht in jedem Event/Turnier
 * eine gemeldete Kategorie).
 */
export async function buildPerformanceEntries(
  candidates: AchievementCandidate[],
  entry: MatchRoomEntry,
): Promise<PerformanceEntry[]> {
  if (candidates.length === 0) return [];
  const { performances, players } = await fetchPerformanceRequirements(entry.eventId, entry.matchId);

  const out: PerformanceEntry[] = [];
  for (const c of candidates) {
    const slot = findSlot(c.playerId, entry);
    if (!slot || slot.participantId === null) continue;
    const player: ThreeKPlayer | undefined = players.find(
      (p) => p.participantId === slot.participantId && p.playerIndex === slot.playerIndex,
    );
    if (!player) continue;
    const band = performances.find(
      (p) => p.performanceTypeCd === c.performanceTypeCd && c.value >= p.min && c.value <= p.max,
    );
    if (!band) continue;
    out.push({
      count: 1,
      value: String(c.value),
      performanceTypeCd: c.performanceTypeCd,
      performance: band,
      player,
      match: { id: entry.matchId },
      eventId: entry.eventId,
    });
  }
  return out;
}
