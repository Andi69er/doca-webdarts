import { legCount, legStats, type MatchState } from "@webdarts/engine";

/**
 * Formkurve übers Match: Liniendiagramm mit dem 3-Dart-Average je Leg, für
 * beide Teams - zeigt auf einen Blick "in diesem Leg war ich besser, in
 * jenem schlechter" statt nur den einen Gesamt-Average. Reines SVG, keine
 * Chart-Library (Bundle ist eh schon groß).
 */
export function LegChart({ match, names }: { match: MatchState; names: [string, string] }) {
  const total = legCount(match);
  const points: { leg: number; home: number; away: number }[] = [];
  for (let i = 0; i < total; i++) {
    const st = legStats(match, i);
    const home = st.teams[0].average;
    const away = st.teams[1].average;
    if (st.teams[0].dartsThrown === 0 && st.teams[1].dartsThrown === 0) continue; // noch nicht begonnenes Leg
    points.push({ leg: i + 1, home, away });
  }

  if (points.length === 0) {
    return <div className="hint">Noch keine Wurfdaten für eine Formkurve.</div>;
  }

  const W = 640;
  const H = 320;
  const padL = 44;
  const padR = 20;
  const padT = 20;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(10, ...points.flatMap((p) => [p.home, p.away])) * 1.1;
  const x = (i: number) => (points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const path = (key: "home" | "away") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");

  // Grobe Y-Achsen-Marken (0, 1/3, 2/3, max).
  const yTicks = [0, maxVal / 3, (maxVal / 3) * 2, maxVal];

  return (
    <div className="stack">
      <div className="row" style={{ gap: 16, fontSize: 13 }}>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--team-a)", display: "inline-block" }} />
          {names[0]}
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--team-b)", display: "inline-block" }} />
          {names[1]}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="var(--line-soft)" strokeWidth={1} />
            <text x={padL - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted)">
              {t.toFixed(0)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--muted)">
            Leg {p.leg}
          </text>
        ))}
        <path d={path("home")} fill="none" stroke="var(--team-a)" strokeWidth={2.5} />
        <path d={path("away")} fill="none" stroke="var(--team-b)" strokeWidth={2.5} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.home)} r={4} fill="var(--team-a)" />
            <circle cx={x(i)} cy={y(p.away)} r={4} fill="var(--team-b)" />
            <text x={x(i)} y={y(p.home) - 10} textAnchor="middle" fontSize={11} fill="var(--team-a)">
              {p.home.toFixed(1)}
            </text>
            <text x={x(i)} y={y(p.away) + 20} textAnchor="middle" fontSize={11} fill="var(--team-b)">
              {p.away.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
