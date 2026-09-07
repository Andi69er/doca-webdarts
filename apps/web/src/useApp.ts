import { useCallback, useEffect, useRef, useState } from "react";
import type { HubState, MatchAction, MatchConfig, RoomState } from "@webdarts/engine";
import { emitAck, getSocket } from "./net";

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

  createRoom: (p: { name?: string; config: MatchConfig; teamNames: [string, string] }) => Promise<void>;
  enterRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;

  takeSeat: (seatKey: string | null) => Promise<void>;
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
}

const NAME_KEY = "wd:name";
const CID_KEY = "wd:cid";

/** Stabile Client-ID – bleibt über Reloads/Reconnects gleich, damit man Sitz & Raum behält. */
function clientId(): string {
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
  const [name, setNameState] = useState<string | null>(() => localStorage.getItem(NAME_KEY));
  const [hub, setHub] = useState<HubState | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentRoomId = useRef<string | null>(null);

  useEffect(() => {
    const s = getSocket();

    const rejoin = () => {
      setConnected(true);
      setMyId(clientId());
      const stored = localStorage.getItem(NAME_KEY);
      if (stored) emitAck("hub:join", { name: stored, cid: clientId() }).catch(() => {});
    };
    const onDisconnect = () => setConnected(false);
    const onHub = (state: HubState) => setHub(state);
    const onRoom = (state: RoomState) => {
      currentRoomId.current = state.roomId;
      setRoom(state);
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
    s.on("server:error", onErr);
    s.on("room:closed", onClosed);
    if (s.connected) rejoin();

    return () => {
      s.off("connect", rejoin);
      s.off("disconnect", onDisconnect);
      s.off("hub:state", onHub);
      s.off("room:state", onRoom);
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
  };
}
