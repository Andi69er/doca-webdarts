import { useEffect, useState } from "react";
import { Modal } from "./Modal";

/**
 * Checkdart-Abfrage nach einem Checkout: „Mit wie vielen Darts gecheckt?" und
 * „Wie viele Darts auf Doppel?" – analog zu darts-live / 2K.
 */
export function CheckoutDialog({
  score,
  onCancel,
  onConfirm,
}: {
  score: number;
  onCancel: () => void;
  onConfirm: (dartsUsed: number, doubleDarts: number) => void;
}) {
  const [dartsUsed, setDartsUsed] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 3) return;
      e.preventDefault();
      if (dartsUsed === null) setDartsUsed(n);
      else if (n <= dartsUsed) onConfirm(dartsUsed, n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dartsUsed, onConfirm]);

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
