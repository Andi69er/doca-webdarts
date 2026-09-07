import { useState } from "react";
import { matchStats, type MatchState } from "@webdarts/engine";

export function MatchStats({ match }: { match: MatchState }) {
  const [open, setOpen] = useState(true);
  const st = matchStats(match);
  const names = match.teams.map((t) => t.name);

  if (st.mode !== "x01") {
    return (
      <div className="card stack">
        <h3 className="section-title">Statistik</h3>
        <table className="stat-table">
          <thead>
            <tr>
              <th />
              <th>{names[0]}</th>
              <th>{names[1]}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MPR (Marks/Runde)</td>
              <td>{st.teams[0]!.average.toFixed(2)}</td>
              <td>{st.teams[1]!.average.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Punkte</td>
              <td>{st.teams[0]!.pointsScored}</td>
              <td>{st.teams[1]!.pointsScored}</td>
            </tr>
            <tr>
              <td>Darts</td>
              <td>{st.teams[0]!.dartsThrown}</td>
              <td>{st.teams[1]!.dartsThrown}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const rows: [string, (n: 0 | 1) => string | number][] = [
    ["Match Ø", (n) => st.teams[n]!.average.toFixed(2)],
    ["First 9 Ø", (n) => st.teams[n]!.first9Average.toFixed(2)],
    [
      "Doppel",
      (n) => `${st.teams[n]!.checkoutHits}/${st.teams[n]!.doubleDarts} (${st.teams[n]!.checkoutPct.toFixed(0)}%)`,
    ],
    ["19-", (n) => st.teams[n]!.b19minus],
    ["19+", (n) => st.teams[n]!.b19],
    ["38+", (n) => st.teams[n]!.b38],
    ["57+", (n) => st.teams[n]!.b57],
    ["76+", (n) => st.teams[n]!.b76],
    ["95+", (n) => st.teams[n]!.b95],
    ["133+", (n) => st.teams[n]!.b133],
    ["171+", (n) => st.teams[n]!.b171],
    ["180er", (n) => st.teams[n]!.b180],
    ["Short Leg", (n) => st.teams[n]!.shortestLegDarts ?? "—"],
    ["Highest Finish", (n) => st.teams[n]!.highestFinish || "—"],
    ["Ton+ Finishes", (n) => st.teams[n]!.tonPlusFinishes],
  ];

  return (
    <div className="card stack">
      <button className="ghost" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(!open)}>
        Statistik {open ? "▾" : "▸"}
      </button>
      {open && (
        <table className="stat-table">
          <thead>
            <tr>
              <th />
              <th>{names[0]}</th>
              <th>{names[1]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{get(0)}</td>
                <td>{get(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
