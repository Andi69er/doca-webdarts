import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BotConfig,
  ChatMessage,
  HubState,
  MatchAction,
  MatchConfig,
  RoomState,
  TournamentDetail,
  TournamentSummary,
} from "@webdarts/engine";
import { emitAck, getSocket } from "./net";
import { embed } from "./embed";

export interface AppApi {
  connected: boolean;
  myId: string | null;
  name: string | null;
  hub: HubState | null;
  room: RoomState | null;
  error: string | null;
  clearError: () => void;

  setName: (name: string) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  sendRoomChat: (text: string) => Promise<void>;

  createRoom: (p: {
    name?: string;
    config: MatchConfig;
    teamNames: [string, string];
    bot?: BotConfig | null;
  }) => Promise<void>;
  enterRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;

  takeSeat: (seatKey: string | null) => Promise<void>;
  placeBot: (seatKey: string | null) => Promise<void>;
  setLocalTeam: (teamIndex: number, local: boolean) => Promise<void>;
  setPartner: (
    teamIndex: number,
    name: string,
    memberId?: string | null,
    image?: string | null,
  ) => Promise<void>;
  updateConfig: (config: MatchConfig, teamNames: [string, string]) => Promise<void>;
  setTeamName: (teamIndex: number, name: string) => Promise<void>;
  startMatch: () => Promise<void>;
  resetMatch: () => Promise<void>;
  pauseMatch: () => Promise<void>;
  resumeMatch: () => Promise<void>;
  offerRematch: () => Promise<void>;
  respondRematch: (accept: boolean) => Promise<void>;
  dispatch: (action: MatchAction) => Promise<void>;
  undo: () => Promise<void>;

  listTournaments: () => Promise<TournamentSummary[]>;
  tournamentDetail: (id: string) => Promise<TournamentDetail>;
  addTournament: (threeKEventId: number, name?: string) => Promise<TournamentSummary>;
  setTournamentProfile: (id: string, profile: MatchConfig) => Promise<void>;
  startTournamentMatch: (id: string, matchId: number) => Promise<void>;
  setTournamentPlayerOverride: (
    id: string,
    participantName: string,
    slot: 0 | 1,
    uid: string | null,
  ) => Promise<void>;
  setTournamentPublished: (id: string, published: boolean) => Promise<void>;

  /** Chat der aktuell betretenen Turnier-Lobby, eigener Kanal getrennt von Hub/Raum. */
  tournamentChat: ChatMessage[];
  enterTournamentLobby: (id: string) => Promise<ChatMessage[]>;
  leaveTournamentLobby: (id: string) => Promise<void>;
  sendTournamentChat: (id: string, text: string) => Promise<void>;
}

const NAME_KEY = "wd:name";
const CID_KEY = "wd:cid";

