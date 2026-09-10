import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant } from "@livekit/components-react";
import { emitAck } from "../net";
import { getMicDeviceId } from "../mediaPrefs";

/**
 * Sprachchat in der Lobby: reine Audio-Verbindung über LiveKit, damit man sich
 * schon vor dem Match hört. Mikro standardmäßig AUS – erst per Klick an.
 */
export function LobbyAudio({ roomId }: { roomId: string }) {
  const [conn, setConn] = useState<
    { status: "loading" } | { status: "off" } | { status: "ready"; token: string; url: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    emitAck("livekit:token", { roomId })
      .then((res) => {
        if (cancelled) return;
        if ("disabled" in res) setConn({ status: "off" });
        else setConn({ status: "ready", token: res.token, url: res.url });
      })
      .catch(() => !cancelled && setConn({ status: "off" }));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (conn.status !== "ready") return null;

  return (
    <LiveKitRoom serverUrl={conn.url} token={conn.token} connect audio={false} video={false}>
      <RoomAudioRenderer />
      <MicBar />
    </LiveKitRoom>
  );
}

function MicBar() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const canTalk = localParticipant.permissions?.canPublish ?? false;

  return (
    <div className="lobby-audio">
      <span className="lbl">Sprachchat</span>
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
