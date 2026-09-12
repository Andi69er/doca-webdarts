import { useState } from "react";
import type { GameMode, InOutMode, MatchConfig } from "@webdarts/engine";

/** Minimal-Formular fürs Turnier-Matchprofil (Admin). Bewusst schlank – kein
 *  Ausbullen-nach-X-Runden/2-Clear-Legs, das lässt sich bei Bedarf später
 *  ergänzen, sobald ein Turnier das braucht. */
export function TournamentProfileForm({
  initial,
  isDouble,
  onSave,
  onCancel,
}: {
  initial: MatchConfig | null;
  /** 3K eventKindCd === "DOUBLE" – bestimmt teamSize, keine Wahl fürs Admin-Formular. */
  isDouble: boolean;
  onSave: (config: MatchConfig) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<GameMode>(initial?.mode ?? "x01");
  const [startScore, setStartScore] = useState(initial?.x01?.startScore ?? 501);
  const [out, setOut] = useState<InOutMode>(initial?.x01?.out ?? "double");
  const [inMode, setInMode] = useState<InOutMode>(initial?.x01?.in ?? "straight");
  const [legsToWinSet, setLegsToWinSet] = useState(initial?.legsToWinSet ?? 3);
  const [setsToWin, setSetsToWin] = useState(initial?.setsToWin ?? 1);
  const [bullOff, setBullOff] = useState(initial?.bullOff ?? true);

  // Anzeige-/Eingabehilfe für die Spiellänge: "First to N" oder "Best of N"
  // (wie im normalen Raum-Setup) - gespeichert wird immer die Siegzahl.
  const [legFmt, setLegFmt] = useState<"firstto" | "bestof">("firstto");
  const [setFmt, setSetFmt] = useState<"firstto" | "bestof">("firstto");
  const toWins = (fmt: "firstto" | "bestof", n: number, cap: number) => {
    const raw = fmt === "bestof" ? Math.ceil((Number(n) || 1) / 2) : Number(n) || 1;
    return Math.min(cap, Math.max(1, raw));
  };
  const fromWins = (fmt: "firstto" | "bestof", w: number) =>
    fmt === "bestof" ? Math.max(1, w) * 2 - 1 : Math.max(1, w);
  const usesSets = setsToWin > 1;

  const save = () => {
    const config: MatchConfig = {
      mode,
      x01: { startScore, out, in: inMode },
      cricket: { variant: "standard" },
      legsToWinSet: Math.max(1, Math.round(legsToWinSet)),
      setsToWin: Math.max(1, Math.round(setsToWin)),
      bullOff,
      twoClearLegs: false,
      legBulloffRounds: 0,
      teamSize: isDouble ? 2 : 1,
    };
    onSave(config);
  };

  return (
    <div className="stack">
      <div className="hint">{isDouble ? "Doppel-Turnier – Räume werden automatisch 2v2 angelegt." : "Einzel-Turnier."}</div>
      <div className="field">
        <span className="lbl">Spielart</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as GameMode)}>
          <option value="x01">X01</option>
          <option value="cricket">Cricket</option>
        </select>
      </div>

      {mode === "x01" && (
        <>
          <div className="field">
            <span className="lbl">Startpunkte</span>
            <select value={startScore} onChange={(e) => setStartScore(Number(e.target.value))}>
              <option value={301}>301</option>
              <option value={501}>501</option>
              <option value={701}>701</option>
            </select>
          </div>
          <div className="field">
            <span className="lbl">Finish (Out)</span>
            <select value={out} onChange={(e) => setOut(e.target.value as InOutMode)}>
              <option value="double">Double-Out</option>
              <option value="master">Master-Out</option>
              <option value="straight">Straight-Out</option>
            </select>
          </div>
          <div className="field">
            <span className="lbl">Eröffnung (In)</span>
            <select value={inMode} onChange={(e) => setInMode(e.target.value as InOutMode)}>
              <option value="straight">Straight-In</option>
              <option value="double">Double-In</option>
              <option value="master">Master-In</option>
            </select>
          </div>
        </>
      )}

      <div className="field">
        <span className="lbl">Sätze (0 = ohne)</span>
        <div className="row" style={{ gap: 6 }}>
          <select
            value={setFmt}
            onChange={(e) => setSetFmt(e.target.value as "firstto" | "bestof")}
            style={{ flex: "0 0 auto" }}
          >
            <option value="firstto">First to</option>
            <option value="bestof">Best of</option>
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={setFmt === "bestof" ? 25 : 13}
            value={usesSets ? fromWins(setFmt, setsToWin) : 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              setSetsToWin(n <= 0 ? 1 : toWins(setFmt, n, 13));
            }}
            style={{ width: 64 }}
          />
        </div>
      </div>

      <div className="field">
        <span className="lbl">{usesSets ? "Legs pro Satz" : "Legs"}</span>
        <div className="row" style={{ gap: 6 }}>
          <select
            value={legFmt}
            onChange={(e) => setLegFmt(e.target.value as "firstto" | "bestof")}
            style={{ flex: "0 0 auto" }}
          >
            <option value="firstto">First to</option>
            <option value="bestof">Best of</option>
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={legFmt === "bestof" ? 41 : 21}
            value={fromWins(legFmt, legsToWinSet)}
            onChange={(e) => setLegsToWinSet(toWins(legFmt, Number(e.target.value), 21))}
            style={{ width: 64 }}
          />
        </div>
      </div>

      <div className="hint">
        {usesSets ? (
          <>
            First to <strong>{setsToWin}</strong> Sätze · je Satz First to <strong>{legsToWinSet}</strong> Legs.
          </>
        ) : (
          <>
            First to <strong>{legsToWinSet}</strong> Legs (= Best of {legsToWinSet * 2 - 1}).
          </>
        )}
      </div>

      <div className="lobby-opt">
        <input
          id="tprofile-bulloff"
          type="checkbox"
          checked={bullOff}
          onChange={(e) => setBullOff(e.target.checked)}
        />
        <label htmlFor="tprofile-bulloff" className="lobby-opt-main">
          Vor dem ersten Leg ausbullen
        </label>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button className="ghost" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="primary" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  );
}
