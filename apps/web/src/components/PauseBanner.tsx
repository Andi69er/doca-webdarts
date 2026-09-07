import { useEffect, useState } from "react";
import type { AppApi } from "../useApp";

function since(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function PauseBanner({ app, canResume }: { app: AppApi; canResume: boolean }) {
  const pause = app.room!.pause!;
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pause-banner" role="alert">
      <span className="pause-icon" aria-hidden="true">
        ⏸
      </span>
      <div className="pause-text">
        <strong>Spiel pausiert</strong>
        <span className="hint">
          {pause.manual && pause.byName ? `von ${pause.byName} ` : ""}
          {pause.waitingFor.length > 0 && `· warte auf ${pause.waitingFor.join(", ")} `}· {since(pause.since)}
        </span>
      </div>
      {canResume && pause.manual && (
        <button className="primary" onClick={app.resumeMatch}>
          ▶ Fortsetzen
        </button>
      )}
      {pause.waitingFor.length > 0 && !pause.manual && (
        <span className="hint">Setzt automatisch fort, sobald alle zurück sind.</span>
      )}
    </div>
  );
}
