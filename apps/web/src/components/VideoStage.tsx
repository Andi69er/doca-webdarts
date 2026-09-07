import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { scoreboard, type MatchState, type RoomState } from "@webdarts/engine";
import { emitAck } from "../net";
import { Avatar } from "./Avatar";

export function VideoStage({ room }: { room: RoomState }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "disabled" }
    | { status: "ready"; token: string; url: string }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    emitAck("livekit:token", { roomId: room.roomId })
      .then((res) => {
        if (cancelled) return;
        if ("disabled" in res) setState({ status: "disabled" });
        else setState({ status: "ready", token: res.token, url: res.url });
      })
      .catch((e) => !cancelled && setState({ status: "error", message: (e as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [room.roomId]);

  if (state.status === "loading") {
    return <div className="video-off">Video wird verbunden…</div>;
  }
  if (state.status === "disabled") {
    return (
      <div className="video-off">
        <div>
          <strong>Video ist deaktiviert.</strong>
          <div className="hint" style={{ marginTop: 8 }}>
            Trage in <code>apps/server/.env</code> deine LiveKit-Keys ein
            (kostenloses Projekt auf cloud.livekit.io), dann erscheinen hier die 4 Kamerabilder.
          </div>
        </div>
      </div>
    );
  }
  if (state.status === "error") {
    return <div className="video-off">Video-Fehler: {state.message}</div>;
  }

  return (
    <LiveKitRoom
      serverUrl={state.url}
      token={state.token}
      connect
      video
      audio
      style={{ display: "contents" }}
    >
      <Stage room={room} />
      <RoomAudioRenderer />
      <StartAudio label="🔊 Ton aktivieren" />
    </LiveKitRoom>
  );
}

function Stage({ room }: { room: RoomState }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  const activeId =
    room.match && room.phase === "match"
      ? scoreboard(room.match as MatchState).thrower?.playerId ?? null
      : null;

  // Bekannte Namen + Bilder aus den Sitzplätzen (LiveKit-Identity = occupantId).
  const nameById = new Map<string, string>();
  const imgById = new Map<string, string | null>();
  for (const s of room.seats) {
    if (!s.occupantId) continue;
    nameById.set(s.occupantId, s.playerName ?? "Spieler");
    imgById.set(s.occupantId, s.playerImage);
  }

  const sorted = [...tracks].sort((a, b) => {
    const aActive = a.participant.identity === activeId ? -1 : 0;
    const bActive = b.participant.identity === activeId ? -1 : 0;
    return aActive - bActive;
  });

  const count = sorted.length;
  const stageClass =
    count <= 1 ? "video-stage count-1" : count === 2 ? "video-stage count-2" : "video-stage";

  return (
    <div className={stageClass}>
      {count === 0 && <div className="vtile placeholder">Warte auf Kamerabilder…</div>}
      {sorted.map((tr, i) => {
        const id = tr.participant.identity;
        const isThrower = id === activeId;
        const big = count > 2 && i === 0;
        const label = nameById.get(id) ?? tr.participant.name ?? "Gast";
        return (
          <div
            key={tr.participant.sid + (tr.publication?.trackSid ?? "ph")}
            className={`vtile ${big ? "big" : count > 2 ? "small" : ""}`}
          >
            {tr.publication ? (
              <VideoTrack trackRef={tr} />
            ) : (
              <div className="placeholder" style={{ width: "100%", height: "100%" }}>
                {label} – Kamera aus
              </div>
            )}
            <span className={`tag ${isThrower ? "thrower" : ""}`}>
              <Avatar src={imgById.get(id) ?? null} name={label} size={18} />
              {isThrower ? "▸ " : ""}
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