/** Stabile Client-ID – bleibt über Reloads/Reconnects gleich, damit man Sitz & Raum behält. */
function clientId(): string {
  if (embed) return "u:" + embed.user.id; // = Server-Identität bei SSO
  try {
    let id = localStorage.getItem(CID_KEY);
    if (!id) {
      id =
        globalThis.crypto?.randomUUID?.() ??
        `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(CID_KEY, id);
    }
    return id;
  } catch {
    return `c-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function useApp(): AppApi {
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [name, setNameState] = useState<string | null>(
    () => embed?.user.name ?? localStorage.getItem(NAME_KEY),
  );
  const [hub, setHub] = useState<HubState | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tournamentChat, setTournamentChat] = useState<ChatMessage[]>([]);
  const currentRoomId = useRef<string | null>(null);
  const currentTournamentLobbyId = useRef<string | null>(null);

  useEffect(() => {
    const s = getSocket();

    // Nach (Re-)Connect steht man zwar wieder im Hub, war aber ggf. gerade in
    // einer Turnier-Lobby - der Socket ist deren Chat-Kanal nicht mehr
    // beigetreten (das ist Socket-lokal, überlebt einen Reconnect nicht).
    // Sonst bekäme man nach einem kurzen Verbindungsabbruch leise keine
    // Turnier-Chat-/Anwesenheits-Updates mehr, bis man neu lädt.
    const rejoinTournamentLobby = () => {
      const tid = currentTournamentLobbyId.current;
      if (!tid) return;
      emitAck("tournament:enterLobby", { id: tid })
        .then(({ chat: c }) => setTournamentChat(c))
        .catch(() => {});
    };
    const rejoin = () => {
      setConnected(true);
      setMyId(clientId());
      if (embed) {
        emitAck("hub:join", {
          name: embed.user.name,
          cid: clientId(),
          token: embed.token,
        })
          .then(rejoinTournamentLobby)
          .catch(() => {});
        return;
      }
      const stored = localStorage.getItem(NAME_KEY);
      if (stored) {
        emitAck("hub:join", { name: stored, cid: clientId() }).then(rejoinTournamentLobby).catch(() => {});
      }
    };
    const onDisconnect = () => setConnected(false);
    const onHub = (state: HubState) => setHub(state);
    const onRoom = (state: RoomState) => {
      currentRoomId.current = state.roomId;
      setRoom(state);
    };
    const onTournamentChat = (p: { id: string; chat: ChatMessage[] }) => {
      if (p.id === currentTournamentLobbyId.current) setTournamentChat(p.chat);
    };
    const onErr = (p: { message: string }) => setError(p.message);
    const onClosed = (p: { reason: string }) => {
      currentRoomId.current = null;
      setRoom(null);
      setError("Raum geschlossen: " + p.reason);
    };

    s.on("connect", rejoin);
    s.on("disconnect", onDisconnect);
    s.on("hub:state", onHub);
    s.on("room:state", onRoom);
    s.on("tournament:chatState", onTournamentChat);
    s.on("server:error", onErr);
    s.on("room:closed", onClosed);
    if (s.connected) rejoin();

    return () => {
      s.off("connect", rejoin);
      s.off("disconnect", onDisconnect);
      s.off("hub:state", onHub);
      s.off("room:state", onRoom);
      s.off("tournament:chatState", onTournamentChat);
      s.off("server:error", onErr);
      s.off("room:closed", onClosed);
    };
  }, []);

  const guard = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);

  const rid = () => currentRoomId.current ?? room?.roomId ?? "";

  return {
    connected,
    myId,
    name,
    hub,
    room,
    error,
    clearError: () => setError(null),

    setName: (n) =>
      guard(
        emitAck("hub:join", { name: n, cid: clientId() }).then(() => {
          localStorage.setItem(NAME_KEY, n);
          setNameState(n);
        }),
      ),
    sendChat: (text) => guard(emitAck("hub:chat", { text }).then(() => undefined)),
    sendRoomChat: (text) =>
      guard(emitAck("room:chat", { roomId: rid(), text }).then(() => undefined)),

    createRoom: (p) =>
      guard(
        emitAck("room:create", p).then(({ roomId }) => {
          currentRoomId.current = roomId;
        }),
      ),
    enterRoom: (roomId) =>
      guard(
        emitAck("room:enter", { roomId }).then(({ roomId: id }) => {
          currentRoomId.current = id;
        }),
      ),
    leaveRoom: () =>
      guard(
        emitAck("room:leave", { roomId: rid() }).then(() => {
          currentRoomId.current = null;
          setRoom(null);
        }),
      ),

    takeSeat: (seatKey) => guard(emitAck("room:takeSeat", { roomId: rid(), seatKey }).then(() => undefined)),
    placeBot: (seatKey) => guard(emitAck("room:placeBot", { roomId: rid(), seatKey }).then(() => undefined)),
    setLocalTeam: (teamIndex, local) =>
      guard(emitAck("room:setLocalTeam", { roomId: rid(), teamIndex, local }).then(() => undefined)),
    setPartner: (teamIndex, name, memberId = null, image = null) =>
      guard(
        emitAck("room:setPartner", { roomId: rid(), teamIndex, name, memberId, image }).then(
          () => undefined,
        ),
      ),
    updateConfig: (config, teamNames) =>
      guard(emitAck("room:updateConfig", { roomId: rid(), config, teamNames }).then(() => undefined)),
    setTeamName: (teamIndex, name) =>
      guard(emitAck("room:setTeamName", { roomId: rid(), teamIndex, name }).then(() => undefined)),
    startMatch: () => guard(emitAck("match:start", { roomId: rid() }).then(() => undefined)),
    resetMatch: () => guard(emitAck("match:reset", { roomId: rid() }).then(() => undefined)),
    pauseMatch: () => guard(emitAck("match:pause", { roomId: rid() }).then(() => undefined)),
    resumeMatch: () => guard(emitAck("match:resume", { roomId: rid() }).then(() => undefined)),
    offerRematch: () => guard(emitAck("match:rematchOffer", { roomId: rid() }).then(() => undefined)),
    respondRematch: (accept) =>
      guard(emitAck("match:rematchRespond", { roomId: rid(), accept }).then(() => undefined)),
    dispatch: (action) =>
      guard(emitAck("match:action", { roomId: rid(), kind: "dispatch", action }).then(() => undefined)),
    undo: () => guard(emitAck("match:action", { roomId: rid(), kind: "undo" }).then(() => undefined)),

    listTournaments: () => guard(emitAck("tournaments:list", {})),
    tournamentDetail: (id) => guard(emitAck("tournament:detail", { id })),
    addTournament: (threeKEventId, name) => guard(emitAck("tournament:add", { threeKEventId, name })),
    setTournamentProfile: (id, profile) =>
      guard(emitAck("tournament:setProfile", { id, profile }).then(() => undefined)),
    startTournamentMatch: (id, matchId) =>
      guard(
        emitAck("tournament:startMatch", { id, matchId }).then(({ roomId }) => {
          currentRoomId.current = roomId;
        }),
      ),
    setTournamentPlayerOverride: (id, participantName, slot, uid) =>
      guard(
        emitAck("tournament:setPlayerOverride", { id, participantName, slot, uid }).then(() => undefined),
      ),
    setTournamentPublished: (id, published) =>
      guard(emitAck("tournament:setPublished", { id, published }).then(() => undefined)),

    tournamentChat,
    enterTournamentLobby: (id) =>
      guard(
        emitAck("tournament:enterLobby", { id }).then(({ chat: c }) => {
          currentTournamentLobbyId.current = id;
          setTournamentChat(c);
          return c;
        }),
      ),
    leaveTournamentLobby: (id) =>
      guard(
        emitAck("tournament:leaveLobby", { id }).then(() => {
          if (currentTournamentLobbyId.current === id) currentTournamentLobbyId.current = null;
          setTournamentChat([]);
        }),
      ),
    sendTournamentChat: (id, text) =>
      guard(emitAck("tournament:chat", { id, text }).then(() => undefined)),
  };
}
