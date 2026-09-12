/**
 * Turnier-Verknüpfung (3K -> Webdarts), "DL-Copilot"-Ersatz, Phase 1 (lesend).
 * Persistenz auf doca.at (tournaments_store.php) statt Render-Dateisystem:
 * Render verliert seinen lokalen Speicher bei manchen Deploys (beobachtet -
 * ein Turnier + Matchprofil verschwand nach einem Redeploy spurlos), doca.at
 * ist dauerhaft. Gleiches Auth-Schema wie members.php/ingest.php. Siehe
 * Memory webdarts-3k-tournament-integration.md für den Gesamtplan.
 */

import { customAlphabet } from "nanoid";
import type {
  MatchConfig,
  TournamentDetail,
  TournamentPairing,
  TournamentParticipant,
  TournamentSummary,
} from "@webdarts/engine";
import { fetchEventInfo, fetchPhaseRounds, fetchRoundMatches } from "./threeK.js";
import { getMemberDirectory } from "./memberDirectory.js";
import { matchSingle, matchDoubleTeam, parseSingleDisplayName, type DirectoryMember } from "./nameMatch.js";

interface ResolvedTeams {
  homeUid: string | null;
  homeUid2: string | null;
  awayUid: string | null;
  awayUid2: string | null;
}

/**
 * Heim/Gast einer Paarung auflösen. Bei Einzel je ein Uid pro Seite
 * (homeUid2/awayUid2 bleiben null). Bei Doppel-Events (`eventKindCd:
 * "DOUBLE"`) zeigt 3K nur den Team-Namen ("Nachname & Nachname"), nicht die
 * zwei Einzel-Accounts dahinter – matchDoubleTeam splittet auf die zwei
 * Nachnamen und matcht sie einzeln gegen die Mitgliederliste (siehe Memory
 * webdarts-3k-tournament-integration.md). 0 oder >1 Treffer pro Nachname
 * bleibt null, ist dann von einem Admin manuell zu klären.
 */
/** uid je Slot (0/1) pro rohem 3K-Anzeigenamen; vom Admin manuell gesetzt als
 *  Fallback, wenn matchDoubleTeam/matchSingle 0 oder >1 Treffer ergaben. Ein
 *  gesetzter Slot ersetzt nur diesen einen Slot, der andere bleibt automatisch. */
type OverrideMap = Record<string, [string | null, string | null]>;

function applyOverride(
  name: string,
  auto: [string | null, string | null],
  overrides: OverrideMap,
): [string | null, string | null] {
  const o = overrides[name];
  if (!o) return auto;
  return [o[0] ?? auto[0], o[1] ?? auto[1]];
}

function resolveTeams(
  homeName: string,
  awayName: string,
  isDouble: boolean,
  members: DirectoryMember[],
  overrides: OverrideMap,
): ResolvedTeams {
  const autoHome: [string | null, string | null] = isDouble
    ? matchDoubleTeam(homeName, members)
    : [matchSingle(homeName, members), null];
  const autoAway: [string | null, string | null] = isDouble
    ? matchDoubleTeam(awayName, members)
    : [matchSingle(awayName, members), null];
  const [homeUid, homeUid2] = applyOverride(homeName, autoHome, overrides);
  const [awayUid, awayUid2] = applyOverride(awayName, autoAway, overrides);
  return { homeUid, homeUid2, awayUid, awayUid2 };
}

/** Anzeigename je Slot: bei Doppel die zwei Nachnamen aus "Nachname1 & Nachname2",
 *  bei Einzel der volle Name ohne "(username)"-Zusatz (in beiden Slots gleich,
 *  Slot 1 bleibt bei Einzel ungenutzt - siehe resolveTeams). */
function displayNamePart(full: string, isDouble: boolean): [string, string] {
  if (isDouble) {
    const parts = full.split("&").map((s) => s.trim());
    return [parts[0] || full, parts[1] || full];
  }
  const clean = parseSingleDisplayName(full).fullName;
  return [clean, clean];
}

/** Voller Anzeigename für die Anwesenheitsliste, wenn die uid aufgelöst werden
 *  konnte: "Vorname Nachname (Spielername)" aus dem echten Mitgliederdatensatz -
 *  aussagekräftiger als der rohe 3K-Namensfetzen ("nur Nachname" bei Doppel). */
function memberDisplayName(uid: string, members: DirectoryMember[]): string | null {
  const numId = Number(uid.slice(2));
  const m = members.find((x) => x.id === numId);
  if (!m) return null;
  const full = [m.firstname, m.lastname].filter(Boolean).join(" ").trim();
  const username = m.username || m.darts_live_username;
  if (full && username) return `${full} (${username})`;
  return full || username || null;
}

