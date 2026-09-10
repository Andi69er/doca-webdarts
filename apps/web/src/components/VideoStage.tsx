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
import { audioCaptureOpts, videoCaptureOpts } from "../mediaPrefs";
import { AutoStartAudio } from "./AutoStartAudio";
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
      video={videoCaptureOpts()}
      audio={audioCaptureOpts()}
      options={{
        publishDefaults: {
          simulcast: false,
          videoEncoding: { maxBitrate: 1_400_000, maxFramerate: 24 },
        },
      }}
      style={{ display: "contents" }}
    >
      <Stage room={room} />
      <RoomAudioRenderer />
      <AutoStartAudio />
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

  // Kamera-Track je LiveKit-Identity (= occupantId des Platzes).
  // Bei "lokal" teilen sich Platz 1 und der Partner-Platz denselben Track.
  const trackByIdentity = new Map<string, (typeof tracks)[number]>();
  for (const tr of tracks) {
    const id = tr.participant.identity;
    const prev = trackByIdentity.get(id);
    if (!prev || (!prev.publication && tr.publication)) trackByIdentity.set(id, tr);
  }

  // Eine Kachel je besetztem Platz – STABILE Reihenfolge (kein Umsortieren pro
  // Wurf, das ließ die Bilder hin- und herspringen). Der aktive Werfer bekommt
  // nur die „spot“-Klasse und wird per CSS groß dargestellt.
  const seats = room.seats.filter((s) => s.occupantId);

  const count = seats.length;
  const hasSpot = activeId != null && seats.some((s) => s.playerId === activeId);
  const stageClass =
    count <= 1
      ? "video-stage count-1"
      : count === 2
        ? `video-stage count-2${hasSpot ? " spotlight" : ""}`
        : `video-stage${hasSpot ? " spotlight" : ""}`;

  return (
    <div className={stageClass}>
      {count === 0 && <div className="vtile placeholder">Warte auf Kamerabilder…</div>}
      {seats.map((s) => {
        const tr = trackByIdentity.get(s.occupantId!);
        const isThrower = s.playerId != null && s.playerId === activeId;
        const cls = isThrower && hasSpot ? "spot big" : count > 2 ? "small" : "";
        const label = s.playerName ?? "Spieler";
        return (
          <div key={s.key} className={`vtile ${cls}`}>
            {tr?.publication ? (
              <VideoTrack trackRef={tr} />
            ) : (
              <div className="placeholder" style={{ width: "100%", height: "100%" }}>
                {label}{s.isLocalPartner ? " (am selben Board)" : " – Kamera aus"}
              </div>
            )}
            <span className={`tag ${isThrower ? "thrower" : ""}`}>
              <Avatar src={s.playerImage} name={label} size={18} />
              {isThrower ? "▸ " : ""}
              {label}
              {s.isLocalPartner ? " ·📍" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
