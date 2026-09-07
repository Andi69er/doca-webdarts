import { useId, useState } from "react";
import { Modal } from "./Modal";

export function TeamNameModal({
  teamIndex,
  current,
  onKeep,
  onSave,
}: {
  teamIndex: number;
  current: string;
  onKeep: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(current);
  const trimmed = name.trim();
  const id = useId();

  return (
    <Modal title={`Teamname · ${teamIndex === 0 ? "Team A" : "Team B"}`} onClose={onKeep}>
      <p className="hint">
        Du bist Spieler 1 dieses Teams. Behalte den Namen oder gib einen eigenen ein.
      </p>
      <label className="field">
        <span className="lbl" id={id}>
          Teamname
        </span>
        <input
          autoFocus
          aria-labelledby={id}
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed) onSave(trimmed);
          }}
        />
      </label>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="ghost" onClick={onKeep}>
          Belassen
        </button>
        <button className="primary" disabled={!trimmed} onClick={() => onSave(trimmed)}>
          Speichern
        </button>
      </div>
    </Modal>
  );
}
