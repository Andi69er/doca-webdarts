import type { CricketTarget, MatchState } from "@webdarts/engine";

const ROW_ORDER: CricketTarget[] = ["20", "19", "18", "17", "16", "15", "B"];
const MARK = ["", "/", "✕", "⊗"];

function label(t: CricketTarget): string {
  return t === "B" ? "Bull" : t;
}

export function CricketBoard({ match }: { match: MatchState }) {
  if (match.leg.mode !== "cricket") return null;
  const leg = match.leg;
  const names = match.teams.map((t) => t.name);

  return (
    <div className="card">
      <h3 className="section-title">Cricket</h3>
      <table className="cricket-table">
        <thead>
          <tr>
            <th>{names[0]}</th>
            <th aria-hidden="true" />
            <th>{names[1]}</th>
          </tr>
        </thead>
        <tbody>
          {ROW_ORDER.map((t) => {
            const m0 = leg.marks[0]![t];
            const m1 = leg.marks[1]![t];
            const closed = m0 >= 3 && m1 >= 3;
            return (
              <tr key={t} className={closed ? "closed" : ""}>
                <td className="mk">{MARK[Math.min(3, m0)]}</td>
                <th className="tgt">{label(t)}</th>
                <td className="mk">{MARK[Math.min(3, m1)]}</td>
              </tr>
            );
          })}
          <tr className="pts">
            <td>{leg.points[0]}</td>
            <th>Punkte</th>
            <td>{leg.points[1]}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
