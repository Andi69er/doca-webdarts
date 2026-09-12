import type { TournamentDetail, TournamentPairing } from "@webdarts/engine";

type Round = TournamentDetail["rounds"][number];

/** Anzeigetext für eine Baum-Seite, solange der Teilnehmer noch nicht
 *  feststeht: "Freilos" bei einem Bye, sonst Sieger/Verlierer eines
 *  Vorgänger-Spiels (KO->KO, aus homeSourceGameNr/-Winner) oder ein
 *  Klartext-Platz aus der Gruppenphase (GROUP->KO, aus homeSourceName wie
 *  "1. Gruppe 1"). Auch für die normale Paarungsliste außerhalb des Baums
 *  verwendet (TournamentLobby/TournamentPage) - 3K liefert für einen
 *  unaufgelösten Slot nur ein rohes "?", ohne dabei zwischen "echtes Freilos"
 *  und "wartet auf Vorrunde" zu unterscheiden; das übernehmen wir hier. */
export function slotLabel(
  name: string,
  bye: boolean,
  sourceGameNr: number | null,
  sourceWinner: boolean | null,
  sourceName: string | null,
): string {
  if (bye) return "spielfrei";
  if (name && name !== "?") return name;
  if (sourceGameNr !== null) return `${sourceWinner === false ? "Verlierer" : "Sieger"} Spiel ${sourceGameNr}`;
  if (sourceName) return sourceName;
  return "?";
}

function BracketMatch({ p }: { p: TournamentPairing }) {
  const home = slotLabel(p.homeName, p.byeHome, p.homeSourceGameNr, p.homeSourceWinner, p.homeSourceName);
  const away = slotLabel(p.awayName, p.byeAway, p.awaySourceGameNr, p.awaySourceWinner, p.awaySourceName);
  const finished = p.status === "finished";
  const homeWon = finished && (p.legsHome ?? 0) > (p.legsAway ?? 0);
  const awayWon = finished && (p.legsAway ?? 0) > (p.legsHome ?? 0);
  return (
    <div className="bracket-match">
      <div className="bracket-gamenr">
        Spiel {p.gameNr}
        {p.status === "live" && <span className="bracket-live"> · 🔴 läuft</span>}
      </div>
      <div className={`bracket-slot ${homeWon ? "won" : ""}`}>
        <span className="bracket-name">{home}</span>
        {finished && <span className="bracket-score">{p.legsHome ?? "?"}</span>}
      </div>
      <div className={`bracket-slot ${awayWon ? "won" : ""}`}>
        <span className="bracket-name">{away}</span>
        {finished && <span className="bracket-score">{p.legsAway ?? "?"}</span>}
      </div>
    </div>
  );
}

function BracketSection({ title, rounds }: { title: string | null; rounds: Round[] }) {
  const sorted = [...rounds].sort((a, b) => a.index - b.index);
  return (
    <div className="bracket-section">
      {title && <div className="bracket-section-title">{title}</div>}
      <div className="bracket-columns">
        {sorted.map((r) => (
          <div key={r.roundId} className="bracket-column">
            <div className="bracket-column-title">{r.name}</div>
            <div className="bracket-column-matches">
              {r.pairings.map((p) => (
                <BracketMatch key={p.matchId} p={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Turnierbaum, angelehnt an 3K's eigene KO-Baum-Ansicht
 * (portal.3k-darts.com/.../ko/tree). Diese Ansicht ist bei 3K rein
 * clientseitig gezeichnet, es gibt keinen eigenen Baum-Endpoint - wir bauen
 * die Kanten selbst aus den Match-Feldern zusammen: playerHomeSourceGameNr
 * + playerHomeSourceWinner zeigen bei einem KO->KO-Übergang auf das
 * Vorgänger-Spiel (Sieger oder Verlierer davon), sourceNameHome/Guest liefert
 * bei einem GROUP->KO-Übergang schon einen fertigen Text (z.B. "1. Gruppe 1").
 *
 * Funktioniert generisch für einfachen wie doppelten K.o.: Runden mit
 * groupCd "WINNER_BRACKET"/"LOSER_BRACKET" (Doppel-K.o.) werden als zwei
 * Sektionen untereinander gezeigt, alles ohne groupCd (einfacher K.o.,
 * Platzierungsspiele wie "Spiel um Platz 3") als eigene Sektion mit dem
 * echten 3K-Rundennamen - 3K's eigene Baum-Ansicht hat für Platz 3 gar
 * keine Beschriftung, bei uns steht einfach der Rundenname da.
 */
export function TournamentBracket({ rounds }: { rounds: Round[] }) {
  const koRounds = rounds.filter((r) => r.typeCd === "KO" && r.pairings.length > 0);
  if (koRounds.length === 0) {
    return <div className="hint">Noch kein Turnierbaum bei 3K hinterlegt.</div>;
  }
  const winner = koRounds.filter((r) => r.groupCd === "WINNER_BRACKET");
  const loser = koRounds.filter((r) => r.groupCd === "LOSER_BRACKET");
  const plain = koRounds.filter((r) => r.groupCd !== "WINNER_BRACKET" && r.groupCd !== "LOSER_BRACKET");
  const isDouble = winner.length > 0 || loser.length > 0;

  return (
    <div className="stack bracket-wrap">
      {winner.length > 0 && <BracketSection title="Gewinnerseite" rounds={winner} />}
      {loser.length > 0 && <BracketSection title="Verliererseite" rounds={loser} />}
      {plain.length > 0 && <BracketSection title={isDouble ? "Platzierung" : null} rounds={plain} />}
    </div>
  );
}
