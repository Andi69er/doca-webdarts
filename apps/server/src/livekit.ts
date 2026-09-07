/**
 * LiveKit-Zugangstokens. Optional: sind keine Keys gesetzt, läuft die App ohne Video.
 */

import { AccessToken } from "livekit-server-sdk";

const url = process.env.LIVEKIT_URL?.trim() ?? "";
const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";

export const videoEnabled = Boolean(url && apiKey && apiSecret);

if (!videoEnabled) {
  console.warn(
    "[livekit] Keine LIVEKIT_* Keys gesetzt – die App läuft ohne Video/Audio.",
  );
}

export function livekitUrl(): string {
  return url;
}

/**
 * Erzeugt ein Join-Token für einen Teilnehmer in einem Raum.
 * `canPublish` steuert, ob der Teilnehmer Cam/Mic senden darf (Spieler ja, Zuschauer nein).
 */
export async function createLivekitToken(opts: {
  room: string;
  identity: string;
  name: string;
  canPublish: boolean;
}): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "2h",
  });
  at.addGrant({
    room: opts.room,
    roomJoin: true,
    canPublish: opts.canPublish,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}
