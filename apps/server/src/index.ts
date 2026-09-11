import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { customAlphabet } from "nanoid";
import type {
  ChatMessage,
  ClientToServerEvents,
  HubState,
  ServerToClientEvents,
} from "@webdarts/engine";
import { RoomManager } from "./rooms.js";
import { createLivekitToken, livekitUrl, videoEnabled } from "./livekit.js";
import { RateLimiter, sanitizeConfig, validateAction } from "./validate.js";
import { appendResult, recentResults } from "./results.js";
import { careerFor, loadCareer, recordCareer } from "./stats.js";
import { sendSession, sendUsage } from "./ingest.js";
import { authRequired, verifyTicket } from "./auth.js";
import {
  addTournament,
  getMatchRoom,
  getTournamentDetail,
  listTournaments,
  resolvePairing,
  setMatchRoom,
  setPlayerOverride,
  setTournamentProfile,
  setTournamentPublished,
} from "./tournaments.js";
import { parseSingleDisplayName } from "./nameMatch.js";

/** DOCA-Login, der Turniere verknüpfen und deren Matchprofil festlegen darf. */
const TOURNAMENT_ADMIN = "Andi69er";

const PORT = Number(process.env.PORT ?? 8787);
/** Erlaubte Web-Origins (Komma-Liste), z.B. "https://www.doca.at,http://localhost:5173". */
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const genId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const MAX_ROOMS = 300;
const MAX_MEMBERS_PER_ROOM = 25;
const MAX_NAME = 24;
const MAX_ROOM_NAME = 40;
const MAX_CHAT = 400;
/**
 * Nachfrist, bis ein abgemeldeter Spieler im LAUFENDEN Match seinen Sitz
 * endgültig verliert. Das Match pausiert derweil automatisch – lieber lange
 * warten, als jemanden für einen Toiletten-/Anruf-/WLAN-Aussetzer rauszuwerfen.
 * Kommt er nach Ablauf zurück, bekommt er seinen Platz per Reclaim trotzdem
 * wieder, solange ihn niemand übernommen hat.
 */
const GRACE_SEATED_MS = 20 * 60_000;
/**
 * In der Lobby (Match noch nicht gestartet) bleibt der Sitzplatz deutlich länger
 * reserviert – ein Spieler, der kurz weg muss (Telefon, WC …), kommt auf seinen
 * Platz zurück statt nur noch als Zuschauer. Nur ein komplett verwaister Raum
 * wird nach dieser Zeit aufgeräumt.
 */
const GRACE_SEATED_LOBBY_MS = 30 * 60_000;
const GRACE_LOBBY_MS = 20_000;
/** Ab wie vielen gleichzeitig Online der globale Hub-Sprachchat deaktiviert wird. */
const HUB_VOICE_MAX = 12;

const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(cors({ origin: CLIENT_ORIGINS }));
app.get("/health", (_req, res) => res.json({ ok: true, videoEnabled, authRequired }));
app.get("/results", async (req, res) => {
  // Match-Historie enthält Namen/Averages – nur mit Schlüssel (Admin-Auswertung).
  const key = process.env.WEBDARTS_SECRET ?? "";
  if (!key || req.get("x-webdarts-key") !== key) {
    return res.status(403).json({ error: "auth" });
  }
  const limit = Number(req.query.limit ?? 50);
  res.json(await recentResults(Number.isFinite(limit) ? limit : 50));
});

// --- 2K/3K-Liga-Daten-Proxy -------------------------------------------------
// Der doca.at-Server erreicht backend3.3k-darts.com (Hetzner) seit ~09/2026
// nicht mehr (TCP-Timeout, Routing-Problem AT↔Hetzner). Dieser Dienst kommt
// durch und reicht die ÖFFENTLICHEN, ungeschützten Frontend-API-Daten (kein
// Login, kein Key nötig) 1:1 weiter. Fest verdrahtet, nur Lesepfade unter
// event/<id>, kurzer In-Memory-Cache gegen Doppelabrufe.
const TWOK_BASE = "https://backend3.3k-darts.com/2k-backend3/api/v1/frontend/";
const TWOK_TTL = 90_000;
const twokCache = new Map<string, { ts: number; status: number; body: string }>();

