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
  /** Aus einer Turnier-Paarung erzeugt: Format + Teamnamen kommen vom Admin-Matchprofil
   *  und dürfen von den Spielern (noch) nicht geändert werden. */
  tournamentLocked: boolean;
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
// Turniere (3K-Anbindung, „DL-Copilot"-Ersatz)
// ---------------------------------------------------------------------------

/** Ein an Webdarts angebundenes 3K-Turnier/Liga. */
export interface TournamentSummary {
  id: string;
  name: string;
  threeKEventId: number;
  /** Match-Format, das beim Start einer Paarung vorbefüllt wird. Noch nicht gesetzt = null. */
  hasProfile: boolean;
  /** 3K eventKindCd === "DOUBLE" – bestimmt teamSize im Matchprofil und Spieler-Auflösung. */
  isDouble: boolean;
  /** Solange false (Standard beim Anlegen): nur der Admin sieht/öffnet das Turnier,
   *  Mitglieder sehen es nicht in der Liste und können es nicht direkt aufrufen. */
  published: boolean;
  /** Anzahl offener, mir zugeordneter Paarungen – Hinweis-Badge im Hub, damit man
   *  nicht vergisst, dass man dran wäre. */
  openForMe: number;
}

/** Eine einzelne Paarung aus dem 3K-Spielplan, aus Sicht des anfragenden Mitglieds. */
export interface TournamentPairing {
  matchId: number;
  roundName: string;
  /** 3K-Runden-ID – Schlüssel für ein rundenspezifisches Matchprofil. */
  roundId: number;
  /** Name der übergeordneten 3K-Phase, z.B. "Gruppe" oder "KO" (Turnierbaum). */
  phaseName: string;
  homeName: string;
  awayName: string;
  /** Aufgelöste Webdarts-Identität ("u:<uid>") oder null, wenn (noch) nicht zuordenbar. */
  homeUid: string | null;
  awayUid: string | null;
  /** Zweiter Spieler des Heim-/Gast-Teams bei Doppel-Events; bei Einzel immer null. */
  homeUid2: string | null;
  awayUid2: string | null;
  /** true, wenn alle für diese Paarung nötigen Spieler automatisch zugeordnet werden konnten. */
  resolved: boolean;
  /** "live" = wird gerade über Webdarts gespielt (eigener, nicht von 3K
   *  gelieferter Status – erkannt an einem laufenden Match-Raum). */
  status: "open" | "live" | "finished";
  legsHome: number | null;
  legsAway: number | null;
  /** Bin ich (Heim oder Gast, bzw. bei Doppel: Teil eines der beiden Teams) an dieser Paarung beteiligt? */
  isMine: boolean;
  /** Bin ich im Heim-Team? Nur das Heim-Team darf die Paarung starten (Hin-/Rückspiel-Zuordnung bei 3K). */
  iAmHome: boolean;
  /** Fortlaufende 3K-Spielnummer über das ganze Event - Baum-Verknüpfung
   *  (siehe homeSourceGameNr/awaySourceGameNr) zeigt darauf. */
  gameNr: number;
  /** true, wenn diese Seite ein Freilos hat (kein Gegner in dieser Runde). */
  byeHome: boolean;
  byeAway: boolean;
  /** Solange homeUid/awayUid noch nicht feststehen (Platzhalter-Slot im
   *  Baum): Verweis auf das Vorgänger-Spiel per gameNr + ob der/die Sieger(in)
   *  oder Verlierer(in) davon hier einzieht (KO->KO), oder ein Klartext-Platz
   *  aus der Gruppenphase (z.B. "1. Gruppe 1", GROUP->KO). Beides kann fehlen
   *  (erste Runde ohne Vorgänger). */
  homeSourceGameNr: number | null;
  homeSourceWinner: boolean | null;
  homeSourceName: string | null;
  awaySourceGameNr: number | null;
  awaySourceWinner: boolean | null;
  awaySourceName: string | null;
}

/** Ein einzelner Spieler des Turniers (bei Doppel: aus dem Team-Namen aufgelöst,
 *  nicht das Team selbst) – für die Anwesenheitsliste in der Turnier-Lobby. */
export interface TournamentParticipant {
  /** Aufgelöste Webdarts-Identität, oder null wenn (noch) nicht automatisch/manuell
   *  zuordenbar – dann nur Anzeige, kein Online-Status möglich. */
  uid: string | null;
  name: string;
}

