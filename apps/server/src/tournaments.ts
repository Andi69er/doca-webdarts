/**
 * Turnier-Verknüpfung (3K -> Webdarts), "DL-Copilot"-Ersatz, Phase 1 (lesend).
 * Persistenz als JSON-Datei, gleiches Muster wie results.ts – reicht für
 * Vereinsbetrieb, Render-Dateisystem ist flüchtig (übersteht Neustarts,
 * nicht zwingend jedes Deploy). Siehe Memory
 * webdarts-3k-tournament-integration.md für den Gesamtplan.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { customAlphabet } from "nanoid";
import type { MatchConfig, TournamentDetail, TournamentPairing, TournamentSummary } from "@webdarts/engine";
import { fetchEventInfo, fetchPhaseRounds, fetchRoundMatches } from "./threeK.js";
import { getMemberDirectory } from "./memberDirectory.js";
import { matchSingle, type DirectoryMember } from "./nameMatch.js";

/**
 * Heim/Gast einer Paarung auflösen. Doppel-Events (`eventKindCd: "DOUBLE"`)
 * zeigen bei 3K nur den Team-Namen ("Nachname & Nachname"), nicht die zwei
 * Einzel-Accounts dahinter – dafür gibt's keinen API-Weg (siehe Memory
 * webdarts-3k-tournament-integration.md). Phase 1 löst deshalb nur Einzel
 * automatisch auf; Doppel-Paarungen bleiben ohne Uid (Anzeige informativ,
 * "Spiel starten" bleibt deaktiviert) bis die Zuordnung gebaut ist.
 */
function resolveHomeAway(
  homeName: string,
  awayName: string,
  isDouble: boolean,
  members: DirectoryMember[],
): [string | null, string | null] {
  if (isDouble) return [null, null];
  return [matchSingle(homeName, members), matchSingle(awayName, members)];
}

const FILE = resolve(process.env.TOURNAMENTS_FILE ?? "data/tournaments.json");
const genId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

interface TournamentRecord {
  id: string;
  name: string;
  threeKEventId: number;
  profile: MatchConfig | null;
  createdBy: string;
  createdAt: number;
}

let loaded = false;
let records: TournamentRecord[] = [];

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const text = await readFile(FILE, "utf8");
    records = JSON.parse(text);
    if (!Array.isArray(records)) records = [];
  } catch {
    records = [];
  }
}

async function persist(): Promise<void> {
  try {
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (err) {
    console.warn("[tournaments] konnte nicht speichern:", (err as Error).message);
  }
}

export async function listTournaments(): Promise<TournamentSummary[]> {
  await load();
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    threeKEventId: r.threeKEventId,
    hasProfile: r.profile !== null,
  }));
}

export async function addTournament(
  threeKEventId: number,
  name: string | undefined,
  createdBy: string,
): Promise<TournamentSummary> {
  await load();
  if (records.some((r) => r.threeKEventId === threeKEventId)) {
    throw new Error("Dieses 3K-Turnier ist schon verknüpft.");
  }
  const info = await fetchEventInfo(threeKEventId); // wirft, wenn ID unerreichbar/ungültig
  const rec: TournamentRecord = {
    id: genId(),
    name: (name?.trim() || info.name || `Turnier ${threeKEventId}`).slice(0, 60),
    threeKEventId,
    profile: null,
    createdBy,
    createdAt: Date.now(),
  };
  records.push(rec);
  await persist();
  return { id: rec.id, name: rec.name, threeKEventId: rec.threeKEventId, hasProfile: false };
}

export async function setTournamentProfile(id: string, profile: MatchConfig): Promise<void> {
  await load();
  const rec = records.find((r) => r.id === id);
  if (!rec) throw new Error("Turnier nicht gefunden.");
  rec.profile = profile;
  await persist();
}

async function getRecord(id: string): Promise<TournamentRecord> {
  await load();
  const rec = records.find((r) => r.id === id);
  if (!rec) throw new Error("Turnier nicht gefunden.");
  return rec;
}

