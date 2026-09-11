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
 * Sprachchat über LiveKit – verbindet überall automatisch (Hub, Raum-Lobby,
 * Match als Spieler), kein manueller "Beitreten"-Schritt mehr. Sobald
 * verbunden, schaltet sich das Mikro gleich mit an, wo canPublish erlaubt ist
 * – Zuschauer im Match bleiben stumm. Schutz gegen zu hohes LiveKit-Kontingent
 * im Hub: der Server liefert ab HUB_VOICE_MAX gleichzeitig Online kein Token
 * mehr (Kanal pausiert automatisch, kein Opt-in nötig dafür).
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
  const [conn, setConn] = useState<
    { status: "loading" } | { status: "off" } | { status: "ready"; token: string; url: string }
  >({ status: "loading" });

  useEffect(() => {
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
  }, [roomId, hub]);

  if (conn.status === "off") {
    return (
      <div className="lobby-audio">
        <span className="lbl">🎙 Sprachchat</span>
        <span className="hint">gerade nicht verfügbar</span>
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
      <MicBar hub={hub} canPublish={canPublish} />
    </LiveKitRoom>
  );
}

function MicBar({ hub, canPublish }: { hub: boolean; canPublish: boolean }) {
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
    </div>
  );
}