app.get(/^\/2k\/(.+)$/, async (req, res) => {
  const key = process.env.WEBDARTS_SECRET ?? "";
  if (!key || req.get("x-webdarts-key") !== key) {
    return res.status(403).json({ error: "auth" });
  }
  const path = String((req.params as Record<string, string>)[0] ?? "").replace(/\?.*$/, "");
  // Nur die bekannten Lese-Endpunkte: event/<id> und daran hängende Unterpfade.
  if (!/^event\/\d+(?:\/[a-zA-Z]+(?:\/\d+)?)*$/.test(path)) {
    return res.status(400).json({ error: "bad path" });
  }

  const hit = twokCache.get(path);
  if (hit && Date.now() - hit.ts < TWOK_TTL) {
    return res.status(hit.status).type("application/json").send(hit.body);
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 12_000);
    const upstream = await fetch(TWOK_BASE + path, {
      signal: ac.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Origin: "https://portal.3k-darts.com",
        Referer: "https://portal.3k-darts.com/",
      },
    });
    clearTimeout(timer);
    const body = await upstream.text();
    twokCache.set(path, { ts: Date.now(), status: upstream.status, body });
    if (twokCache.size > 200) {
      const oldest = twokCache.keys().next().value;
      if (oldest) twokCache.delete(oldest);
    }
    res.status(upstream.status).type("application/json").send(body);
  } catch (e) {
    res.status(502).json({ error: "upstream", detail: (e as Error).message });
  }
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: CLIENT_ORIGINS, methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e5,
});

const manager = new RoomManager();
const limiter = new RateLimiter();

interface HubMember {
  /** Stabile Client-ID (überlebt Reload / Reconnect). */
  cid: string;
  name: string;
  image: string | null;
  roomId: string | null;
  /** Aktuell verbundener Socket (wechselt bei Reconnect). */
  socketId: string | null;
}
const hub = new Map<string, HubMember>();
const chat: ChatMessage[] = [];
const CHAT_LIMIT = 60;

/** Live-Momentaufnahme für das Admin-Dashboard (per x-webdarts-key geschützt). */
const USAGE_KEY = process.env.WEBDARTS_SECRET ?? "";
app.get("/usage", (req, res) => {
  if (!USAGE_KEY || req.get("x-webdarts-key") !== USAGE_KEY) {
    return res.status(403).json({ error: "auth" });
  }
  const rooms = manager.list();
  res.json({
    ts: Date.now(),
    online: [...hub.values()].map((m) => ({ id: m.cid, name: m.name, inRoom: m.roomId !== null })),
    rooms: rooms.length,
    playing: rooms.filter((r) => r.summary().phase === "match").length,
  });
});

/** Zuletzt gemeldete Login-Sitzung je Mitglied (entprellt das Ingest bei Reconnects). */
const lastSessionSent = new Map<string, number>();
const SESSION_MIN_GAP_MS = 10 * 60_000;

/** Pro Raum ein Timer für den nächsten Bot-Zug. */
const botTimers = new Map<string, ReturnType<typeof setTimeout>>();
function clearBotTimer(roomId: string) {
  const t = botTimers.get(roomId);
  if (t) clearTimeout(t);
  botTimers.delete(roomId);
}
function destroyRoom(roomId: string) {
  clearBotTimer(roomId);
  manager.destroy(roomId);
}
function scheduleBot(roomId: string) {
  const room = manager.get(roomId);
  if (!room || !room.botTurnPending()) {
    clearBotTimer(roomId);
    return;
  }
  if (botTimers.has(roomId)) return;
  const t = setTimeout(() => {
    botTimers.delete(roomId);
    const r = manager.get(roomId);
    if (r && r.runBotTurn()) void broadcastRoom(roomId);
  }, 1200 + Math.random() * 900);
  botTimers.set(roomId, t);
}

const cleanText = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
const cleanCid = (s: unknown) => String(s ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);

function pushChat(msg: Omit<ChatMessage, "id" | "ts">) {
  chat.push({ ...msg, id: genId(), ts: Date.now() });
  if (chat.length > CHAT_LIMIT) chat.splice(0, chat.length - CHAT_LIMIT);
}

