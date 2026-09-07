/**
 * Raum-Verwaltung. Pro Raum: Lobby-Zustand + autoritativer Match-Controller.
 */

import { customAlphabet } from "nanoid";
import {
  MatchController,
  botBullOff,
  botCricketVisit,
  botX01Visit,
  createMatch,
  currentThrower,
  matchStats,
  nextBullOffTeam,
  seatKey,
  type BotConfig,
  type CricketLegState,
  type HubRoomSummary,
  type MatchAction,
  type MatchConfig,
  type PauseInfo,
  type Player,
  type RematchState,
  type RoomState,
  type Seat,
  type SpectatorInfo,
  type Team,
  type X01LegState,
} from "@webdarts/engine";
import { videoEnabled } from "./livekit.js";

const BOT_ID = "bot:1";

const genRoomId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

interface Member {
  id: string;
  name: string;
  image: string | null;
  connected: boolean;
}

export class Room {
  readonly roomId = genRoomId();
  name: string;
  hostId: string;
  config: MatchConfig;
  teamNames: [string, string];
  phase: "lobby" | "match" = "lobby";

  private members = new Map<string, Member>();
  private seatAssignments = new Map<string, string>();
  private controller: MatchController | null = null;
  private rematch: RematchState | null = null;
  /** Manuelle Pause (WC / Telefon). */
  private manualPause: { byId: string; byName: string; since: number } | null = null;
  /** cid -> Zeitpunkt des Verbindungsverlusts (seated + offline). */
  private offlineSeats = new Map<string, number>();
  /** true, sobald das Endergebnis dieses Matches archiviert wurde. */
  private resultWritten = false;
  /** Bot-Gegner (bei nur 3 Spielern), beim Raum-Erstellen gewählt. */
  private bot: BotConfig | null = null;

  constructor(
    hostId: string,
    hostName: string,
    config: MatchConfig,
    teamNames: [string, string],
    name = "",
    bot: BotConfig | null = null,
    hostImage: string | null = null,
  ) {
    this.name = name.trim().slice(0, 40);
    this.hostId = hostId;
    this.config = config;
    this.teamNames = teamNames;
    this.bot = bot
      ? {
          average: Math.max(10, Math.min(120, Math.round(bot.average))),
          name: String(bot.name ?? "Bot").trim().slice(0, 24) || "Bot",
          image: bot.image ? String(bot.image).slice(0, 300) : null,
        }
      : null;
    this.members.set(hostId, { id: hostId, name: hostName, image: hostImage, connected: true });
  }

  private get seatCount(): number {
    return this.config.teamSize === 1 ? 2 : 4;
  }

  // --- Mitglieder ---------------------------------------------------------

  addMember(id: string, name: string, image: string | null = null) {
    const existing = this.members.get(id);
    if (existing) {
      existing.connected = true;
      if (name) existing.name = name;
      if (image !== null) existing.image = image;
    } else {
      this.members.set(id, { id, name, image, connected: true });
    }
  }

  setConnected(id: string, connected: boolean) {
    const m = this.members.get(id);
    if (m) m.connected = connected;
    const seated = this.isSeated(id);
    if (!connected && seated && this.phase === "match") {
      if (!this.offlineSeats.has(id)) this.offlineSeats.set(id, Date.now());
    } else if (connected) {
      this.offlineSeats.delete(id);
    }
  }

  removeMember(id: string) {
    this.members.delete(id);
    this.offlineSeats.delete(id);
    for (const [sk, mid] of this.seatAssignments) {
      if (mid === id) this.seatAssignments.delete(sk);
    }
    this.rematch = null; // Aufstellung hat sich geändert
    if (this.manualPause?.byId === id) {
      // Pausierer ist weg – Pause bleibt, kann von jedem aufgehoben werden
      this.manualPause = { ...this.manualPause, byId: "", byName: this.manualPause.byName };
    }
    if (id === this.hostId) {
      const next = [...this.members.values()][0];
      if (next) this.hostId = next.id;
    }
  }

