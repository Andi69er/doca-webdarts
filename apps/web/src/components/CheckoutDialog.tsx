import { useEffect, useState } from "react";
import { Modal } from "./Modal";

/**
 * Checkdart-Abfrage – analog zu darts-live / 2K.
 *
 * `mode = "checkout"`  → das Leg wurde beendet: „Mit wie vielen Darts gecheckt?"
 *                        und danach „Wie viele davon auf Doppel?".
 * `mode = "attempts"`  → das Leg läuft weiter, aber der Rest VOR der Aufnahme war
 *                        ein mathematisch mögliches Finish: nur „Wie viele Darts
 *                        auf Doppel?" (0–3) – für eine korrekte Doppelquote.
 */
export function CheckoutDialog({
  score,
  mode = "checkout",
  onCancel,
  onConfirm,
}: {
  /** mode "checkout": Checkout-Höhe. mode "attempts": Rest vor der Aufnahme. */
  score: number;
  mode?: "checkout" | "attempts";
  onCancel: () => void;
  onConfirm: (dartsUsed: number, doubleDarts: number) => void;
}) {
  const [dartsUsed, setDartsUsed] = useState<number | null>(mode === "attempts" ? 3 : null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (mode === "attempts") {
        if (!Number.isInteger(n) || n < 0 || n > 3) return;
        e.preventDefault();
        onConfirm(3, n);
        return;
      }
      if (!Number.isInteger(n) || n < 1 || n > 3) return;
      e.preventDefault();
      if (dartsUsed === null) setDartsUsed(n);
      else if (n <= dartsUsed) onConfirm(dartsUsed, n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dartsUsed, onConfirm, mode]);

  if (mode === "attempts") {
    return (
      <Modal title={`Rest ${score} – Checkdart`} onClose={onCancel}>
        <div className="field">
          <span className="lbl" id="cd-double">
            Wie viele Darts auf Doppel?
          </span>
          <div className="checkdart-row" role="group" aria-labelledby="cd-double">
            {[0, 1, 2, 3].map((d) => (
              <button key={d} className="primary" onClick={() => onConfirm(3, d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <button className="ghost" onClick={onCancel}>
          Abbrechen
        </button>
      </Modal>
    );
  }

  return (
    <Modal title={`Checkout ${score}`} onClose={onCancel}>
      <div className="field">
        <span className="lbl" id="cd-darts">
          Mit wie vielen Darts gecheckt?
        </span>
        <div className="checkdart-row" role="group" aria-labelledby="cd-darts">
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              className={dartsUsed === d ? "primary" : ""}
              aria-pressed={dartsUsed === d}
              onClick={() => setDartsUsed(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {dartsUsed !== null && (
        <div className="field">
          <span className="lbl" id="cd-double">
            Wie viele Darts auf Doppel?
          </span>
          <div className="checkdart-row" role="group" aria-labelledby="cd-double">
            {Array.from({ length: dartsUsed }, (_, i) => i + 1).map((d) => (
              <button key={d} className="primary" onClick={() => onConfirm(dartsUsed, d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="ghost" onClick={onCancel}>
        Abbrechen
      </button>
    </Modal>
  );
}
