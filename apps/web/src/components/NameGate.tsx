import { useState } from "react";
import type { AppApi } from "../useApp";

export function NameGate({ app }: { app: AppApi }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await app.setName(name.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hero-wrap">
      <div className="hero card glow">
        <h1 className="display">DOCA WEBDARTS</h1>
        <p className="lede">
          Online-Darts mit Fokus auf <strong>Doppel – 2 gegen 2</strong>. Vier Kameras,
          Mikrofone, gemeinsamer Scorer und Ausbullen. Trag dich mit einem Namen ein,
          dann kommst du in die Lobby: sehen wer online ist, im Chat ein Spiel ausmachen,
          Raum aufmachen, loslegen.
        </p>

        <label className="field">
          <span className="lbl">Dein Anzeigename</span>
          <input
            autoFocus
            value={name}
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="z.B. Andi"
          />
        </label>

        <button className="primary big" disabled={busy || !name.trim() || !app.connected} onClick={go}>
          {app.connected ? "In die Lobby" : "verbinde…"}
        </button>
      </div>
    </div>
  );
}
