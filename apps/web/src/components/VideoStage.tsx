import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  scoreboard,
  type CricketLegState,
  type Dart,
  type MatchState,
  type RoomState,
  type X01LegState,
} from "@webdarts/engine";
import { emitAck } from "../net";
import { audioCaptureOpts, videoCaptureOpts } from "../mediaPrefs";
import { AutoStartAudio } from "./AutoStartAudio";
import { Avatar } from "./Avatar";
import { BotDartboard } from "./BotDartboard";
import { DART_FLIGHT_MS, DART_STAGGER_MS } from "../dartboardRenderer";

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
      <CameraAutoRetry />
      <RoomAudioRenderer />
      <AutoStartAudio />
      <StartAudio label="🔊 Ton aktivieren" />
    </LiveKitRoom>
  );
}

/**
 * Manchmal ist die Kamera beim Matchstart noch kurz vom Lobby-Kameratest
 * belegt (der Browser/Treiber gibt das Gerät nach `stream.stop()` nicht
 * immer sofort frei) - dann schlägt LiveKits automatischer Erstversuch
 * (`video={...}` auf <LiveKitRoom>) stillschweigend fehl und die eigene
 * Kachel bleibt dauerhaft auf "Kamera aus" stehen. Prüft deshalb ein paar
 * Mal nach, ob die eigene Kamera wirklich läuft, und versucht es sonst
 * erneut (mit steigendem Abstand, da das Gerät ja erst frei werden muss).
 */
function CameraAutoRetry() {
  const room = useRoomContext();
  const attemptedRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    // Kurz und oft nachschauen statt lang warten - die Kamera wird meist
    // innerhalb von ein bis zwei Sekunden wieder frei, nicht erst nach zehn.
    const delays = [300, 300, 300, 400, 400, 500, 500];

    const tryEnable = () => {
      if (cancelled) return;
      if (room.localParticipant.isCameraEnabled) return; // schon da, fertig
      void room.localParticipant.setCameraEnabled(true, videoCaptureOpts()).catch(() => {});
      const delay = delays[attemptedRef.current];
      attemptedRef.current += 1;
      if (delay !== undefined) setTimeout(tryEnable, delay);
    };

    const t = setTimeout(tryEnable, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [room]);

  return null;
}

function Stage({ room }: { room: RoomState }) {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  const realActiveId =
    room.match && room.phase === "match"
      ? scoreboard(room.match as MatchState).thrower?.playerId ?? null
      : null;

  // Bot-Platz: zeigt statt Kamerabild eine Mini-Dartscheibe mit den zuletzt
  // geworfenen Darts. `visits` liegt bei X01 wie Cricket gleich (teamIndex +
  // darts), daher hier generisch behandelt.
  const botSeat = room.bot ? (room.seats.find((s) => s.key === room.bot!.seatKey) ?? null) : null;
  let botDarts: Dart[] = [];
  let botVisitKey = 0; // Zählt nur Aufnahmen DES BOTS - triggert die Flugbahn nicht bei fremden Würfen neu.
  if (botSeat && room.match && room.phase === "match") {
    const st = room.match as MatchState;
    if (st.phase === "playing" || st.phase === "finished") {
      const visits = (st.leg as X01LegState | CricketLegState).visits;
      for (const v of visits) {
        if (v.teamIndex === botSeat.teamIndex) {
          botVisitKey += 1;
          botDarts = v.darts;
        }
      }
    }
  }

  // Der Server rückt den Anwurf sofort nach dem Bot-Zug weiter (RECORD_VISIT
  // ist eine atomare Aktion) - ohne Bremse würde die Großansicht schon zum
  // Menschen springen, während die Darts optisch noch in die (dann kleine)
  // Bot-Kachel reinfliegen. Hält den Bot deshalb clientseitig noch so lange
  // "groß", bis die Flugbahn-Animation (siehe BotDartboard) durch ist.
  const [holdBotUntil, setHoldBotUntil] = useState(0);
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (botVisitKey === 0 || botDarts.length === 0) return;
    // +2s Pause nach dem letzten Dart, bevor die Großansicht weiterspringt.
    const holdMs = (botDarts.length - 1) * DART_STAGGER_MS + DART_FLIGHT_MS + 2000;
    setHoldBotUntil(Date.now() + holdMs);
    const t = setTimeout(() => forceTick((n) => n + 1), holdMs + 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botVisitKey]);
  const holdingBot = botSeat != null && Date.now() < holdBotUntil;
  const activeId = holdingBot ? botSeat!.playerId : realActiveId;

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
        const isBot = botSeat != null && s.key === botSeat.key;
        return (
          <div key={s.key} className={`vtile ${cls}`}>
            {isBot ? (
              <BotDartboard darts={botDarts} visitKey={botVisitKey} focused={cls.includes("big")} />
            ) : tr?.publication ? (
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
