import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

/**
 * Lokale Bildschirmaufnahme des Spiels (nur für Spieler).
 * Nimmt via getDisplayMedia den aktuellen Tab inkl. Ton auf, stoppt automatisch
 * am Matchende und fragt danach, ob die Videodatei gespeichert werden soll.
 * Läuft nur in Desktop-Browsern (Chrome/Edge am besten).
 */

type Status = "unsupported" | "idle" | "recording" | "review";

interface Finished {
  url: string;
  sizeMB: number;
  seconds: number;
  ext: string;
}

function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return "";
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function GameRecorder({ finished }: { finished: boolean }) {
  const [status, setStatus] = useState<Status>(() =>
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof MediaRecorder !== "undefined"
      ? "idle"
      : "unsupported",
  );
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Finished | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const lastUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stop = useCallback(() => {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  const start = useCallback(async () => {
    try {
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
        // Chrome/Edge: „Aktueller Tab" direkt anbieten
        preferCurrentTab: true,
      } as MediaStreamConstraints & { preferCurrentTab?: boolean });

      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickMimeType();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const type = mr.mimeType || mime || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        lastUrlRef.current = url;
        setResult({
          url,
          sizeMB: blob.size / (1024 * 1024),
          seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
          ext: type.includes("mp4") ? "mp4" : "webm",
        });
        setStatus("review");
        cleanupStream();
      };

      // Wenn der User oben in der Browser-Leiste „Freigabe beenden" klickt
      stream.getVideoTracks()[0]?.addEventListener("ended", stop);

      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(
        () => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)),
        1000,
      );
      mr.start(1000);
      setStatus("recording");
    } catch {
      // User hat abgebrochen o. Ä. – nichts tun
      cleanupStream();
      setStatus("idle");
    }
  }, [stop]);

  // Automatisch stoppen, sobald das Match beendet ist
  useEffect(() => {
    if (finished && status === "recording") stop();
  }, [finished, status, stop]);

  // Beim Verlassen: alles freigeben (ohne Nachfrage)
  useEffect(() => {
    return () => {
      recorderRef.current && recorderRef.current.state !== "inactive" && recorderRef.current.stop();
      cleanupStream();
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  const save = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `webdarts-${stamp()}.${result.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setResult(null);
    setStatus("idle");
  };

  const discard = () => {
    if (lastUrlRef.current) {
      URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    }
    setResult(null);
    setStatus("idle");
  };

  if (status === "unsupported") {
    return <span className="hint">Aufnahme: Browser nicht unterstützt</span>;
  }

  return (
    <>
      {status === "idle" && !finished && (
        <button className="ghost" onClick={start} title="Bildschirmaufnahme des Spiels">
          ⏺ Aufnahme
        </button>
      )}

      {status === "recording" && (
        <span className="rec-badge" role="status">
          <span className="rec-dot" aria-hidden="true" />
          <span>Aufnahme läuft · {fmtTime(elapsed)}</span>
          <button className="ghost" onClick={stop}>
            ⏹ Stoppen
          </button>
        </span>
      )}

      {status === "review" && result && (
        <Modal title="Aufnahme fertig" onClose={discard}>
          <p className="hint">
            Länge {fmtTime(result.seconds)} · ca. {result.sizeMB.toFixed(0)} MB ({result.ext.toUpperCase()})
          </p>
          <video src={result.url} controls className="rec-preview" />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="ghost" onClick={discard}>
              Verwerfen
            </button>
            <button className="primary" onClick={save}>
              Speichern
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
