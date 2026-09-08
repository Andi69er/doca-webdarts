import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import type { PdcStar } from "../embed";

export interface BotPreset {
  key: string;
  label: string;
  average: number;
}

/**
 * Bot-Auswahl mit Vorschaubildern (Stufen-Bot, PDC-Stars).
 * Ein normales <select> kann keine Bilder – daher dieses eigene Menü.
 */
export function BotPicker({
  value,
  onChange,
  presets,
  pdcStars,
  botImage,
  baseUrl,
}: {
  value: string;
  onChange: (key: string) => void;
  presets: BotPreset[];
  pdcStars: PdcStar[];
  botImage: string | null;
  baseUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const starUrl = (s: PdcStar) => (s.image ? `${baseUrl}/${s.image}` : null);

  let current: { img: string | null; text: string };
  if (value === "none") current = { img: null, text: "Ohne Bot" };
  else if (value === "custom") current = { img: botImage, text: "Eigener Average…" };
  else if (value.startsWith("preset:")) {
    const p = presets.find((x) => x.key === value);
    current = { img: botImage, text: p ? p.label : "Bot" };
  } else {
    const s = pdcStars.find((x) => x.player === value.slice(4));
    current = s ? { img: starUrl(s), text: `${s.player} (Ø ${s.average.toFixed(1)})` } : { img: null, text: "Bot" };
  }

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  return (
    <div className="botpicker" ref={ref}>
      <button
        type="button"
        className="botpicker-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {value !== "none" && <Avatar src={current.img} name="🤖" size={22} />}
        <span className="botpicker-label">{current.text}</span>
        <span className="botpicker-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="botpicker-menu" role="listbox">
          <button type="button" className="botpicker-item" onClick={() => pick("none")}>
            Ohne Bot
          </button>

          <div className="botpicker-group">Stufe</div>
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`botpicker-item ${value === p.key ? "sel" : ""}`}
              onClick={() => pick(p.key)}
            >
              <Avatar src={botImage} name="🤖" size={26} />
              <span>{p.label}</span>
            </button>
          ))}

          {pdcStars.length > 0 && (
            <>
              <div className="botpicker-group">Gegen PDC-Star</div>
              {pdcStars.map((s) => (
                <button
                  key={s.player}
                  type="button"
                  className={`botpicker-item ${value === `pdc:${s.player}` ? "sel" : ""}`}
                  onClick={() => pick(`pdc:${s.player}`)}
                >
                  <Avatar src={starUrl(s)} name={s.player} size={30} />
                  <span>
                    {s.player} <span className="botpicker-avg">Ø {s.average.toFixed(1)}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          <div className="botpicker-group">Experte</div>
          <button
            type="button"
            className={`botpicker-item ${value === "custom" ? "sel" : ""}`}
            onClick={() => pick("custom")}
          >
            <Avatar src={botImage} name="🤖" size={26} />
            <span>Eigener Average…</span>
          </button>
        </div>
      )}
    </div>
  );
}
