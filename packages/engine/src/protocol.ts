/**
 * Netzwerk-Protokoll zwischen Web-Client und Server (Socket.IO).
 *
 * Zwei Ebenen:
 *  1. Hub  – eine globale Lobby: wer ist online, globaler Chat, Liste offener Räume.
 *  2. Raum – ein konkreter Tisch: Sitzplätze, Konfiguration, laufendes Match.
 *
 * Der Server hält pro Raum den autoritativen Match-Zustand. Clients schicken
 * Aktionen, der Server rechnet sie mit der Engine nach und verteilt neue Zustände.
 */

import type { GameMode, MatchAction, MatchConfig, MatchState } from "./types";

// ---------------------------------------------------------------------------
// Hub (globale Lobby)
// ---------------------------------------------------------------------------

/** Karriere-Grundwerte eines Spielers (für die Hover-Blase in der Online-Liste). */
export interface PlayerCareer {
  /** Gewertete Matches. */
  matches: number;
  /** Insgesamt mitgewonnene Legs. */
  legsWon: number;
  /** 3-Dart-Average über alle gewerteten X01-Legs. */
  average: number;
  /** Doppelquote in Prozent. */
  checkoutPct: number;
  /** Höchstes Finish. */
  highestFinish: number;
  /** Wenigste Darts in einem gewonnenen Leg (oder null). */
  shortestLegDarts: number | null;
}

export interface HubUser {
  id: string;
  name: string;
  /** Profilbild-URL des Mitglieds; leer = keins. */
  image: string | null;
  /** In welchem Raum steckt der User gerade? null = in der Lobby. */
  roomId: string | null;
  /** Karriere-Grundwerte, sobald mindestens ein Match gewertet wurde. */
  stats: PlayerCareer | null;
}

export interface HubRoomSummary {
  roomId: string;
  /** Optionaler Raumname; leer = kein Name gesetzt. */
  name: string;
  hostName: string;
  mode: GameMode;
  teamSize: 1 | 2;
  seatsFilled: number;
  seatsTotal: number;
  spectators: number;
  phase: RoomPhase;
  hasBot: boolean;
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  kind: "user" | "system";
  /** Nur im Raum-Chat: Rolle des Absenders. */
  role?: "player" | "spectator";
}

export interface HubState {
  users: HubUser[];
  rooms: HubRoomSummary[];
  chat: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Raum
// ---------------------------------------------------------------------------

export interface Seat {
  /** Stabiler Platz-Schlüssel, z.B. "t0p1". */
  key: string;
  teamIndex: number;
  indexInTeam: number;
  /** Wer steuert diesen Platz (Gerät/Mitglied). Bei "lokal" ist das für den Partner der Betreiber von Platz 1. */
  occupantId: string | null;
  /** Identität dieses Spielers im Match (für Wurfreihenfolge & Statistik). Bei normalen Plätzen = occupantId. */
  playerId: string | null;
  playerName: string | null;
  /** Profilbild-URL (Mitglied / PDC-Star / Bot); leer = keins. */
  playerImage: string | null;
  connected: boolean;
  /** true, wenn dieser Platz der lokale Partner ist (kein eigenes Gerät, teilt Kamera mit Platz 1). */
  isLocalPartner: boolean;
}

export interface SpectatorInfo {
  id: string;
  name: string;
  connected: boolean;
}

export type RoomPhase = "lobby" | "match";

/** Pausenzustand: manuell angehalten und/oder Spieler offline. */
export interface PauseInfo {
  /** Wurde manuell pausiert (WC, Telefon …)? */
  manual: boolean;
  /** Name der Person, die manuell pausiert hat (oder null). */
  byName: string | null;
  /** Zeitstempel, seit wann pausiert wird. */
  since: number;
  /** Namen der Spieler, auf deren Rückkehr gewartet wird. */
  waitingFor: string[];
}

/** Konfiguration eines Bot-Gegners (bei nur 3 Spielern). */
export interface BotConfig {
  /** Ziel-3-Dart-Average (Skill-Regler). */
  average: number;
  /** Anzeigename, z.B. „Luke Humphries" oder „Halbprofi". */
  name: string;
  /** Optionales Bild (Pfad relativ zur Web-App), z.B. für PDC-Stars. */
  image: string | null;
}

/** Laufendes Revanche-Angebot nach einem beendeten Match. */
export interface RematchState {
  offeredBy: string;
  offeredByName: string;
  /** Spieler-IDs, deren Zustimmung nötig ist (die gegnerische Seite). */
  needed: string[];
  /** Bereits zugestimmte Spieler-IDs. */
  accepted: string[];
}

export interface RoomState {
  roomId: string;
  /** Optionaler Raumname; leer = kein Name gesetzt. */
  name: string;
  hostId: string;
  phase: RoomPhase;
  config: MatchConfig;
  teamNames: [string, string];
  /** Länge 2 (Einzel) oder 4 (Doppel). */
  seats: Seat[];
  spectators: SpectatorInfo[];
  match: MatchState | null;
  /** Revanche-Angebot, wenn das Match beendet ist. */
  rematch: RematchState | null;
  /** Pause (manuell oder wegen Verbindungsabbruch), sonst null. */
  pause: PauseInfo | null;
  /** Bot-Gegner, falls beim Raum-Erstellen gewählt. `seatKey` = wo er sitzt. */
  bot: (BotConfig & { seatKey: string | null }) | null;
  /** Pro Team: "Beide an einem Board" (1 Kamera, Platz-1-Betreiber führt auch Platz 2). */
  localTeams: [boolean, boolean];
  /** Ist auf dem Server ein LiveKit-Key hinterlegt? Sonst läuft alles ohne Video. */
  videoEnabled: boolean;
  /** LiveKit-Raumname (= roomId) für die Client-SDK. */
  livekitRoom: string;
  /** Text-Chat des Raums (Spieler + Zuschauer), neueste zuletzt. */
  chat: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  /**
   * In die globale Lobby einchecken. `cid` ist eine im Browser gespeicherte,
   * stabile Client-ID – dadurch behält man Sitzplatz & Raum nach Reload/Abbruch.
   */
  "hub:join": (
    payload: { name: string; cid: string; token?: string },
    ack: (res: AckResult<null>) => void,
  ) => void;
  "hub:chat": (payload: { text: string }, ack: (res: AckResult<null>) => void) => void;
  "room:chat": (
    payload: { roomId: string; text: string },
    ack: (res: AckResult<null>) => void,
  ) => void;