/** Alle Runden inkl. aufgelöster Paarungen laden (für die Turnier-Seite). */
export async function getTournamentDetail(id: string, myUid: string | null): Promise<TournamentDetail> {
  const rec = await getRecord(id);
  const info = await fetchEventInfo(rec.threeKEventId);
  const phase = info.phases[0];
  if (!phase) {
    return {
      id: rec.id,
      name: rec.name,
      threeKEventId: rec.threeKEventId,
      hasProfile: rec.profile !== null,
      profile: rec.profile,
      rounds: [],
    };
  }
  const rounds = await fetchPhaseRounds(rec.threeKEventId, phase.id);
  const members = await getMemberDirectory();
  const isDouble = info.eventKindCd === "DOUBLE";

  const outRounds: { name: string; pairings: TournamentPairing[] }[] = [];
  for (const round of rounds) {
    const matches = await fetchRoundMatches(rec.threeKEventId, phase.id, round.id);
    const pairings: TournamentPairing[] = matches.map((m) => {
      const [homeUid, awayUid] = resolveHomeAway(m.participantHomeName, m.participantAwayName, isDouble, members);
      const iAmHome = myUid !== null && myUid === homeUid;
      const isMine = iAmHome || (myUid !== null && myUid === awayUid);
      return {
        matchId: m.id,
        roundName: round.name,
        homeName: m.participantHomeName,
        awayName: m.participantAwayName,
        homeUid,
        awayUid,
        status: m.statusCd === "FINISH" ? "finished" : "open",
        legsHome: m.legsHome,
        legsAway: m.legsAway,
        isMine,
        iAmHome,
      };
    });
    outRounds.push({ name: round.name, pairings });
  }

  return {
    id: rec.id,
    name: rec.name,
    threeKEventId: rec.threeKEventId,
    hasProfile: rec.profile !== null,
    profile: rec.profile,
    rounds: outRounds,
  };
}

/** Für tournament:startMatch – Profil + Heim/Gast einer einzelnen Paarung auflösen. */
export async function resolvePairing(
  id: string,
  matchId: number,
): Promise<{
  profile: MatchConfig;
  homeUid: string | null;
  awayUid: string | null;
  homeName: string;
  awayName: string;
} | null> {
  const rec = await getRecord(id);
  if (!rec.profile) throw new Error("Für dieses Turnier ist noch kein Matchprofil festgelegt.");
  const info = await fetchEventInfo(rec.threeKEventId);
  const phase = info.phases[0];
  if (!phase) return null;
  const isDouble = info.eventKindCd === "DOUBLE";
  const members = await getMemberDirectory();
  const rounds = await fetchPhaseRounds(rec.threeKEventId, phase.id);
  for (const round of rounds) {
    const matches = await fetchRoundMatches(rec.threeKEventId, phase.id, round.id);
    const hit = matches.find((m) => m.id === matchId);
    if (!hit) continue;
    const [homeUid, awayUid] = resolveHomeAway(hit.participantHomeName, hit.participantAwayName, isDouble, members);
    return {
      profile: rec.profile,
      homeUid,
      awayUid,
      homeName: hit.participantHomeName,
      awayName: hit.participantAwayName,
    };
  }
  return null;
}

// --- Paarung <-> Raum (damit beide Beteiligten im selben Raum landen) -----

interface MatchRoomEntry {
  roomId: string;
  homeUid: string;
  awayUid: string;
}
const matchRoom = new Map<string, MatchRoomEntry>(); // "tournamentId:matchId" -> ...

export function getMatchRoom(tournamentId: string, matchId: number): MatchRoomEntry | undefined {
  return matchRoom.get(`${tournamentId}:${matchId}`);
}
export function setMatchRoom(tournamentId: string, matchId: number, entry: MatchRoomEntry): void {
  matchRoom.set(`${tournamentId}:${matchId}`, entry);
}