  // --- Pause ----------------------------------------------------------

  get isPaused(): boolean {
    return this.manualPause !== null || this.offlineSeats.size > 0;
  }

  pause(memberId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== "match") return { ok: false, error: "Kein laufendes Spiel." };
    if (!this.isSeated(memberId)) return { ok: false, error: "Nur Spieler am Tisch dürfen pausieren." };
    if (this.manualPause) return { ok: true };
    this.manualPause = {
      byId: memberId,
      byName: this.members.get(memberId)?.name ?? "?",
      since: Date.now(),
    };
    return { ok: true };
  }

  resume(memberId: string): { ok: true } | { ok: false; error: string } {
    if (!this.isSeated(memberId)) return { ok: false, error: "Nur Spieler am Tisch dürfen fortsetzen." };
    this.manualPause = null;
    return { ok: true };
  }

  private pauseInfo(): PauseInfo | null {
    if (!this.isPaused) return null;
    const offlineTimes = [...this.offlineSeats.values()];
    const since = Math.min(
      this.manualPause?.since ?? Number.POSITIVE_INFINITY,
      ...(offlineTimes.length ? offlineTimes : [Number.POSITIVE_INFINITY]),
    );
    return {
      manual: this.manualPause !== null,
      byName: this.manualPause?.byName ?? null,
      since: Number.isFinite(since) ? since : Date.now(),
      waitingFor: [...this.offlineSeats.keys()].map((cid) => this.members.get(cid)?.name ?? "Spieler"),
    };
  }

  get isEmpty(): boolean {
    return this.members.size === 0;
  }

  get memberCount(): number {
    return this.members.size;
  }

  hasMember(id: string): boolean {
    return this.members.has(id);
  }

  // --- Sitzplätze -------------------------------------------------------

  private buildSeats(): Seat[] {
    const seats: Seat[] = [];
    const perTeam = this.seatCount / 2;
    for (let t = 0; t < 2; t++) {
      for (let p = 0; p < perTeam; p++) {
        const key = seatKey(t, p);
        const mid = this.seatAssignments.get(key) ?? null;
        const isBot = mid === BOT_ID;
        const member = mid && !isBot ? this.members.get(mid) : null;
        seats.push({
          key,
          teamIndex: t,
          indexInTeam: p,
          occupantId: mid,
          playerName: isBot ? (this.bot?.name ?? "Bot") : (member?.name ?? null),
          playerImage: isBot ? (this.bot?.image ?? null) : (member?.image ?? null),
          connected: isBot ? true : (member?.connected ?? false),
        });
      }
    }
    return seats;
  }

  private botSeatKey(): string | null {
    for (const [sk, mid] of this.seatAssignments) if (mid === BOT_ID) return sk;
    return null;
  }

  /** Bot auf einen Platz setzen / entfernen (nur Host, nur Lobby). */
  placeBot(memberId: string, targetKey: string | null): { ok: true } | { ok: false; error: string } {
    if (memberId !== this.hostId) return { ok: false, error: "Nur der Host darf den Bot setzen." };
    if (this.phase === "match") return { ok: false, error: "Spiel läuft bereits." };
    if (!this.bot) return { ok: false, error: "Für diesen Raum ist kein Bot vorgesehen." };
    for (const [sk, mid] of [...this.seatAssignments]) {
      if (mid === BOT_ID) this.seatAssignments.delete(sk);
    }
    if (targetKey === null) return { ok: true };
    if (!this.buildSeats().some((s) => s.key === targetKey)) {
      return { ok: false, error: "Ungültiger Platz." };
    }
    if (this.seatAssignments.has(targetKey)) return { ok: false, error: "Platz ist belegt." };
    this.seatAssignments.set(targetKey, BOT_ID);
    return { ok: true };
  }

  takeSeat(memberId: string, targetKey: string | null): { ok: true } | { ok: false; error: string } {
    if (this.phase === "match") return { ok: false, error: "Spiel läuft bereits." };
    for (const [sk, mid] of this.seatAssignments) {
      if (mid === memberId) this.seatAssignments.delete(sk);
    }
    if (targetKey === null) return { ok: true };
    const valid = this.buildSeats().some((s) => s.key === targetKey);
    if (!valid) return { ok: false, error: "Ungültiger Platz." };
    if (this.seatAssignments.has(targetKey)) return { ok: false, error: "Platz ist belegt." };
    this.seatAssignments.set(targetKey, memberId);
    return { ok: true };
  }

  // --- Konfiguration -------------------------------------------------

  updateConfig(memberId: string, config: MatchConfig, teamNames: [string, string]) {
    if (memberId !== this.hostId) return { ok: false as const, error: "Nur der Host darf das ändern." };
    if (this.phase === "match") return { ok: false as const, error: "Spiel läuft bereits." };
    this.config = config;
    this.teamNames = teamNames;
    const valid = new Set(this.buildSeats().map((s) => s.key));
    for (const sk of [...this.seatAssignments.keys()]) {
      if (!valid.has(sk)) this.seatAssignments.delete(sk);
    }
    return { ok: true as const };
  }

  setTeamName(memberId: string, teamIndex: number, name: string): { ok: true } | { ok: false; error: string } {
    if (this.phase === "match") return { ok: false, error: "Spiel läuft bereits." };
    if (teamIndex !== 0 && teamIndex !== 1) return { ok: false, error: "Ungültiges Team." };
    const isCaptain = this.seatAssignments.get(seatKey(teamIndex, 0)) === memberId;
    if (memberId !== this.hostId && !isCaptain) {
      return { ok: false, error: "Nur Spieler 1 des Teams darf den Namen ändern." };
    }
    const clean = name.trim().slice(0, 24);
    this.teamNames[teamIndex] = clean || (teamIndex === 0 ? "Team A" : "Team B");
    return { ok: true };
  }

  // --- Match ---------------------------------------------------------

  /** Baut Spieler + Teams aus der aktuellen Sitzbelegung. */
  private lineup(): { players: Player[]; teams: Team[] } {
    const seats = this.buildSeats();
    const players: Player[] = seats.map((s) => ({
      id: s.occupantId!,
      name: s.playerName ?? "Spieler",
      image: s.playerImage,
    }));
    const teams: Team[] = [0, 1].map((t) => ({
      id: `T${t}`,
      name: this.teamNames[t as 0 | 1],
      playerIds: seats.filter((s) => s.teamIndex === t).map((s) => s.occupantId!),
    })) as Team[];
    return { players, teams };
  }

  startMatch(memberId: string): { ok: true } | { ok: false; error: string } {
    if (memberId !== this.hostId) return { ok: false, error: "Nur der Host darf starten." };
    if (this.buildSeats().some((s) => !s.occupantId)) {
      return { ok: false, error: "Es sind noch nicht alle Plätze besetzt." };
    }
    const { players, teams } = this.lineup();
    this.controller = new MatchController(createMatch(this.config, players, teams));
    this.rematch = null;
    this.manualPause = null;
    this.offlineSeats.clear();
    this.resultWritten = false;
    this.phase = "match";
    return { ok: true };
  }

  resetMatch(memberId: string): { ok: true } | { ok: false; error: string } {
    if (memberId !== this.hostId) return { ok: false, error: "Nur der Host darf zurücksetzen." };
    this.controller = null;
    this.rematch = null;
    this.manualPause = null;
    this.offlineSeats.clear();
    this.phase = "lobby";
    return { ok: true };
  }

  // --- Revanche ---------------------------------------------------------

  offerRematch(memberId: string): { ok: true } | { ok: false; error: string } {
    if (this.phase !== "match" || !this.controller || this.controller.state.phase !== "finished") {
      return { ok: false, error: "Match ist nicht beendet." };
    }
    const seat = this.buildSeats().find((s) => s.occupantId === memberId);
    if (!seat) return { ok: false, error: "Nur Spieler am Tisch dürfen eine Revanche anbieten." };
    const needed = this.buildSeats()
      .filter((s) => s.teamIndex !== seat.teamIndex && s.occupantId && s.occupantId !== BOT_ID)
      .map((s) => s.occupantId!);
    if (needed.length === 0) {
      // Nur Bot auf der Gegenseite -> sofort neu starten
      this.restartMatch();
      return { ok: true };
    }
    this.rematch = {
      offeredBy: memberId,
      offeredByName: this.members.get(memberId)?.name ?? "?",
      needed,
      accepted: [],
    };
    return { ok: true };
  }

  private restartMatch(): void {
    const { players, teams } = this.lineup();
    this.controller = new MatchController(createMatch(this.config, players, teams));
    this.rematch = null;
    this.manualPause = null;
    this.offlineSeats.clear();
    this.resultWritten = false;
  }

  respondRematch(memberId: string, accept: boolean): { ok: true } | { ok: false; error: string } {
    if (!this.rematch) return { ok: false, error: "Kein Revanche-Angebot offen." };
    if (!this.rematch.needed.includes(memberId)) {
      return { ok: false, error: "Deine Zustimmung ist nicht nötig." };
    }
    if (!accept) {
      this.rematch = null;
      return { ok: true };
    }
    if (!this.rematch.accepted.includes(memberId)) this.rematch.accepted.push(memberId);
    if (this.rematch.needed.every((id) => this.rematch!.accepted.includes(id))) {
      this.restartMatch();
    }
    return { ok: true };
  }

  applyMatch(
    memberId: string,
    payload: { kind: "dispatch"; action: MatchAction } | { kind: "undo" },
  ): { ok: true } | { ok: false; error: string } {
    if (!this.controller || this.phase !== "match") {
      return { ok: false, error: "Kein laufendes Spiel." };
    }
    const seat = this.buildSeats().find((s) => s.occupantId === memberId);
    if (!seat) return { ok: false, error: "Nur Spieler am Tisch dürfen werten." };

    if (payload.kind === "undo") {
      this.controller.undo();
      return { ok: true };
    }

    if (this.isPaused) {
      return { ok: false, error: "Spiel ist pausiert." };
    }

    const action = payload.action;
    const state = this.controller.state;

    if (action.type === "BULLOFF_THROW") {
      if (seat.teamIndex !== action.teamIndex) {
        return { ok: false, error: "Du wirfst für das andere Team." };
      }
    } else if (action.type === "RECORD_VISIT" || action.type === "RECORD_SCORE") {
      const thrower = currentThrower(state);
      if (!thrower || thrower.playerId !== memberId) {
        return { ok: false, error: "Nur der Spieler am Wurf darf werten." };
      }
    }

    this.controller.dispatch(action);
    return { ok: true };
  }

  // --- Snapshots ----------------------------------------------------

  snapshot(): RoomState {
    const seats = this.buildSeats();
    const seatedIds = new Set(seats.map((s) => s.occupantId).filter(Boolean) as string[]);
    const spectators: SpectatorInfo[] = [...this.members.values()]
      .filter((m) => !seatedIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, connected: m.connected }));

    return {
      roomId: this.roomId,
      name: this.name,
      hostId: this.hostId,
      phase: this.phase,
      config: this.config,
      teamNames: this.teamNames,
      seats,
      spectators,
      match: this.controller?.state ?? null,
      rematch: this.rematch,
      pause: this.pauseInfo(),
      bot: this.bot ? { ...this.bot, seatKey: this.botSeatKey() } : null,
      videoEnabled,
      livekitRoom: this.roomId,
    };
  }

  // --- Bot-Steuerung ------------------------------------------------

  /** Ist gerade der Bot am Zug (X01/Cricket) oder mit Ausbullen dran? */
  botTurnPending(): boolean {
    if (!this.bot || !this.controller || this.phase !== "match" || this.isPaused) return false;
    const st = this.controller.state;
    if (st.phase === "bulloff" && st.bullOff) {
      const next = nextBullOffTeam(st.bullOff);
      return next !== null && this.seatTeam(BOT_ID) === next;
    }
    if (st.phase === "playing") {
      return currentThrower(st)?.playerId === BOT_ID;
    }
    return false;
  }

  /** Führt einen Bot-Zug aus (server-intern, umgeht die Wurf-Berechtigung). */
  runBotTurn(): boolean {
    if (!this.botTurnPending() || !this.controller || !this.bot) return false;
    const st = this.controller.state;
    const avg = this.bot.average;

    if (st.phase === "bulloff") {
      const team = this.seatTeam(BOT_ID);
      if (team === null) return false;
      this.controller.dispatch({
        type: "BULLOFF_THROW",
        teamIndex: team,
        playerId: BOT_ID,
        darts: botBullOff(avg).map((k) => ({ kind: k })),
      });
      return true;
    }

    const thrower = currentThrower(st);
    if (thrower?.playerId !== BOT_ID) return false;
    const darts =
      st.leg.mode === "x01"
        ? botX01Visit(st.leg as X01LegState, thrower.teamIndex, avg, st.config.x01!.out)
        : botCricketVisit(st.leg as CricketLegState, thrower.teamIndex, avg);
    this.controller.dispatch({ type: "RECORD_VISIT", darts });
    return true;
  }

  private seatTeam(occupantId: string): number | null {
    const seat = this.buildSeats().find((s) => s.occupantId === occupantId);
    return seat ? seat.teamIndex : null;
  }

  /**
   * Liefert einmalig das Endergebnis, sobald das Match beendet ist – zum
   * Archivieren. Danach `null`, bis ein neues Match läuft.
   */
  takeFinishedResult(): Record<string, unknown> | null {
    const st = this.controller?.state;
    if (!st || st.phase !== "finished" || this.resultWritten) return null;
    this.resultWritten = true;
    const stats = matchStats(st);
    const seats = this.buildSeats();
    return {
      ts: new Date().toISOString(),
      roomId: this.roomId,
      roomName: this.name,
      mode: st.config.mode,
      config: st.config,
      winnerTeamIndex: st.matchWinnerTeamIndex,
      teams: [0, 1].map((t) => ({
        name: this.teamNames[t as 0 | 1],
        players: seats.filter((s) => s.teamIndex === t).map((s) => s.playerName ?? "?"),
        setsWon: st.setsWon[t],
        legsWon: stats.teams[t as 0 | 1].legsWon,
        average: Number(stats.teams[t as 0 | 1].average.toFixed(2)),
        checkoutPct: Number(stats.teams[t as 0 | 1].checkoutPct.toFixed(1)),
      })),
    };
  }

  summary(): HubRoomSummary {
    const seats = this.buildSeats();
    const seatedIds = new Set(seats.map((s) => s.occupantId).filter(Boolean) as string[]);
    const host = this.members.get(this.hostId);
    return {
      roomId: this.roomId,
      name: this.name,
      hostName: host?.name ?? "?",
      mode: this.config.mode,
      teamSize: this.config.teamSize,
      seatsFilled: seats.filter((s) => s.occupantId).length,
      seatsTotal: seats.length,
      spectators: this.members.size - seatedIds.size,
      phase: this.phase,
      hasBot: this.bot !== null,
    };
  }

  isSeated(memberId: string): boolean {
    return this.buildSeats().some((s) => s.occupantId === memberId);
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  create(
    hostId: string,
    hostName: string,
    config: MatchConfig,
    teamNames: [string, string],
    name = "",
    bot: BotConfig | null = null,
    hostImage: string | null = null,
  ): Room {
    const room = new Room(hostId, hostName, config, teamNames, name, bot, hostImage);
    this.rooms.set(room.roomId, room);
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  count(): number {
    return this.rooms.size;
  }

  list(): Room[] {
    return [...this.rooms.values()];
  }

  destroy(roomId: string) {
    this.rooms.delete(roomId);
  }
}
