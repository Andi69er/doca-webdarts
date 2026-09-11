import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { emitAck } from "../net";
import { getMicDeviceId } from "../mediaPrefs";
import { AutoStartAudio } from "./AutoStartAudio";

/**
 * Sprachchat über LiveKit. `hub` = globaler Kanal aller Online: **opt-in**,
 * erst auf „Beitreten" verbindet er (spart LiveKit-Kontingent, kein
 * Ton-Symbol wenn man nicht will). Im Raum verbindet er automatisch (da will
 * man mit dem Gegner reden). Sobald verbunden, schaltet sich das Mikro
 * überall gleich aktiv, wo canPublish erlaubt ist (Hub, Raum-Lobby, Match als
 * Spieler) – Zuschauer im Match bleiben stumm.
 */
export function LobbyAudio({
  roomId,
  hub = false,
  canPublish = true,
}: {
  roomId?: string;
  hub?: boolean;
  /** Darf ich in diesem Kanal reden? false = Zuschauer im laufenden Match, nur zuhören. */
  canPublish?: boolean;
}) {
  const [joined, setJoined] = useState(!hub);
  const [conn, setConn] = useState<
    { status: "idle" } | { status: "loading" } | { status: "off" } | { status: "ready"; token: string; url: string }
  >({ status: hub ? "idle" : "loading" });

  useEffect(() => {
    if (!joined) return;
    let cancelled = false;
    setConn({ status: "loading" });
    const req = hub
      ? emitAck("livekit:hubToken", {})
      : emitAck("livekit:token", { roomId: roomId ?? "" });
    req
      .then((res) => {
        if (cancelled) return;
        if ("disabled" in res) setConn({ status: "off" });
        else setConn({ status: "ready", token: res.token, url: res.url });
      })
      .catch(() => !cancelled && setConn({ status: "off" }));
    return () => {
      cancelled = true;
    };
  }, [roomId, hub, joined]);

  if (hub && !joined) {
    return (
      <div className="lobby-audio">
        <span className="lbl">🎙 Sprachchat</span>
        <button className="ghost" onClick={() => setJoined(true)}>
          Beitreten
        </button>
      </div>
    );
  }

  if (conn.status === "off") {
    return (
      <div className="lobby-audio">
        <span className="lbl">🎙 Sprachchat</span>
        <span className="hint">gerade nicht verfügbar</span>
        {hub && (
          <button className="ghost" onClick={() => setJoined(false)}>
            OK
          </button>
        )}
      </div>
    );
  }

  if (conn.status !== "ready") {
    return (
      <div className="lobby-audio">
        <span className="lbl">🎙 Sprachchat</span>
        <span className="hint">verbinde …</span>
      </div>
    );
  }

  return (
    <LiveKitRoom serverUrl={conn.url} token={conn.token} connect audio={false} video={false}>
      <RoomAudioRenderer />
      <AutoStartAudio />
      <MicBar hub={hub} canPublish={canPublish} onLeave={hub ? () => setJoined(false) : undefined} />
    </LiveKitRoom>
  );
}

function MicBar({
  hub,
  canPublish,
  onLeave,
}: {
  hub: boolean;
  canPublish: boolean;
  onLeave?: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const connState = useConnectionState();
  const micInit = useRef(false);

  // Mikro gleich beim Verbinden aktiv schalten – überall wo geredet werden darf
  // (Hub, Raum-Lobby, Match als Spieler). Zuschauer im Match (canPublish=false)
  // bleiben stumm, da senden ohnehin serverseitig blockiert ist.
  useEffect(() => {
    if (!canPublish || micInit.current) return;
    if (connState === ConnectionState.Connected) {
      micInit.current = true;
      const mic = getMicDeviceId();
      void localParticipant
        .setMicrophoneEnabled(true, mic ? { deviceId: mic } : undefined)
        .catch(() => {});
    }
  }, [canPublish, connState, localParticipant]);

  const toggleMic = () => {
    if (!canPublish) return;
    const mic = getMicDeviceId();
    void localParticipant.setMicrophoneEnabled(
      !isMicrophoneEnabled,
      mic ? { deviceId: mic } : undefined,
    );
  };

  return (
    <div className="lobby-audio">
      <span className="lbl">🎙 Sprachchat{hub ? " (alle Online)" : ""}</span>
      {canPublish ? (
        <button className={isMicrophoneEnabled ? "primary" : "ghost"} onClick={toggleMic}>
          {isMicrophoneEnabled ? "🎤 Mikro an" : "🔇 Mikro aus"}
        </button>
      ) : (
        <span className="hint">🔇 Nur zuhören (Zuschauer)</span>
      )}
      {onLeave && (
        <button className="ghost" onClick={onLeave}>
          Verlassen
        </button>
      )}
    </div>
  );
}