  "room:create": (
    payload: {
      name?: string;
      config: MatchConfig;
      teamNames: [string, string];
      bot?: BotConfig | null;
    },
    ack: (res: AckResult<{ roomId: string }>) => void,
  ) => void;
  /** Bot auf einen freien Platz setzen (seatKey) oder wieder entfernen (null). */
  "room:placeBot": (
    payload: { roomId: string; seatKey: string | null },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Für ein Team "Beide an einem Board" ein-/ausschalten (nur Lobby). */
  "room:setLocalTeam": (
    payload: { roomId: string; teamIndex: number; local: boolean },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Partner auf Platz 2 eines "lokalen" Teams eintragen/ändern/entfernen (leerer Name = entfernen). */
  "room:setPartner": (
    payload: {
      roomId: string;
      teamIndex: number;
      name: string;
      memberId?: string | null;
      image?: string | null;
    },
    ack: (res: AckResult<null>) => void,
  ) => void;
  "room:enter": (
    payload: { roomId: string },
    ack: (res: AckResult<{ roomId: string }>) => void,
  ) => void;
  "room:leave": (payload: { roomId: string }, ack: (res: AckResult<null>) => void) => void;

  "room:takeSeat": (
    payload: { roomId: string; seatKey: string | null },
    ack: (res: AckResult<null>) => void,
  ) => void;
  "room:updateConfig": (
    payload: { roomId: string; config: MatchConfig; teamNames: [string, string] },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Teamname setzen – erlaubt für Host und Spieler 1 (Kapitän) des Teams. */
  "room:setTeamName": (
    payload: { roomId: string; teamIndex: number; name: string },
    ack: (res: AckResult<null>) => void,
  ) => void;

  "match:start": (payload: { roomId: string }, ack: (res: AckResult<null>) => void) => void;
  "match:reset": (payload: { roomId: string }, ack: (res: AckResult<null>) => void) => void;
  "match:pause": (payload: { roomId: string }, ack: (res: AckResult<null>) => void) => void;
  "match:resume": (payload: { roomId: string }, ack: (res: AckResult<null>) => void) => void;
  "match:rematchOffer": (payload: { roomId: string }, ack: (res: AckResult<null>) => void) => void;
  "match:rematchRespond": (
    payload: { roomId: string; accept: boolean },
    ack: (res: AckResult<null>) => void,
  ) => void;
  "match:action": (
    payload:
      | { roomId: string; kind: "dispatch"; action: MatchAction }
      | { roomId: string; kind: "undo" },
    ack: (res: AckResult<null>) => void,
  ) => void;

  "livekit:token": (
    payload: { roomId: string },
    ack: (res: AckResult<{ token: string; url: string } | { disabled: true }>) => void,
  ) => void;
}

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  "hub:state": (state: HubState) => void;
  "room:state": (state: RoomState) => void;
  "room:closed": (payload: { reason: string }) => void;
  "server:error": (payload: { message: string }) => void;
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

export type AckResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function seatKey(teamIndex: number, indexInTeam: number): string {
  return `t${teamIndex}p${indexInTeam}`;
}

/** Standard-Konfiguration für ein Doppel-501-Match. */
export function defaultConfig(): MatchConfig {
  return {
    mode: "x01",
    x01: { startScore: 501, out: "double", in: "straight" },
    cricket: { variant: "standard" },
    legsToWinSet: 3,
    setsToWin: 1,
    bullOff: true,
    twoClearLegs: false,
    legBulloffRounds: 0,
    teamSize: 2,
  };
}