function hubState(): HubState {
  return {
    users: [...hub.values()]
      .map((m) => ({
        id: m.cid,
        name: m.name,
        image: m.image,
        roomId: m.roomId,
        stats: careerFor(m.cid),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    rooms: manager.list().map((r) => r.summary()),
    chat: [...chat],
  };
}

function broadcastHub() {
  io.to("hub").emit("hub:state", hubState());
}

async function broadcastRoom(roomId: string) {
  const room = manager.get(roomId);
  if (!room) return;
  io.to(roomId).emit("room:state", room.snapshot());
  const finished = room.takeFinishedResult();
  if (finished) {
    await appendResult(finished.record);
    recordCareer(finished.players);
    void sendUsage(finished.record); // dauerhaft in die doca.at-DB
    broadcastHub(); // frische Karriere-Werte in die Online-Liste
  }
  scheduleBot(roomId);
}

io.on("connection", (socket) => {
  // socket.data.cid wird in hub:join gesetzt (bereinigt bzw. "u:<uid>" per SSO).
  const me = () => String(socket.data.cid ?? "");
  const displayName = () => hub.get(me())?.name ?? "Gast";
  const tooMany = (ack: (r: { ok: false; error: string }) => void, key: string, perMin: number) => {
    if (limiter.allow(me() || socket.id, key, perMin)) return false;
    ack({ ok: false, error: "Zu viele Anfragen – kurz warten." });
    return true;
  };

  socket.on("hub:join", ({ name: n, cid, token }, ack) => {
    if (tooMany(ack, "join", 20)) return;

    // SSO: Ist ein Secret hinterlegt, ist ein gültiges doca.at-Ticket Pflicht.
    let id: string;
    let clean: string;
    let image: string | null = null;
    if (authRequired) {
      const user = verifyTicket(token);
      if (!user) {
        return ack({ ok: false, error: "Bitte über doca.at anmelden." });
      }
      id = "u:" + user.uid;
      clean = cleanText(user.name, MAX_NAME) || "Mitglied";
      image = user.image;
    } else {
      id = cleanCid(cid) || genId();
      clean = cleanText(n, MAX_NAME) || "Gast";
    }
    socket.data.cid = id;
    const existing = hub.get(id);

    if (existing) {
      // Reconnect: Namen aktualisieren, Socket neu verknüpfen, Raum wieder betreten
      existing.name = clean;
      existing.image = image;
      existing.socketId = socket.id;
      socket.join("hub");
      if (existing.roomId) {
        const room = manager.get(existing.roomId);
        if (room && room.hasMember(id)) {
          room.setConnected(id, true);
          socket.join(existing.roomId);
          socket.emit("room:state", room.snapshot());
          void broadcastRoom(existing.roomId);
        } else {
          existing.roomId = null;
        }
      }
    } else {
      hub.set(id, { cid: id, name: clean, image, roomId: null, socketId: socket.id });
      socket.join("hub");
      pushChat({ name: "", text: `${clean} ist online`, kind: "system" });
    }

    // Nutzung protokollieren (entprellt: höchstens alle 10 Min je Person)
    const lastSent = lastSessionSent.get(id) ?? 0;
    if (Date.now() - lastSent > SESSION_MIN_GAP_MS) {
      lastSessionSent.set(id, Date.now());
      void sendSession({
        playerId: id,
        memberId: id.startsWith("u:") ? id : null,
        name: clean,
      });
    }

    ack({ ok: true, data: null });
    broadcastHub();
  });

  socket.on("hub:chat", ({ text }, ack) => {
    if (tooMany(ack, "chat", 25)) return;
    const member = hub.get(me());
    if (!member) return ack({ ok: false, error: "Nicht in der Lobby." });
    const clean = cleanText(text, MAX_CHAT);
    if (!clean) return ack({ ok: false, error: "Leere Nachricht." });
    pushChat({ name: member.name, text: clean, kind: "user" });
    ack({ ok: true, data: null });
    broadcastHub();
  });

  socket.on("room:chat", ({ roomId, text }, ack) => {
    if (tooMany(ack, "chat", 25)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const clean = cleanText(text, MAX_CHAT);
    if (!clean) return ack({ ok: false, error: "Leere Nachricht." });
    room.addChat(displayName(), clean, room.isSeated(me()) ? "player" : "spectator");
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
  });

  socket.on("room:create", ({ name: roomName, config, teamNames, bot }, ack) => {
    if (tooMany(ack, "create", 6)) return;
    const member = hub.get(me());
    if (!member) return ack({ ok: false, error: "Bitte zuerst Namen setzen." });
    if (manager.count() >= MAX_ROOMS) return ack({ ok: false, error: "Server ausgelastet – zu viele Räume." });
    const safeNames: [string, string] = [
      cleanText(teamNames?.[0], MAX_NAME) || "Team A",
      cleanText(teamNames?.[1], MAX_NAME) || "Team B",
    ];
    const safeBot =
      bot && Number.isFinite(Number(bot.average))
        ? {
            average: Number(bot.average),
            name: String(bot.name ?? "Bot"),
            image: bot.image && /^https:\/\//.test(String(bot.image)) ? String(bot.image) : null,
          }
        : null;
    const room = manager.create(
      member.cid,
      member.name,
      sanitizeConfig(config),
      safeNames,
      cleanText(roomName, MAX_ROOM_NAME),
      safeBot,
      member.image,
    );
    member.roomId = room.roomId;
    socket.join(room.roomId);
    pushChat({ name: "", text: `${member.name} hat einen Raum eröffnet`, kind: "system" });
    ack({ ok: true, data: { roomId: room.roomId } });
    void broadcastRoom(room.roomId);
    broadcastHub();
  });

  socket.on("room:enter", ({ roomId }, ack) => {
    if (tooMany(ack, "enter", 30)) return;
    const member = hub.get(me());
    if (!member) return ack({ ok: false, error: "Bitte zuerst Namen setzen." });
    const room = manager.get(roomId);
    if (!room) return ack({ ok: false, error: "Raum nicht gefunden." });
    if (!room.hasMember(member.cid) && room.memberCount >= MAX_MEMBERS_PER_ROOM) {
      return ack({ ok: false, error: "Raum ist voll." });
    }
    room.addMember(member.cid, member.name, member.image);
    member.roomId = roomId;
    socket.join(roomId);
    ack({ ok: true, data: { roomId } });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("room:leave", ({ roomId }, ack) => {
    leaveRoom(roomId);
    ack({ ok: true, data: null });
  });

  socket.on("room:takeSeat", ({ roomId, seatKey }, ack) => {
    if (tooMany(ack, "seat", 60)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.takeSeat(me(), typeof seatKey === "string" ? seatKey : null);
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("room:updateConfig", ({ roomId, config, teamNames }, ack) => {
    if (tooMany(ack, "config", 60)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const safeNames: [string, string] = [
      cleanText(teamNames?.[0], MAX_NAME) || "Team A",
      cleanText(teamNames?.[1], MAX_NAME) || "Team B",
    ];
    const res = room.updateConfig(me(), sanitizeConfig(config), safeNames);
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("room:placeBot", ({ roomId, seatKey }, ack) => {
    if (tooMany(ack, "seat", 60)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.placeBot(me(), typeof seatKey === "string" ? seatKey : null);
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("room:setLocalTeam", ({ roomId, teamIndex, local }, ack) => {
    if (tooMany(ack, "seat", 60)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.setLocalTeam(me(), Number(teamIndex), Boolean(local));
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("room:setPartner", ({ roomId, teamIndex, name, memberId, image }, ack) => {
    if (tooMany(ack, "seat", 60)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const ref = typeof memberId === "string" ? memberId.slice(0, 40) : null;
    const img = typeof image === "string" ? image.slice(0, 300) : null;
    const res = room.setPartner(me(), Number(teamIndex), cleanText(name, MAX_NAME), ref, img);
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("room:setTeamName", ({ roomId, teamIndex, name: teamName }, ack) => {
    if (tooMany(ack, "teamname", 40)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.setTeamName(me(), Number(teamIndex), cleanText(teamName, MAX_NAME));
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("match:start", ({ roomId }, ack) => {
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    try {
      const res = room.startMatch(me());
      if (!res.ok) return ack(res);
    } catch {
      return ack({ ok: false, error: "Match konnte nicht gestartet werden." });
    }
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("match:reset", ({ roomId }, ack) => {
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.resetMatch(me());
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("match:pause", ({ roomId }, ack) => {
    if (tooMany(ack, "pause", 30)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.pause(me());
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
  });

  socket.on("match:resume", ({ roomId }, ack) => {
    if (tooMany(ack, "pause", 30)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.resume(me());
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
  });

  socket.on("match:rematchOffer", ({ roomId }, ack) => {
    if (tooMany(ack, "rematch", 10)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    const res = room.offerRematch(me());
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
  });

  socket.on("match:rematchRespond", ({ roomId, accept }, ack) => {
    if (tooMany(ack, "rematch", 20)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    try {
      const res = room.respondRematch(me(), Boolean(accept));
      if (!res.ok) return ack(res);
    } catch {
      return ack({ ok: false, error: "Revanche fehlgeschlagen." });
    }
    ack({ ok: true, data: null });
    void broadcastRoom(roomId);
    broadcastHub();
  });

  socket.on("match:action", (payload, ack) => {
    if (tooMany(ack, "action", 300)) return;
    const room = manager.get(payload?.roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });

    let res: { ok: true } | { ok: false; error: string };
    try {
      if (payload.kind === "undo") {
        res = room.applyMatch(me(), { kind: "undo" });
      } else {
        const action = validateAction(payload.action);
        if (!action) return ack({ ok: false, error: "Ungültige Aktion." });
        res = room.applyMatch(me(), { kind: "dispatch", action });
      }
    } catch {
      return ack({ ok: false, error: "Aktion fehlgeschlagen." });
    }
    if (!res.ok) return ack(res);
    ack({ ok: true, data: null });
    void broadcastRoom(payload.roomId);
  });

  socket.on("livekit:hubToken", async (_payload, ack) => {
    if (tooMany(ack, "token", 20)) return;
    if (!hub.get(me())) return ack({ ok: false, error: "Nicht in der Lobby." });
    if (!videoEnabled) return ack({ ok: true, data: { disabled: true } });
    // Schutz des LiveKit-Kontingents: globaler Sprachkanal nur bis HUB_VOICE_MAX Online.
    if (hub.size > HUB_VOICE_MAX) return ack({ ok: true, data: { disabled: true } });
    try {
      const token = await createLivekitToken({
        room: "webdarts-hub",
        identity: me(),
        name: displayName(),
        canPublish: true, // globaler Sprachkanal: jeder darf reden
      });
      ack({ ok: true, data: { token, url: livekitUrl() } });
    } catch (err) {
      ack({ ok: false, error: "Token-Fehler: " + (err as Error).message });
    }
  });

  socket.on("livekit:token", async ({ roomId }, ack) => {
    if (tooMany(ack, "token", 20)) return;
    const room = manager.get(roomId);
    if (!room || !room.hasMember(me())) return ack({ ok: false, error: "Nicht im Raum." });
    if (!videoEnabled) return ack({ ok: true, data: { disabled: true } });
    try {
      const token = await createLivekitToken({
        room: room.roomId,
        identity: me(),
        name: displayName(),
        // In der Lobby dürfen alle reden (Sprachchat). Im laufenden Match nur
        // Spieler am Tisch – Zuschauer hören zu, reden nicht.
        canPublish: room.phase !== "match" || room.isSeated(me()),
      });
      ack({ ok: true, data: { token, url: livekitUrl() } });
    } catch (err) {
      ack({ ok: false, error: "Token-Fehler: " + (err as Error).message });
    }
  });

  // --- Turniere (3K-Anbindung) --------------------------------------------

  socket.on("tournaments:list", async (_payload, ack) => {
    if (tooMany(ack, "tlist", 30)) return;
    const member = hub.get(me());
    const isAdmin = member?.name === TOURNAMENT_ADMIN;
    try {
      const list = await listTournaments();
      ack({ ok: true, data: isAdmin ? list : list.filter((t) => t.published) });
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("tournament:add", async ({ threeKEventId, name }, ack) => {
    if (tooMany(ack, "tadd", 10)) return;
    const member = hub.get(me());
    if (!member || member.name !== TOURNAMENT_ADMIN) {
      return ack({ ok: false, error: "Nur der Admin darf Turniere verknüpfen." });
    }
    const evId = Number(threeKEventId);
    if (!Number.isInteger(evId) || evId <= 0) return ack({ ok: false, error: "Ungültige 3K-Event-ID." });
    try {
      const t = await addTournament(evId, typeof name === "string" ? cleanText(name, MAX_ROOM_NAME) : undefined, member.cid);
      ack({ ok: true, data: t });
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("tournament:setProfile", async ({ id, profile }, ack) => {
    if (tooMany(ack, "tprofile", 20)) return;
    const member = hub.get(me());
    if (!member || member.name !== TOURNAMENT_ADMIN) {
      return ack({ ok: false, error: "Nur der Admin darf das Matchprofil festlegen." });
    }
    try {
      await setTournamentProfile(String(id), sanitizeConfig(profile));
      ack({ ok: true, data: null });
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("tournament:setPublished", async ({ id, published }, ack) => {
    if (tooMany(ack, "tpublish", 20)) return;
    const member = hub.get(me());
    if (!member || member.name !== TOURNAMENT_ADMIN) {
      return ack({ ok: false, error: "Nur der Admin darf das Turnier veröffentlichen." });
    }
    try {
      await setTournamentPublished(String(id), Boolean(published));
      ack({ ok: true, data: null });
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("tournament:setPlayerOverride", async ({ id, participantName, slot, uid }, ack) => {
    if (tooMany(ack, "toverride", 20)) return;
    const member = hub.get(me());
    if (!member || member.name !== TOURNAMENT_ADMIN) {
      return ack({ ok: false, error: "Nur der Admin darf Spieler manuell zuordnen." });
    }
    const name = cleanText(String(participantName ?? ""), MAX_ROOM_NAME);
    if (!name) return ack({ ok: false, error: "Ungültiger Name." });
    const s: 0 | 1 = slot === 1 ? 1 : 0;
    const cleanUid = typeof uid === "string" && /^u:\d+$/.test(uid) ? uid : null;
    try {
      await setPlayerOverride(String(id), name, s, cleanUid);
      ack({ ok: true, data: null });
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("tournament:detail", async ({ id }, ack) => {
    if (tooMany(ack, "tdetail", 30)) return;
    const member = hub.get(me());
    if (!member) return ack({ ok: false, error: "Bitte zuerst Namen setzen." });
    try {
      const detail = await getTournamentDetail(String(id), me() || null);
      if (!detail.published && member.name !== TOURNAMENT_ADMIN) {
        return ack({ ok: false, error: "Turnier nicht gefunden." });
      }
      ack({ ok: true, data: detail });
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("tournament:startMatch", async ({ id, matchId }, ack) => {
    if (tooMany(ack, "tstart", 15)) return;
    const member = hub.get(me());
    if (!member) return ack({ ok: false, error: "Bitte zuerst Namen setzen." });
    const tid = String(id);
    const mid = Number(matchId);

    // Für diese Paarung existiert schon ein Raum (ein Heim-Spieler hat ihn eröffnet)?
    // Dann rein statt einen zweiten anzulegen; eigenen Platz nehmen, falls vorgesehen und frei.
    const existing = getMatchRoom(tid, mid);
    if (existing && manager.get(existing.roomId)) {
      const room = manager.get(existing.roomId)!;
      room.addMember(member.cid, member.name, member.image);
      member.roomId = existing.roomId;
      socket.join(existing.roomId);
      if (me() === existing.homeUid) room.takeSeat(member.cid, "t0p0");
      else if (existing.homeUid2 !== null && me() === existing.homeUid2) room.takeSeat(member.cid, "t0p1");
      else if (me() === existing.awayUid) room.takeSeat(member.cid, "t1p0");
      else if (existing.awayUid2 !== null && me() === existing.awayUid2) room.takeSeat(member.cid, "t1p1");
      ack({ ok: true, data: { roomId: existing.roomId } });
      void broadcastRoom(existing.roomId);
      broadcastHub();
      return;
    }

    try {
      const pairing = await resolvePairing(tid, mid);
      if (!pairing) return ack({ ok: false, error: "Paarung nicht gefunden." });
      if (!pairing.published && member.name !== TOURNAMENT_ADMIN) {
        return ack({ ok: false, error: "Paarung nicht gefunden." });
      }
      const homeIds = pairing.isDouble ? [pairing.homeUid, pairing.homeUid2] : [pairing.homeUid];
      const awayIds = pairing.isDouble ? [pairing.awayUid, pairing.awayUid2] : [pairing.awayUid];
      if (homeIds.some((u) => !u) || awayIds.some((u) => !u)) {
        return ack({
          ok: false,
          error: "Diese Paarung konnte nicht automatisch zugeordnet werden – bitte manuell spielen.",
        });
      }
      const iAmHome = homeIds.includes(me());
      const iAmAway = awayIds.includes(me());
      if (!iAmHome && !iAmAway) {
        return ack({ ok: false, error: "Du bist nicht Teil dieser Paarung." });
      }
      if (!iAmHome) {
        const homeLabel = parseSingleDisplayName(pairing.homeName).fullName;
        return ack({ ok: false, error: `Nur ${homeLabel} (Heim) kann dieses Match eröffnen – bitte kurz warten.` });
      }
      if (manager.count() >= MAX_ROOMS) return ack({ ok: false, error: "Server ausgelastet – zu viele Räume." });

      const homeName = parseSingleDisplayName(pairing.homeName).fullName;
      const awayName = parseSingleDisplayName(pairing.awayName).fullName;
      const config = sanitizeConfig({ ...pairing.profile, teamSize: pairing.isDouble ? 2 : 1 });
      const room = manager.create(
        member.cid,
        member.name,
        config,
        [homeName, awayName],
        `Turnier: ${homeName} vs. ${awayName}`,
        null,
        member.image,
        true, // tournamentLocked: Format + Teamnamen kommen vom Admin-Matchprofil
      );
      room.takeSeat(member.cid, me() === pairing.homeUid ? "t0p0" : "t0p1");
      setMatchRoom(tid, mid, {
        roomId: room.roomId,
        homeUid: pairing.homeUid!,
        homeUid2: pairing.homeUid2,
        awayUid: pairing.awayUid!,
        awayUid2: pairing.awayUid2,
      });
      member.roomId = room.roomId;
      socket.join(room.roomId);
      pushChat({ name: "", text: `${member.name} hat ein Turnier-Match eröffnet`, kind: "system" });
      ack({ ok: true, data: { roomId: room.roomId } });
      void broadcastRoom(room.roomId);
      broadcastHub();
    } catch (err) {
      ack({ ok: false, error: (err as Error).message });
    }
  });

  function leaveRoom(roomId: string) {
    const room = manager.get(roomId);
    const member = hub.get(me());
    if (member) member.roomId = null;
    socket.leave(roomId);
    if (!room) {
      broadcastHub();
      return;
    }
    room.removeMember(me());
    if (room.isEmpty) destroyRoom(roomId);
    else void broadcastRoom(roomId);
    broadcastHub();
  }

  socket.on("disconnect", () => {
    const cid = me();
    const member = hub.get(cid);
    if (!member || member.socketId !== socket.id) return; // schon durch Reconnect ersetzt

    const roomId = member.roomId;
    const room = roomId ? manager.get(roomId) : null;
    const seated = room?.isSeated(cid) ?? false;
    const inLobby = room?.phase === "lobby";

    if (room) {
      room.setConnected(cid, false); // löst ggf. Auto-Pause aus
      void broadcastRoom(room.roomId);
    }

    const grace = seated
      ? inLobby
        ? GRACE_SEATED_LOBBY_MS
        : GRACE_SEATED_MS
      : GRACE_LOBBY_MS;
    setTimeout(() => {
      const m = hub.get(cid);
      if (!m || m.socketId !== socket.id) return; // in der Zwischenzeit wieder da
      if (roomId) {
        const r = manager.get(roomId);
        if (r) {
          r.removeMember(cid);
          if (r.isEmpty) destroyRoom(roomId);
          else void broadcastRoom(roomId);
        }
      }
      pushChat({ name: "", text: `${m.name} ist offline`, kind: "system" });
      hub.delete(cid);
      limiter.forget(cid);
      broadcastHub();
    }, grace);
  });
});

void loadCareer();

httpServer.listen(PORT, () => {
  console.log(`[webdarts] Server läuft auf http://localhost:${PORT}`);
  console.log(`[webdarts] Video: ${videoEnabled ? "aktiv (LiveKit)" : "deaktiviert"}`);
});
