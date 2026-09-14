import { legCount, legStats, type MatchState } from "@webdarts/engine";

type MetricKey = "average" | "first9Average" | "checkoutPct";

interface Point {
  leg: number;
  home: number;
  away: number;
}

function extractPoints(match: MatchState, metric: MetricKey): Point[] {
  const total = legCount(match);
  const points: Point[] = [];
  for (let i = 0; i < total; i++) {
    const st = legStats(match, i);
    if (st.teams[0].dartsThrown === 0 && st.teams[1].dartsThrown === 0) continue; // noch nicht begonnenes Leg
    points.push({ leg: i + 1, home: st.teams[0][metric], away: st.teams[1][metric] });
  }
  return points;
}

/** Eine einzelne kleine Liniendiagramm-Kachel für eine Kennzahl. */
function MiniChart({ title, points, unit = "" }: { title: string; points: Point[]; unit?: string }) {
  const W = 640;
  const H = 190;
  const padL = 40;
  const padR = 16;
  const padT = 14;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(10, ...points.flatMap((p) => [p.home, p.away])) * 1.15;
  const x = (i: number) => (points.length === 1 ? padL + plotW / 2 : padL + (i / (points.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxVal) * plotH;
  const path = (key: "home" | "away") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");
  const yTicks = [0, maxVal / 2, maxVal];

  return (
    <div className="stack" style={{ gap: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="var(--line-soft)" strokeWidth={1} />
            <text x={padL - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--muted)">
              {Math.round(t)}
              {unit}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">
            Leg {p.leg}
          </text>
        ))}
        <path d={path("home")} fill="none" stroke="var(--team-a)" strokeWidth={2.2} />
        <path d={path("away")} fill="none" stroke="var(--team-b)" strokeWidth={2.2} />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.home)} r={3.4} fill="var(--team-a)" />
            <circle cx={x(i)} cy={y(p.away)} r={3.4} fill="var(--team-b)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Formkurve übers Match: 3 Liniendiagramme (Average, First-9-Average,
 * Doppelquote) je Leg, für beide Teams - zeigt auf einen Blick "in diesem
 * Leg war ich besser, in jenem schlechter". Reines SVG, keine Chart-Library.
 */
export function LegChart({ match, names }: { match: MatchState; names: [string, string] }) {
  const avgPoints = extractPoints(match, "average");
  const f9Points = extractPoints(match, "first9Average");
  const coPoints = extractPoints(match, "checkoutPct");

  if (avgPoints.length === 0) {
    return <div className="hint">Noch keine Wurfdaten für eine Formkurve.</div>;
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
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
      <MiniChart title="Average" points={avgPoints} />
      <MiniChart title="First 9 Average" points={f9Points} />
      <MiniChart title="Doppelquote" points={coPoints} unit="%" />
    </div>
  );
}
