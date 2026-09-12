import { useCallback, useEffect, useRef, useState } from "react";
import {
  bullFinishPossible,
  findCheckout,
  scoreboard,
  type Dart,
  type Multiplier,
  type MatchState,
} from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { CheckoutDialog } from "./CheckoutDialog";
import { BullFinishDialog } from "./BullFinishDialog";

function dartLabel(d: Dart): string {
  if (d.value === 0) return "Miss";
  if (d.value === 25) return d.multiplier === 2 ? "Bull" : "25";
  return (d.multiplier === 1 ? "" : d.multiplier === 2 ? "D" : "T") + d.value;
}

export function DartInput({ app, paused = false }: { app: AppApi; paused?: boolean }) {
  const match = app.room!.match as MatchState;
  const finished = match.phase === "finished";
  const isCricket = match.config.mode === "cricket";

  const sb = scoreboard(match);
  const remaining = sb.thrower ? sb.teams[sb.thrower.teamIndex]!.score : 0;
  const myTurn = !finished && !paused && sb.thrower?.playerId === app.myId;

  // -------- X01: Endsumme über Tastatur / Zahlenblock --------
  const [entry, setEntry] = useState("");
  const entryRef = useRef("");
  entryRef.current = entry;
  const typed = Number(entry || "0");
  const isCheckout = !isCricket && typed > 0 && typed === remaining;
  const outMode = match.config.x01?.out ?? "double";
  const [checkoutScore, setCheckoutScore] = useState<number | null>(null);
  // Checkdart-Abfrage ohne Leg-Ende: Rest VOR der Aufnahme war ein mögliches Finish.
  const [attemptScore, setAttemptScore] = useState<number | null>(null);
  // Bullfinish-Rückfrage, nachdem Darts/Doppel-Darts eines Checkouts bekannt sind.
  const [pendingBull, setPendingBull] = useState<{ score: number; darts: number; doubleDarts: number } | null>(
    null,
  );

  const finishRecord = useCallback(
    async (score: number, darts: number, doubleDarts: number) => {
      if (doubleDarts >= 1 && bullFinishPossible(score, darts)) {
        setPendingBull({ score, darts, doubleDarts });
        return;
      }
      await app.dispatch({ type: "RECORD_SCORE", score, darts, finishedOnDouble: true, doubleDarts });
    },
    [app],
  );

  const answerBull = async (bullFinish: boolean) => {
    if (!pendingBull) return;
    const { score, darts, doubleDarts } = pendingBull;
    setPendingBull(null);
    await app.dispatch({ type: "RECORD_SCORE", score, darts, finishedOnDouble: true, doubleDarts, bullFinish });
  };

  const press = useCallback((d: string) => {
    setEntry((e) => {
      if (e.length >= 3) return e;
      const next = e === "0" ? d : e + d;
      return Number(next) > 180 ? e : next;
    });
  }, []);
  const del = useCallback(() => setEntry((e) => e.slice(0, -1)), []);
  const book = useCallback(async () => {
    const val = entryRef.current;
    if (val === "") return;
    const score = Number(val);
    if (!isCricket && score > 0 && score === remaining) {
      // Leg beendet. Geht das Finish NUR mit 3 Darts (kein 2-Dart-Weg)? Dann ist
      // die Aufnahme eindeutig 3 Darts / 1 Dart aufs Doppel → keine Rückfrage.
      const twoDartRoute = findCheckout(score, 2, outMode);
      if (!twoDartRoute) {
        setEntry("");
        await finishRecord(score, 3, outMode === "double" ? 1 : 0);
        return;
      }
      // Sonst: volle Checkdart-Abfrage (Darts zum Checkout + Darts auf Doppel)
      setCheckoutScore(score);
      return;
    }
    if (!isCricket && findCheckout(remaining, 3, outMode) !== null) {
      // Kein Leg-Ende, aber der Rest VOR der Aufnahme war ein mathematisch
      // mögliches Finish (Rest ≤ 170, keine Bogey-Zahl) → nur nach den Darts
      // aufs Doppel fragen (0–3), auch bei 0 Punkten oder Bust.
      setAttemptScore(score);
      return;
    }
    await app.dispatch({ type: "RECORD_SCORE", score, darts: 3, finishedOnDouble: false });
    setEntry("");
  }, [app, isCricket, remaining, outMode]);

  const confirmCheckout = async (dartsUsed: number, doubleDarts: number) => {
    if (checkoutScore === null) return;
    const score = checkoutScore;
    setCheckoutScore(null);
    setEntry("");
    await finishRecord(score, dartsUsed, doubleDarts);
  };

  const confirmAttempt = async (_dartsUsed: number, doubleDarts: number) => {
    if (attemptScore === null) return;
    await app.dispatch({
      type: "RECORD_SCORE",
      score: attemptScore,
      darts: 3,
      finishedOnDouble: false,
      doubleDarts,
    });
    setAttemptScore(null);
    setEntry("");
  };

  // Physische Tastatur: Ziffern, Rücktaste, Enter – nur wenn ich am Wurf bin
  // (pausiert, solange die Checkdart-Abfrage offen ist)
  useEffect(() => {
    if (isCricket || !myTurn || checkoutScore !== null || attemptScore !== null || pendingBull !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (finished) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        del();
      } else if (e.key === "Enter") {
        e.preventDefault();
        book();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCricket, myTurn, finished, checkoutScore, attemptScore, pendingBull, press, del, book]);

  // -------- Cricket: Dart für Dart --------
  const [mult, setMult] = useState<Multiplier>(1);
  const [visit, setVisit] = useState<Dart[]>([]);
  const addDart = (value: number) => {
    if (visit.length >= 3) return;
    setVisit([...visit, { value, multiplier: value === 0 ? 1 : mult }]);
    setMult(1);
  };
  const bookVisit = async () => {
    if (visit.length === 0) return;
    await app.dispatch({ type: "RECORD_VISIT", darts: visit });
    setVisit([]);
  };

  if (finished) {
    return (
      <div className="card stack">
        <h3 className="section-title">Eingabe</h3>
        <div className="hint">Match beendet. Host kann zurücksetzen.</div>
        <button className="ghost" onClick={app.undo}>
          ↶ Letzte Aufnahme rückgängig
        </button>
      </div>
    );
  }

  if (paused) {
    return (
      <div className="card stack input-locked">
        <h3 className="section-title">Pausiert</h3>
        <div className="lock-line">
          <span className="lock-icon">⏸</span>
          <span>Die Eingabe ist gesperrt, solange das Spiel pausiert ist.</span>
        </div>
      </div>
    );
  }

  if (!myTurn) {
    return (
      <div className="card stack input-locked">
        <h3 className="section-title">Eingabe gesperrt</h3>
        <div className="lock-line">
          <span className="lock-icon">⏳</span>
          <span>
            <strong>{sb.thrower?.playerName ?? "—"}</strong> ist am Wurf.
          </span>
        </div>
        <div className="hint">Deine Eingabe wird freigeschaltet, sobald du dran bist.</div>
        <button className="ghost" onClick={app.undo}>
          ↶ Letzte Aufnahme rückgängig
        </button>
      </div>
    );
  }

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 className="section-title">Du bist am Wurf</h3>
        <button className="ghost" onClick={app.undo}>
          ↶ Undo
        </button>
      </div>

      {!isCricket ? (
        <div className="stack">
          <div
            className={`numpad-display ${isCheckout ? "checkout" : ""}`}
            role="status"
            aria-live="polite"
          >
            {entry === "" ? "0" : entry}
            {isCheckout && <span className="numpad-tag">Checkout</span>}
          </div>
          <div className="numpad">
            {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((d) => (
              <button key={d} disabled={finished} onClick={() => press(d)}>
                {d}
              </button>
            ))}
            <button className="ghost" disabled={finished} onClick={del} aria-label="Letzte Ziffer löschen">
              ⌫
            </button>
            <button disabled={finished} onClick={() => press("0")}>
              0
            </button>
            <button
              className="primary"
              disabled={finished || entry === ""}
              onClick={book}
              aria-label="Aufnahme buchen"
            >
              ✓
            </button>
          </div>
          <div className="hint">Endsumme tippen (Tastatur oder Block) – Enter / ✓ bucht.</div>
        </div>
      ) : (
        <div className="stack">
          <div className="row mult-row">
            {([1, 2, 3] as Multiplier[]).map((m) => (
              <button
                key={m}
                className={mult === m ? "active" : ""}
                onClick={() => setMult(m)}
                disabled={finished}
              >
                {m === 1 ? "Single" : m === 2 ? "Double" : "Triple"}
              </button>
            ))}
          </div>
          <div className="pad">
            {[15, 16, 17, 18, 19, 20].map((n) => (
              <button key={n} disabled={finished || visit.length >= 3} onClick={() => addDart(n)}>
                {n}
              </button>
            ))}
            <button disabled={finished || visit.length >= 3} onClick={() => addDart(25)}>
              Bull
            </button>
            <button disabled={finished || visit.length >= 3} onClick={() => addDart(0)}>
              Miss
            </button>
          </div>
          <div className="visit-preview">
            {visit.length === 0 && <span className="hint">noch keine Darts…</span>}
            {visit.map((d, i) => (
              <span key={i} className="chip" onClick={() => setVisit(visit.filter((_, j) => j !== i))}>
                {dartLabel(d)} ✕
              </span>
            ))}
          </div>
          <div className="row">
            <button className="primary" disabled={finished || visit.length === 0} onClick={bookVisit}>
              Aufnahme buchen ({visit.length})
            </button>
            <button className="ghost" disabled={visit.length === 0} onClick={() => setVisit([])}>
              leeren
            </button>
          </div>
        </div>
      )}

      {checkoutScore !== null && (
        <CheckoutDialog
          score={checkoutScore}
          onCancel={() => setCheckoutScore(null)}
          onConfirm={confirmCheckout}
        />
      )}

      {attemptScore !== null && (
        <CheckoutDialog
          score={remaining}
          mode="attempts"
          onCancel={() => setAttemptScore(null)}
          onConfirm={confirmAttempt}
        />
      )}

      {pendingBull && <BullFinishDialog score={pendingBull.score} onAnswer={answerBull} />}
    </div>
  );
}
