import { embed } from "../embed";

/** Dezente Logo-Leiste für Sponsoren & Partner (unter jeder Ansicht). */
export function SponsorStrip() {
  const items = embed?.sponsors ?? [];
  if (items.length === 0) return null;

  return (
    <div className="wd-sponsors" aria-label="Sponsoren & Partner">
      <span className="wd-sponsors-label">Präsentiert von</span>
      <div className="wd-sponsors-row">
        {items.map((s) => {
          const logo = (
            <img
              className="wd-sponsor-logo"
              src={s.logo}
              alt={s.name}
              title={s.name}
              loading="lazy"
            />
          );
          return s.url ? (
            <a
              key={s.name + s.logo}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.name}
            >
              {logo}
            </a>
          ) : (
            <span key={s.name + s.logo}>{logo}</span>
          );
        })}
      </div>
    </div>
  );
}
