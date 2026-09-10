import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant } from "@livekit/components-react";
import { emitAck } from "../net";
import { getMicDeviceId } from "../mediaPrefs";

/**
 * Sprachchat über LiveKit – reine Audio-Verbindung, Mikro standardmäßig AUS.
 * `hub` = globaler Kanal aller Online (im Hub); sonst der aktuelle Raum.
 */
export function LobbyAudio({ roomId, hub = false }: { roomId?: string; hub?: boolean }) {
  const [conn, setConn] = useState<
    { status: "loading" } | { status: "off" } | { status: "ready"; token: string; url: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
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

  if (conn.status !== "ready") return null;

  return (
    <LiveKitRoom serverUrl={conn.url} token={conn.token} connect audio={false} video={false}>
      <RoomAudioRenderer />
      <MicBar hub={hub} />
    </LiveKitRoom>
  );
}

function MicBar({ hub }: { hub: boolean }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const canTalk = localParticipant.permissions?.canPublish ?? false;

  return (
    <div className="lobby-audio">
      <span className="lbl">🎙 Sprachchat{hub ? " (alle Online)" : ""}</span>
      {canTalk ? (
        <button
          className={isMicrophoneEnabled ? "primary" : "ghost"}
          onClick={() => {
            const mic = getMicDeviceId();
            void localParticipant.setMicrophoneEnabled(
              !isMicrophoneEnabled,
              mic ? { deviceId: mic } : undefined,
            );
          }}
        >
          {isMicrophoneEnabled ? "🎤 Mikro an" : "🔇 Mikro aus"}
        </button>
      ) : (
        <span className="hint">nur zuhören</span>
      )}
      <StartAudio label="🔊 Ton aktivieren" className="ghost" />
    </div>
  );
}
