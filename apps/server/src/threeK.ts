/**
 * Direkter, lesender Zugriff auf die öffentlichen 3K-Frontend-API-Daten für
 * die Turnier-Anbindung (Spielplan/Paarungen). Render erreicht
 * backend3.3k-darts.com direkt (doca.at selbst nicht, siehe /2k/-Proxy in
 * index.ts) – hier also ohne Umweg. Nur Lesepfade, kurzer Cache gegen
 * wiederholte Abrufe derselben Turnierseite.
 */

const BASE = "https://backend3.3k-darts.com/2k-backend3/api/v1/frontend/";
const TTL = 60_000;

interface CacheEntry {
  ts: number;
  data: unknown;
}
const cache = new Map<string, CacheEntry>();

async function get(path: string): Promise<unknown> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(BASE + path, {
      signal: ac.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Origin: "https://portal.3k-darts.com",
        Referer: "https://portal.3k-darts.com/",
      },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    cache.set(path, { ts: Date.now(), data });
    if (cache.size > 300) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export interface ThreeKPhaseRef {
  id: number;
  index: number;
  name: string;
}

export interface ThreeKEventInfo {
  id: number;
  name: string;
  eventKindCd: "SINGLE" | "DOUBLE" | string;
  phases: ThreeKPhaseRef[];
}

export async function fetchEventInfo(eventId: number): Promise<ThreeKEventInfo> {
  const data = (await get(`event/${eventId}`)) as {
    event: { id: number; name: string; eventKindCd: string };
    phases: { id: number; index: number; name: string }[];
  };
  return {
    id: data.event.id,
    name: data.event.name,
    eventKindCd: data.event.eventKindCd,
    phases: data.phases.map((p) => ({ id: p.id, index: p.index, name: p.name })),
  };
}

export interface ThreeKRoundRef {
  id: number;
  index: number;
  name: string;
}

export async function fetchPhaseRounds(eventId: number, phaseId: number): Promise<ThreeKRoundRef[]> {
  const data = (await get(`event/${eventId}/phase/${phaseId}`)) as {
    rounds: { id: number; index: number; name: string }[];
  };
  return data.rounds.map((r) => ({ id: r.id, index: r.index, name: r.name }));
}

export interface ThreeKMatch {
  id: number;
  gameNr: number;
  statusCd: string; // "OPEN" | "FINISH" | ...
  participantHomeName: string;
  participantAwayName: string;
  /** 3K-participantId (Team bei Doppel, Einzelperson bei Einzel) - deckt sich
   *  mit `players[].participantId` aus fetchPerformanceRequirements(). */
  participantHomeId: number | null;
  participantAwayId: number | null;
  legsHome: number | null;
  legsAway: number | null;
}

/** roundId muss die `id` aus fetchPhaseRounds sein, NICHT der `index` – der
 * Endpoint indiziert nicht nach Reihenfolge, sondern nach Round-Id (bei
 * GROUP-Phasen ist jede Gruppe eine eigene "round"). Mit dem index landen
 * z.B. bei einer 2-Gruppen-Phase alle Spiele unter "round/0" und
 * "round/1" liefert leer. */
export async function fetchRoundMatches(
  eventId: number,
  phaseId: number,
  roundId: number,
): Promise<ThreeKMatch[]> {
  const data = (await get(`event/${eventId}/phase/${phaseId}/round/${roundId}`)) as {
    matches: {
      id: number;
      gameNr: number;
      statusCd: string;
      participantHome?: { id: number; displayName: string };
      participantGuest?: { id: number; displayName: string };
      legsHome?: number;
      legsAway?: number;
    }[];
  };
  return data.matches.map((m) => ({
    id: m.id,
    gameNr: m.gameNr,
    statusCd: m.statusCd,
    participantHomeName: m.participantHome?.displayName ?? "?",
    participantAwayName: m.participantGuest?.displayName ?? "?",
    participantHomeId: m.participantHome?.id ?? null,
    participantAwayId: m.participantGuest?.id ?? null,
    legsHome: typeof m.legsHome === "number" ? m.legsHome : null,
    legsAway: typeof m.legsAway === "number" ? m.legsAway : null,
  }));
}
