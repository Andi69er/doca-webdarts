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
import { authRequired, verifyTicket } from "./auth.js";

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
/** Nachfrist, bis ein abgemeldeter Spieler seinen Sitz endgültig verliert. */
const GRACE_SEATED_MS = 5 * 60_000;
const GRACE_LOBBY_MS = 20_000;

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
  const limit = Number(req.query.limit ?? 50);
  res.json(await recentResults(Number.isFinite(limit) ? limit : 50));
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
        canPublish: room.isSeated(me()),
      });
      ack({ ok: true, data: { token, url: livekitUrl() } });
    } catch (err) {
      ack({ ok: false, error: "Token-Fehler: " + (err as Error).message });
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

    if (room) {
      room.setConnected(cid, false); // löst ggf. Auto-Pause aus
      void broadcastRoom(room.roomId);
    }

    const grace = seated ? GRACE_SEATED_MS : GRACE_LOBBY_MS;
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
