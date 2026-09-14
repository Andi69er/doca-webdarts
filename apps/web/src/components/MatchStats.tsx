import { useState } from "react";
import {
  legCount,
  legStats,
  matchStats,
  scoreboard,
  type MatchState,
  type MatchStats as MatchStatsResult,
} from "@webdarts/engine";
import { Modal } from "./Modal";
import { LegChart } from "./LegChart";

/** Eine Statistik-Tabelle (Cricket oder X01) für ein gegebenes Ergebnis von
 *  matchStats()/legStats() - wiederverwendet für "ganzes Match" und für die
 *  einzelnen Leg-Ansichten, damit beide exakt gleich aussehen. */
function StatsTable({ result, names }: { result: MatchStatsResult; names: [string, string] }) {
  if (result.mode !== "x01") {
    return (
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
            <td>{result.teams[0].average.toFixed(2)}</td>
            <td>{result.teams[1].average.toFixed(2)}</td>
          </tr>
          <tr>
            <td>Punkte</td>
            <td>{result.teams[0].pointsScored}</td>
            <td>{result.teams[1].pointsScored}</td>
          </tr>
          <tr>
            <td>Darts</td>
            <td>{result.teams[0].dartsThrown}</td>
            <td>{result.teams[1].dartsThrown}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  const rows: [string, (n: 0 | 1) => string | number][] = [
    ["Match Ø", (n) => result.teams[n].average.toFixed(2)],
    ["First 9 Ø", (n) => result.teams[n].first9Average.toFixed(2)],
    [
      "Doppel",
      (n) =>
        `${result.teams[n].checkoutHits}/${result.teams[n].doubleDarts} (${result.teams[n].checkoutPct.toFixed(0)}%)`,
    ],
    ["19-", (n) => result.teams[n].b19minus],
    ["19+", (n) => result.teams[n].b19],
    ["38+", (n) => result.teams[n].b38],
    ["57+", (n) => result.teams[n].b57],
    ["76+", (n) => result.teams[n].b76],
    ["95+", (n) => result.teams[n].b95],
    ["133+", (n) => result.teams[n].b133],
    ["171+", (n) => result.teams[n].b171],
    ["180er", (n) => result.teams[n].b180],
    ["Short Leg", (n) => result.teams[n].shortestLegDarts ?? "—"],
    ["Highest Finish", (n) => result.teams[n].highestFinish || "—"],
    ["Ton+ Finishes", (n) => result.teams[n].tonPlusFinishes],
  ];

  return (
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
  );
}

export function MatchStats({ match }: { match: MatchState }) {
  const [open, setOpen] = useState(true);
  const [legModal, setLegModal] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(false);

  // Bei Einzel sagt "Team A/B" nichts aus - dort den echten Spielernamen zeigen.
  const isSingles = match.config.teamSize === 1;
  const sb = scoreboard(match);
  const names: [string, string] = isSingles
    ? [sb.teams[0]!.players[0] ?? match.teams[0]!.name, sb.teams[1]!.players[0] ?? match.teams[1]!.name]
    : [match.teams[0]!.name, match.teams[1]!.name];

  const total = legCount(match);
  const whole = matchStats(match);

  return (
    <div className="card stack">
      <button className="ghost" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(!open)}>
        Statistik {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="stack">
          {total > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {Array.from({ length: total }, (_, i) => (
                <button key={i} className="ghost" onClick={() => setLegModal(i)}>
                  Leg {i + 1}
                </button>
              ))}
              <button className="ghost" onClick={() => setShowChart(true)}>
                📊 Diagramm
              </button>
            </div>
          )}

          <StatsTable result={whole} names={names} />
        </div>
      )}

      {legModal !== null && (
        <Modal title={`Leg ${legModal + 1}`} onClose={() => setLegModal(null)} wide="x">
          <StatsTable result={legStats(match, legModal)} names={names} />
        </Modal>
      )}

      {showChart && (
        <Modal title="Formkurve übers Match" onClose={() => setShowChart(false)} wide="x">
          <LegChart match={match} names={names} />
        </Modal>
      )}
    </div>
  );
}
