import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCamDeviceId,
  getMicDeviceId,
  setCamDeviceId,
  setMicDeviceId,
} from "../mediaPrefs";

/**
 * Kamera-/Mikro-Selbsttest + Geräteauswahl für die Lobby.
 *
 * Prüft VOR dem Match, ob der Browser an Kamera/Mikro kommt (mit Klartext-Ursache
 * bei Fehler), zeigt Auflösung/Bildrate und einen kurzen Verbindungs-Check zum
 * Render-Server. Man kann Kamera und Mikro fest auswählen (z. B. OBS-Kamera) –
 * die Auswahl wird gemerkt und fürs Match-Video verwendet. Der Test gibt die
 * Kamera nach 30 s bzw. beim Verlassen der Lobby wieder frei.
 */

type NetResult = { ms: number; verdict: "gut" | "ok" | "langsam" } | { failed: true };

type Status =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; cam: string; res: string; net: NetResult | null }
  | { kind: "error"; title: string; hint: string };

const AUTO_STOP_MS = 30_000;

function describeError(err: unknown): { title: string; hint: string } {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        title: "Zugriff im Browser blockiert",
        hint: "Auf das Kamera-Symbol links in der Adressleiste klicken → „Zulassen“, dann die Seite neu laden.",
      };
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return {
        title: "Keine Kamera oder kein Mikrofon gefunden",
        hint: "Windows erkennt kein Gerät. USB direkt am PC (kein Hub) testen, oder die Windows-App „Kamera“ öffnen – kein Bild = Treiber-/Hardwareproblem.",
      };
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return {
        title: "Kamera wird von einem anderen Programm benutzt",
        hint: "Nur ein Programm gleichzeitig: dartslive, OBS, Zoom, Teams, zweiter Browser-Tab … schließen und erneut testen.",
      };
    case "TypeError":
      return {
        title: "Kein sicherer Kontext (HTTPS)",
        hint: "Die Kamera geht nur über https://. Die Seite über die reguläre https-Adresse öffnen.",
      };
    default:
      return {
        title: "Kamera-Test fehlgeschlagen" + (name ? ` (${name})` : ""),
        hint: "Browser neu starten und erneut versuchen. Falls es weiter klemmt: am Handy spielen.",
      };
  }
}

/** Kurzer Latenz-Check zum Render-Server (grober Verbindungs-Indikator). */
async function checkNet(): Promise<NetResult> {
  const url = "https://doca-webdarts.onrender.com/health";
  const times: number[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return { failed: true };
      times.push(performance.now() - t0);
    }
  } catch {
    return { failed: true };
  }
  const ms = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  return { ms, verdict: ms < 120 ? "gut" : ms < 300 ? "ok" : "langsam" };
}

export function CameraCheck() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamIdState] = useState<string>(getCamDeviceId() ?? "");
  const [micId, setMicIdState] = useState<string>(getMicDeviceId() ?? "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      setCams(devs.filter((d) => d.kind === "videoinput"));
      setMics(devs.filter((d) => d.kind === "audioinput"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stop, [stop]);

  const run = useCallback(async () => {
    stop();
    setStatus({ kind: "testing" });
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("no getUserMedia"), { name: "TypeError" });
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camId ? { deviceId: { exact: camId } } : true,
        audio: micId ? { deviceId: { exact: micId } } : true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      await refreshDevices(); // Labels sind jetzt sichtbar

      const vt = stream.getVideoTracks()[0];
      const st = vt?.getSettings() ?? {};
      const res =
        st.width && st.height
          ? `${st.width}×${st.height}${st.frameRate ? ` @ ${Math.round(st.frameRate)} fps` : ""}`
          : "Auflösung unbekannt";
      const cam = vt?.label || "Kamera";

      setStatus({ kind: "ok", cam, res, net: null });
      void checkNet().then((net) =>
        setStatus((s) => (s.kind === "ok" ? { ...s, net } : s)),
      );

      timerRef.current = setTimeout(() => {
        stop();
        setStatus({ kind: "idle" });
      }, AUTO_STOP_MS);
    } catch (err) {
      stop();
      setStatus({ kind: "error", ...describeError(err) });
    }
  }, [stop, refreshDevices, camId, micId]);

  const onPickCam = (id: string) => {
    setCamIdState(id);
    setCamDeviceId(id || null);
    if (status.kind === "ok" || status.kind === "testing") void run();
  };
  const onPickMic = (id: string) => {
    setMicIdState(id);
    setMicDeviceId(id || null);
    if (status.kind === "ok" || status.kind === "testing") void run();
  };

  const running = status.kind === "ok" || status.kind === "testing";
  const dl = (navigator as { connection?: { downlink?: number } }).connection?.downlink ?? null;

  return (
    <div className="card stack camcheck">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          Kamera &amp; Mikro
        </h3>
        {running ? (
          <button
            className="ghost"
            onClick={() => {
              stop();
              setStatus({ kind: "idle" });
            }}
          >
            Test beenden
          </button>
        ) : (
          <button className="primary" onClick={run}>
            {status.kind === "error" ? "Nochmal testen" : "Test starten"}
          </button>
        )}
      </div>

      <div className="grid2">
        <label className="field">
          <span className="lbl">Kamera</span>
          <select value={camId} onChange={(e) => onPickCam(e.target.value)}>
            <option value="">Automatisch</option>
            {cams.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Kamera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="lbl">Mikrofon</span>
          <select value={micId} onChange={(e) => onPickMic(e.target.value)}>
            <option value="">Automatisch</option>
            {mics.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Mikrofon ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {cams.length > 0 && !cams[0]!.label && (
        <div className="hint">Gerätenamen erscheinen nach dem ersten „Test starten“.</div>
      )}

      <video
        ref={videoRef}
        className="camcheck-preview"
        muted
        playsInline
        hidden={!running}
      />

      {status.kind === "testing" && (
        <div className="hint">Frage Kamera an … bitte im Browser „Zulassen“ klicken.</div>
      )}

      {status.kind === "ok" && (
        <div className="camcheck-ok">
          ✓ Kamera &amp; Mikrofon funktionieren.
          <div className="hint" style={{ marginTop: 4 }}>
            <strong>{status.cam}</strong> · {status.res}
            {dl ? ` · ~${dl} Mbit/s` : ""}
            <br />
            Verbindung:{" "}
            {status.net === null
              ? "wird geprüft …"
              : "failed" in status.net
                ? "Server nicht erreichbar"
                : `${status.net.ms} ms (${status.net.verdict})`}
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <div className="camcheck-err">
          <strong>{status.title}</strong>
          <div className="hint" style={{ marginTop: 4 }}>
            {status.hint}
          </div>
        </div>
      )}
    </div>
  );
}
