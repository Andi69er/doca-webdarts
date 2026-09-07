import { io, type Socket } from "socket.io-client";
import type {
  AckResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@webdarts/engine";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:8787";

export type WdSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: WdSocket | null = null;

export function getSocket(): WdSocket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: true, transports: ["websocket"] });
  }
  return socket;
}

/**
 * Typsicheres emit-with-ack als Promise.
 * `emitAck("room:join", { joinCode, name })` -> Promise<{ roomId }>.
 */
export function emitAck<Ev extends keyof ClientToServerEvents>(
  event: Ev,
  payload: Parameters<ClientToServerEvents[Ev]>[0],
): Promise<
  Parameters<Parameters<ClientToServerEvents[Ev]>[1]>[0] extends AckResult<infer D>
    ? D
    : never
> {
  return new Promise((resolve, reject) => {
    (getSocket().emit as any)(event, payload, (res: AckResult<unknown>) => {
      if (res.ok) resolve(res.data as never);
      else reject(new Error(res.error));
    });
  });
}