export interface TournamentDetail extends TournamentSummary {
  /** Standard-Matchprofil – greift für jede Runde ohne eigenes Profil. */
  profile: MatchConfig | null;
  rounds: {
    name: string;
    roundId: number;
    phaseName: string;
    /** Effektives Profil dieser Runde: rundenspezifisch, sonst der Standard. */
    profile: MatchConfig | null;
    /** true, wenn eigens für diese Runde gesetzt (nicht vom Standard geerbt). */
    hasOwnProfile: boolean;
    /** "GROUP" (Gruppenphase) oder "KO" (Turnierbaum-Runde) - für die
     *  Baum-Darstellung: nur KO-Runden werden dort gezeichnet. */
    typeCd: string;
    /** Nur bei KO: "WINNER_BRACKET"/"LOSER_BRACKET" (Doppel-K.O., zwei
     *  Baumhälften) oder null (einfacher K.O., eine Hälfte / Platzierungsspiel
     *  wie "Spiel um Platz 3"). */
    groupCd: string | null;
    /** Reihenfolge innerhalb der Phase (0-basiert) - für die Baum-Spalten,
     *  falls Runden aus mehreren Baumhälften nicht schon sortiert ankommen. */
    index: number;
    pairings: TournamentPairing[];
  }[];
  /** Eindeutige Spielerliste über alle Paarungen (dedupliziert) - Online-Status
   *  wird clientseitig gegen HubState.users abgeglichen, kein eigener Live-Push nötig. */
  participants: TournamentParticipant[];
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
  /** LiveKit-Token für den globalen Hub-Sprachkanal (alle Online). */
  "livekit:hubToken": (
    payload: Record<string, never>,
    ack: (res: AckResult<{ token: string; url: string } | { disabled: true }>) => void,
  ) => void;
  /** LiveKit-Token für den Sprachkanal einer Turnier-Lobby – eigener Kanal pro
   *  Turnier, getrennt vom Hub- und von Raum-Kanälen. */
  "livekit:tournamentToken": (
    payload: { tournamentId: string },
    ack: (res: AckResult<{ token: string; url: string } | { disabled: true }>) => void,
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

  /** Liste aller angebundenen Turniere (für alle sichtbar). */
  "tournaments:list": (
    payload: Record<string, never>,
    ack: (res: AckResult<TournamentSummary[]>) => void,
  ) => void;
  /** Turnier + Spielplan + eigene Paarungen. */
  "tournament:detail": (
    payload: { id: string },
    ack: (res: AckResult<TournamentDetail>) => void,
  ) => void;
  /** Neues 3K-Turnier verknüpfen (nur Admin). */
  "tournament:add": (
    payload: { threeKEventId: number; name?: string },
    ack: (res: AckResult<TournamentSummary>) => void,
  ) => void;
  /** Standard-Match-Profil (Format) für ein Turnier festlegen (nur Admin). */
  "tournament:setProfile": (
    payload: { id: string; profile: MatchConfig },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Match-Profil für eine EINZELNE Runde festlegen, z.B. Achtelfinale mit
   *  anderer Distanz als die Gruppenphase (nur Admin). `profile: null` löscht
   *  die rundenspezifische Einstellung wieder – die Runde nutzt dann den
   *  Turnier-Standard. */
  "tournament:setRoundProfile": (
    payload: { id: string; roundId: number; profile: MatchConfig | null },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Turnier für Teilnehmer sichtbar/aufrufbar machen oder wieder zurückziehen (nur Admin). */
  "tournament:setPublished": (
    payload: { id: string; published: boolean },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Verknüpfung wieder entfernen (nur Admin) – nur lokal bei uns, rührt 3K nicht an. */
  "tournament:remove": (
    payload: { id: string },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Paarung starten: legt bei Bedarf einen vorbefüllten Raum an (oder tritt dem schon
   *  laufenden bei) und setzt mich auf meinen Platz (Heim/Gast). */
  "tournament:startMatch": (
    payload: { id: string; matchId: number },
    ack: (res: AckResult<{ roomId: string }>) => void,
  ) => void;
  /** Manuelle Zuordnung eines 3K-Namens zu einem DOCA-Mitglied (nur Admin) – Fallback,
   *  wenn der automatische Nachnamen-Abgleich 0 oder >1 Treffer ergab. `participantName`
   *  ist der rohe 3K-Anzeigename (Team oder Einzel), `slot` 0/1 bei Doppel (Reihenfolge
   *  wie im Namen), bei Einzel immer 0. `uid` = null setzt zurück auf automatisch. */
  "tournament:setPlayerOverride": (
    payload: { id: string; participantName: string; slot: 0 | 1; uid: string | null },
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** In den Chat-Kanal der Turnier-Lobby wechseln (löst automatisch aus dem
   *  vorherigen, falls man in einem anderen Turnier war) – nötig, um
   *  tournament:chatState-Updates zu bekommen; schickt die Historie sofort zurück. */
  "tournament:enterLobby": (
    payload: { id: string },
    ack: (res: AckResult<{ chat: ChatMessage[] }>) => void,
  ) => void;
  /** Turnier-Lobby-Chat-Kanal verlassen (beim Zurück-Navigieren). */
  "tournament:leaveLobby": (payload: { id: string }, ack: (res: AckResult<null>) => void) => void;
  "tournament:chat": (
    payload: { id: string; text: string },
    ack: (res: AckResult<null>) => void,
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
  /** Neuer Chat-Stand der Turnier-Lobby, an alle, die dort gerade eingecheckt sind. */
  "tournament:chatState": (payload: { id: string; chat: ChatMessage[] }) => void;
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
    legsCap: 0,
    teamSize: 2,
  };
}