/** Eindeutige Spielerliste über alle Paarungen einer Runde, für die
 *  Anwesenheitsliste in der Turnier-Lobby. Dedupliziert über uid, bei
 *  unaufgelösten Spielern über den Rohnamen. */
class ParticipantCollector {
  private byKey = new Map<string, TournamentParticipant>();
  add(uid: string | null, fallbackName: string, members: DirectoryMember[]): void {
    const key = uid ?? "raw:" + fallbackName;
    if (this.byKey.has(key)) return;
    const name = (uid && memberDisplayName(uid, members)) || fallbackName;
    this.byKey.set(key, { uid, name });
  }
  list(): TournamentParticipant[] {
    return [...this.byKey.values()];
  }
}

const STORE_URL = (process.env.WEBDARTS_TOURNAMENTS_URL ?? "").trim();
const SECRET = process.env.WEBDARTS_SECRET ?? "";
const genId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

interface TournamentRecord {
  id: string;
  name: string;
  threeKEventId: number;
  isDouble: boolean;
  profile: MatchConfig | null;
  /** Manuelle Spieler-Zuordnungen (Admin), keyed by rohem 3K-Anzeigenamen. Fehlt bei
   *  Turnieren, die vor diesem Feld angelegt wurden - immer mit `?? {}` lesen. */
  overrides?: OverrideMap;
  /** Solange false: nur der Admin sieht/öffnet das Turnier. Fehlt bei Turnieren von vor
   *  diesem Feld - immer mit `?? true` lesen, sonst würden bereits laufende, für alle
   *  sichtbare Turniere durch dieses Feature plötzlich verschwinden. Neue Turniere
   *  setzen es in addTournament() explizit auf false. */
  published?: boolean;
  createdBy: string;
  createdAt: number;
}

let loaded = false;
let records: TournamentRecord[] = [];

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  if (!STORE_URL || !SECRET) {
    console.warn(
      "[tournaments] WEBDARTS_TOURNAMENTS_URL/WEBDARTS_SECRET nicht gesetzt - " +
        "Turniere werden NICHT dauerhaft gespeichert (gehen beim nächsten Deploy verloren).",
    );
    records = [];
    return;
  }
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(STORE_URL, { headers: { "x-webdarts-key": SECRET }, signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    records = Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("[tournaments] Laden von doca.at fehlgeschlagen, starte leer:", (err as Error).message);
    records = [];
  }
}

async function persist(): Promise<void> {
  if (!STORE_URL || !SECRET) return;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(STORE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webdarts-key": SECRET },
      body: JSON.stringify(records),
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error("HTTP " + res.status);
  } catch (err) {
    console.warn("[tournaments] Speichern auf doca.at fehlgeschlagen:", (err as Error).message);
  }
}

export async function listTournaments(): Promise<TournamentSummary[]> {
  await load();
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    threeKEventId: r.threeKEventId,
    hasProfile: r.profile !== null,
    isDouble: r.isDouble ?? false,
    published: r.published ?? true,
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
  const isDouble = info.eventKindCd === "DOUBLE";
  const rec: TournamentRecord = {
    id: genId(),
    name: (name?.trim() || info.name || `Turnier ${threeKEventId}`).slice(0, 60),
    threeKEventId,
    isDouble,
    profile: null,
    published: false,
    createdBy,
    createdAt: Date.now(),
  };
  records.push(rec);
  await persist();
  return {
    id: rec.id,
    name: rec.name,
    threeKEventId: rec.threeKEventId,
    hasProfile: false,
    isDouble,
    published: false,
  };
}

/** Entfernt die Verknüpfung wieder - rein lokal bei uns, rührt 3K nicht an
 *  (wir haben da nie etwas angelegt, nur gelesen/verlinkt). */
export async function removeTournament(id: string): Promise<void> {
  await load();
  const before = records.length;
  records = records.filter((r) => r.id !== id);
  if (records.length === before) throw new Error("Turnier nicht gefunden.");
  await persist();
}

export async function setTournamentProfile(id: string, profile: MatchConfig): Promise<void> {
  await load();
  const rec = records.find((r) => r.id === id);
  if (!rec) throw new Error("Turnier nicht gefunden.");
  rec.profile = profile;
  await persist();
}

export async function setTournamentPublished(id: string, published: boolean): Promise<void> {
  await load();
  const rec = records.find((r) => r.id === id);
  if (!rec) throw new Error("Turnier nicht gefunden.");
  rec.published = published;
  await persist();
}

/** Admin ordnet einem 3K-Namen (Team oder Einzel) manuell ein DOCA-Mitglied zu –
 *  Fallback für Namen, die matchSingle/matchDoubleTeam nicht eindeutig auflösen konnten.
 *  uid = null setzt den Slot zurück auf automatische Zuordnung. */
