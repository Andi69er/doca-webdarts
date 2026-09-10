import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kamera-/Mikro-Selbsttest für die Lobby.
 *
 * Sicherheitsnetz: Spieler prüfen VOR dem Match, ob der Browser an die Kamera
 * kommt – mit Klartext-Ursache, wenn nicht (blockiert / keine gefunden / von
 * anderem Programm belegt / kein HTTPS). Der Test gibt die Kamera nach spätestens
 * 30 s (oder beim Verlassen der Lobby) wieder frei, damit er das eigentliche
 * Match-Video nicht blockiert.
 */

type Status =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; cam: string; cams: number; mics: number }
  | { kind: "error"; title: string; hint: string };

const AUTO_STOP_MS = 30_000;

function describeError(err: unknown): { title: string; hint: string } {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        title: "Zugriff im Browser blockiert",
        hint: "Auf das Kamera-Symbol links in der Adressleiste klicken → „Zulassen“, dann die Seite neu laden. In Chrome/Edge zusätzlich unter Einstellungen → Datenschutz/Sicherheit → Website-Einstellungen → Kamera prüfen.",
      };
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return {
        title: "Keine Kamera oder kein Mikrofon gefunden",
        hint: "Windows selbst erkennt kein Gerät. USB-Kabel direkt am PC (kein Hub) testen, oder die Windows-App „Kamera“ öffnen – zeigt die auch kein Bild, ist es ein Treiber-/Hardwareproblem.",
      };
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return {
        title: "Kamera wird von einem anderen Programm benutzt",
        hint: "Nur ein Programm gleichzeitig: dartslive, OBS, Zoom, Teams, ein zweiter Browser-Tab … schließen und dann erneut testen.",
      };
    case "TypeError":
      return {
        title: "Kein sicherer Kontext (HTTPS)",
        hint: "Die Kamera geht nur über https://. Auf doca.at sollte das nicht vorkommen – ggf. die Seite über die reguläre https-Adresse öffnen.",
      };
    default:
      return {
        title: "Kamera-Test fehlgeschlagen" + (name ? ` (${name})` : ""),
        hint: "Bitte Browser neu starten und erneut versuchen. Falls es weiter klemmt: am Handy spielen – dort macht das Smartphone Kamera und Eingabe.",
      };
  }
}

export function CameraCheck() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Kamera beim Verlassen der Lobby / Unmount freigeben.
  useEffect(() => stop, [stop]);

  const run = useCallback(async () => {
    stop();
    setStatus({ kind: "testing" });
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("no getUserMedia"), { name: "TypeError" });
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      let cams = 0;
      let mics = 0;
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        cams = devs.filter((d) => d.kind === "videoinput").length;
        mics = devs.filter((d) => d.kind === "audioinput").length;
      } catch {
        /* egal – Zähler bleiben 0 */
      }
      const cam = stream.getVideoTracks()[0]?.label || "Kamera";
      setStatus({ kind: "ok", cam, cams, mics });
      timerRef.current = setTimeout(() => {
        stop();
        setStatus({ kind: "idle" });
      }, AUTO_STOP_MS);
    } catch (err) {
      stop();
      setStatus({ kind: "error", ...describeError(err) });
    }
  }, [stop]);

  return (
    <div className="card stack camcheck">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          Kamera &amp; Mikro testen
        </h3>
        {status.kind === "ok" || status.kind === "testing" ? (
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

      <div className="hint">
        Prüft, ob dein Browser an Kamera und Mikrofon kommt – <strong>bevor</strong> das Match läuft.
        Der Test gibt die Kamera danach automatisch wieder frei.
      </div>

      <video
        ref={videoRef}
        className="camcheck-preview"
        muted
        playsInline
        hidden={status.kind !== "ok" && status.kind !== "testing"}
      />

      {status.kind === "testing" && <div className="hint">Frage Kamera an … bitte im Browser „Zulassen“ klicken.</div>}

      {status.kind === "ok" && (
        <div className="camcheck-ok">
          ✓ Kamera &amp; Mikrofon funktionieren.
          <div className="hint" style={{ marginTop: 4 }}>
            Genutzt: <strong>{status.cam}</strong>
            {status.cams > 0 && ` · ${status.cams} Kamera(s), ${status.mics} Mikrofon(e) erkannt`}
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <div className="camcheck-err">
          <strong>{status.title}</strong>
          <div className="hint" style={{ marginTop: 4 }}>{status.hint}</div>
        </div>
      )}
    </div>
  );
}