export async function setPlayerOverride(
  id: string,
  participantName: string,
  slot: 0 | 1,
  uid: string | null,
): Promise<void> {
  await load();
  const rec = records.find((r) => r.id === id);
  if (!rec) throw new Error("Turnier nicht gefunden.");
  if (!rec.overrides) rec.overrides = {};
  const cur = rec.overrides[participantName] ?? [null, null];
  cur[slot] = uid;
  rec.overrides[participantName] = cur;
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
  const isDouble = info.eventKindCd === "DOUBLE";
  if (rec.isDouble !== isDouble) {
    rec.isDouble = isDouble; // Selbstheilung für Turniere, die vor diesem Feld angelegt wurden
    await persist();
  }
  const phase = info.phases[0];
  if (!phase) {
    return {
      id: rec.id,
      name: rec.name,
      threeKEventId: rec.threeKEventId,
      hasProfile: rec.profile !== null,
      isDouble,
      published: rec.published ?? true,
      profile: rec.profile,
      rounds: [],
      participants: [],
    };
  }
  const rounds = await fetchPhaseRounds(rec.threeKEventId, phase.id);
  const members = await getMemberDirectory();
  const overrides = rec.overrides ?? {};
  const participants = new ParticipantCollector();

  const outRounds: { name: string; pairings: TournamentPairing[] }[] = [];
  for (const round of rounds) {
    const matches = await fetchRoundMatches(rec.threeKEventId, phase.id, round.id);
    const pairings: TournamentPairing[] = matches.map((m) => {
      const { homeUid, homeUid2, awayUid, awayUid2 } = resolveTeams(
        m.participantHomeName,
        m.participantAwayName,
        isDouble,
        members,
        overrides,
      );
      const [homeName1, homeName2] = displayNamePart(m.participantHomeName, isDouble);
      const [awayName1, awayName2] = displayNamePart(m.participantAwayName, isDouble);
      participants.add(homeUid, homeName1, members);
      participants.add(awayUid, awayName1, members);
      if (isDouble) {
        participants.add(homeUid2, homeName2, members);
        participants.add(awayUid2, awayName2, members);
      }
      const iAmHome = myUid !== null && (myUid === homeUid || myUid === homeUid2);
      const isMine = iAmHome || (myUid !== null && (myUid === awayUid || myUid === awayUid2));
      const resolved = isDouble
        ? Boolean(homeUid && homeUid2 && awayUid && awayUid2)
        : Boolean(homeUid && awayUid);
      return {
        matchId: m.id,
        roundName: round.name,
        homeName: m.participantHomeName,
        awayName: m.participantAwayName,
        homeUid,
        awayUid,
        homeUid2,
        awayUid2,
        resolved,
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
    isDouble,
    published: rec.published ?? true,
    profile: rec.profile,
    rounds: outRounds,
    participants: participants.list(),
  };
}

/** Für tournament:startMatch – Profil + Heim/Gast einer einzelnen Paarung auflösen. */
export async function resolvePairing(
  id: string,
  matchId: number,
): Promise<{
  profile: MatchConfig;
  isDouble: boolean;
  published: boolean;
  homeUid: string | null;
  homeUid2: string | null;
  awayUid: string | null;
  awayUid2: string | null;
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
  const overrides = rec.overrides ?? {};
  const rounds = await fetchPhaseRounds(rec.threeKEventId, phase.id);
  for (const round of rounds) {
    const matches = await fetchRoundMatches(rec.threeKEventId, phase.id, round.id);
    const hit = matches.find((m) => m.id === matchId);
    if (!hit) continue;
    const { homeUid, homeUid2, awayUid, awayUid2 } = resolveTeams(
      hit.participantHomeName,
      hit.participantAwayName,
      isDouble,
      members,
      overrides,
    );
    return {
      profile: rec.profile,
      isDouble,
      published: rec.published ?? true,
      homeUid,
      homeUid2,
      awayUid,
      awayUid2,
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
  homeUid2: string | null;
  awayUid: string;
  awayUid2: string | null;
}
const matchRoom = new Map<string, MatchRoomEntry>(); // "tournamentId:matchId" -> ...
/** Rückrichtung fürs Ergebnis-Zurückschreiben: roomId -> 3K-matchId. */
const roomToMatchId = new Map<string, number>();

export function getMatchRoom(tournamentId: string, matchId: number): MatchRoomEntry | undefined {
  return matchRoom.get(`${tournamentId}:${matchId}`);
}
export function setMatchRoom(tournamentId: string, matchId: number, entry: MatchRoomEntry): void {
  matchRoom.set(`${tournamentId}:${matchId}`, entry);
  roomToMatchId.set(entry.roomId, matchId);
}
/** Ist dieser Raum ein Turnier-Match? Wenn ja: die 3K-matchId dazu. */
export function getMatchIdForRoom(roomId: string): number | undefined {
  return roomToMatchId.get(roomId);
}
