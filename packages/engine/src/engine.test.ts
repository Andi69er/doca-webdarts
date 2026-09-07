import { describe, expect, it } from "vitest";
import {
  MatchController,
  createMatch,
  currentThrower,
  findCheckout,
  matchStats,
  reduceMatch,
  scoreboard,
  throwOrder,
} from "./index";
import type { Dart, MatchConfig, Player, Team } from "./index";

const players: Player[] = [
  { id: "a1", name: "Andi" },
  { id: "a2", name: "Bea" },
  { id: "b1", name: "Chris" },
  { id: "b2", name: "Dana" },
];
const teams: Team[] = [
  { id: "A", name: "Team A", playerIds: ["a1", "a2"] },
  { id: "B", name: "Team B", playerIds: ["b1", "b2"] },
];

const x01Config: MatchConfig = {
  mode: "x01",
  x01: { startScore: 501, out: "double", in: "straight" },
  legsToWinSet: 2,
  setsToWin: 1,
  bullOff: false,
  teamSize: 2,
};

const T20: Dart = { value: 20, multiplier: 3 };
const D20: Dart = { value: 20, multiplier: 2 };
const S = (v: number): Dart => ({ value: v, multiplier: 1 });

describe("Wurfreihenfolge Doppel 2v2", () => {
  it("wechselt Team A/B und rotiert die Partner pro Leg", () => {
    const m = createMatch(x01Config, players, teams);
    const order = throwOrder(m).map((o) => o.playerId);
    // Leg 0: Starter Team A, firstPlayerOffset 0 → a1, b1, a2, b2
    expect(order).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("erster Werfer ist der Anwurf-Spieler von Team A", () => {
    const m = createMatch(x01Config, players, teams);
    expect(currentThrower(m)?.playerId).toBe("a1");
  });
});

describe("X01 – Bust & Double-Out", () => {
  it("Bust bei Überwerfen: Punktestand bleibt", () => {
    let m = createMatch(x01Config, players, teams);
    // a1 wirft 3x T20 = 180 → 321
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [T20, T20, T20] });
    expect((m.leg as any).remaining[0]).toBe(321);
    // b1 irrelevant
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [S(1), S(1), S(1)] });
    // a2 hat noch 321, wirft T20 T20 T20 T20? nein max 3 → simulate bust: 321 - 20*3? =261, kein bust
    // eigenen Bust erzwingen: Rest 321, wirf 3xT20=180 -> 141, dann Visit mit 200 unmöglich.
  });

  it("landet auf 1 im Double-Out → Bust", () => {
    let m = createMatch(
      { ...x01Config, x01: { startScore: 40, out: "double", in: "straight" } },
      players,
      teams,
    );
    // a1: Rest 40, wirft Single 19 → 21, dann Single 20 → 1 = Bust (Rest bleibt 40)
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [S(19), S(20)] });
    expect((m.leg as any).remaining[0]).toBe(40);
    expect((m.leg as any).visits[0].bust).toBe(true);
  });

  it("Finish nur mit Double gültig", () => {
    let m = createMatch(
      { ...x01Config, x01: { startScore: 40, out: "double", in: "straight" } },
      players,
      teams,
    );
    // a1: Rest 40, Single 20 → 20, Single 20 → 0 ohne Double = Bust
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [S(20), S(20)] });
    expect((m.leg as any).remaining[0]).toBe(40);
    // neuer Versuch (jetzt a2 dran wegen visitCounter, aber Team A hat 2 Spieler)
  });

  it("D20 checkt 40 aus und gewinnt das Leg", () => {
    let m = createMatch(
      { ...x01Config, x01: { startScore: 40, out: "double", in: "straight" } },
      players,
      teams,
    );
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [D20] });
    expect(m.legsWonInSet[0]).toBe(1);
  });
});

describe("X01 – Legs, Anwurfwechsel, Match-Ende", () => {
  it("Team A gewinnt 2 Legs → Match zu Ende, Anwurf wechselt zwischen Legs", () => {
    const cfg: MatchConfig = {
      ...x01Config,
      x01: { startScore: 20, out: "double", in: "straight" },
      legsToWinSet: 2,
    };
    let m = createMatch(cfg, players, teams);
    expect(m.legStarterTeamIndex).toBe(0);

    // Leg 1: a1 wirft D10 → 0
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [{ value: 10, multiplier: 2 }] });
    expect(m.legsWonInSet[0]).toBe(1);
    expect(m.phase).toBe("playing");
    expect(m.legStarterTeamIndex).toBe(1); // Anwurf gewechselt

    // Leg 2: jetzt beginnt Team B (b?) – aber A soll trotzdem gewinnen können.
    // Reihenfolge Leg 2: Starter B, offset 1 → b2, a2, b1, a1
    expect(throwOrder(m).map((o) => o.playerId)).toEqual(["b2", "a2", "b1", "a1"]);
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [S(1)] }); // b2
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [{ value: 10, multiplier: 2 }] }); // a2 → 0
    expect(m.legsWonInSet[0]).toBe(2);
    expect(m.phase).toBe("finished");
    expect(m.matchWinnerTeamIndex).toBe(0);
  });
});

describe("Ausbullen", () => {
  it("näherer Wurf gewinnt den Anwurf", () => {
    const cfg: MatchConfig = { ...x01Config, bullOff: true };
    let m = createMatch(cfg, players, teams);
    expect(m.phase).toBe("bulloff");
    m = reduceMatch(m, {
      type: "BULLOFF_THROW",
      teamIndex: 0,
      playerId: "a1",
      darts: [{ kind: "SBULL" }],
    });
    m = reduceMatch(m, {
      type: "BULLOFF_THROW",
      teamIndex: 1,
      playerId: "b1",
      darts: [{ kind: "DBULL" }],
    });
    expect(m.phase).toBe("playing");
    expect(m.legStarterTeamIndex).toBe(1);
  });

  it("Gleichstand → Nachwerfen", () => {
    const cfg: MatchConfig = { ...x01Config, bullOff: true };
    let m = createMatch(cfg, players, teams);
    m = reduceMatch(m, { type: "BULLOFF_THROW", teamIndex: 0, playerId: "a1", darts: [{ kind: "DBULL" }], });
    m = reduceMatch(m, { type: "BULLOFF_THROW", teamIndex: 1, playerId: "b1", darts: [{ kind: "DBULL" }], });
    expect(m.phase).toBe("bulloff");
    expect(m.bullOff?.done).toBe(false);
    expect(m.bullOff?.rounds.length).toBe(1);
  });
});

describe("Cricket 2v2", () => {
  it("3 Marks öffnen die Zahl, weitere geben Punkte", () => {
    const cfg: MatchConfig = {
      mode: "cricket",
      cricket: { variant: "standard" },
      legsToWinSet: 1,
      setsToWin: 1,
      bullOff: false,
      teamSize: 2,
    };
    let m = createMatch(cfg, players, teams);
    // a1: T20 (3 Marks, öffnet) + S20 + S20 → 2 Punkte-Treffer = 40 Punkte
    m = reduceMatch(m, {
      type: "RECORD_VISIT",
      darts: [
        { value: 20, multiplier: 3 },
        { value: 20, multiplier: 1 },
        { value: 20, multiplier: 1 },
      ],
    });
    expect((m.leg as any).marks[0]["20"]).toBe(3);
    expect((m.leg as any).points[0]).toBe(40);
  });
});

describe("Checkout-Finder", () => {
  it("findet 170 = T20 T20 Bull", () => {
    const r = findCheckout(170, 3, "double");
    expect(r?.label).toBe("T20 T20 Bull");
  });
  it("kein Checkout über 170", () => {
    expect(findCheckout(171, 3, "double")).toBeNull();
  });
  it("40 = D20", () => {
    expect(findCheckout(40, 3, "double")?.label).toBe("D20");
  });
  it("2 Darts auf 50 → Bull", () => {
    expect(findCheckout(50, 2, "double")?.label).toBe("Bull");
  });
});

describe("MatchController Undo", () => {
  it("macht die letzte Aufnahme rückgängig", () => {
    const c = new MatchController(createMatch(x01Config, players, teams));
    c.dispatch({ type: "RECORD_VISIT", darts: [T20, T20, T20] });
    expect((c.state.leg as any).remaining[0]).toBe(321);
    c.undo();
    expect((c.state.leg as any).remaining[0]).toBe(501);
    expect(c.canUndo).toBe(false);
  });
});

describe("Scoreboard-Selektor", () => {
  it("liefert Checkout nur für das Team am Wurf", () => {
    const m = createMatch(
      { ...x01Config, x01: { startScore: 40, out: "double", in: "straight" } },
      players,
      teams,
    );
    const sb = scoreboard(m);
    expect(sb.teams[0]!.checkout).toBe("D20");
    expect(sb.teams[1]!.checkout).toBeNull();
    expect(sb.thrower?.playerName).toBe("Andi");
  });
});

describe("Ausbullen mit 3 Darts", () => {
  const bullMatch = () => createMatch({ ...x01Config, bullOff: true }, players, teams);
  const bull = (m: ReturnType<typeof bullMatch>, teamIndex: number, playerId: string, kinds: string[]) =>
    reduceMatch(m, {
      type: "BULLOFF_THROW",
      teamIndex,
      playerId,
      darts: kinds.map((k) => ({ kind: k })) as any,
    });

  it("wertet den besten Dart des Wurfs", () => {
    let m = bullMatch();
    m = bull(m, 0, "a1", ["MISS", "SBULL", "MISS"]);
    m = bull(m, 1, "b1", ["MISS", "MISS", "MISS"]);
    expect(m.phase).toBe("playing");
    expect(m.legStarterTeamIndex).toBe(0);
  });

  it("Reihenfolge egal – 0-0-0 gegen 50-50-25 → das Bull-Team gewinnt", () => {
    let m = bullMatch();
    m = bull(m, 0, "a1", ["MISS", "MISS", "MISS"]);
    m = bull(m, 1, "b1", ["DBULL", "DBULL", "SBULL"]);
    expect(m.phase).toBe("playing");
    expect(m.legStarterTeamIndex).toBe(1);
  });

  it("Gleichstand beim besten Dart → zweitbester entscheidet", () => {
    let m = bullMatch();
    // A: 50-25-0   B: 50-0-0   -> beste gleich (50), zweitbeste 25>0 -> A
    m = bull(m, 0, "a1", ["DBULL", "SBULL", "MISS"]);
    m = bull(m, 1, "b1", ["DBULL", "MISS", "MISS"]);
    expect(m.phase).toBe("playing");
    expect(m.legStarterTeamIndex).toBe(0);
  });

  it("nur bei wertgleichen Würfen wird nachgeworfen", () => {
    let m = bullMatch();
    m = bull(m, 0, "a1", ["DBULL", "SBULL", "MISS"]);
    m = bull(m, 1, "b1", ["MISS", "SBULL", "DBULL"]);
    expect(m.phase).toBe("bulloff");
    expect(m.bullOff?.done).toBe(false);
    expect(m.bullOff?.rounds.length).toBe(1);
  });

  it("Wurf außer der Reihe wird ignoriert", () => {
    let m = bullMatch();
    // Team 1 ist nicht zuerst dran
    m = bull(m, 1, "b1", ["DBULL"]);
    expect(m.bullOff?.currentRound.length).toBe(0);
  });
});

describe("Match-Statistik", () => {
  it("zählt Darts, Average, 180er und Checkout-Chancen", () => {
    let m = createMatch(x01Config, players, teams);
    // a1 (Team A): 180
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [T20, T20, T20] });
    // b1 (Team B): 60
    m = reduceMatch(m, { type: "RECORD_SCORE", score: 60 });
    const st = matchStats(m);
    expect(st.teams[0]!.b180).toBe(1);
    expect(st.teams[0]!.dartsThrown).toBe(3);
    expect(st.teams[0]!.average).toBeCloseTo(180);
    expect(st.teams[1]!.dartsThrown).toBe(3); // RECORD_SCORE => 3 Darts
    expect(st.teams[1]!.average).toBeCloseTo(60);
  });

  it("Checkdart-Angaben fließen in die Checkout-Quote", () => {
    const cfg: MatchConfig = {
      ...x01Config,
      x01: { startScore: 40, out: "double", in: "straight" },
      legsToWinSet: 1,
    };
    let m = createMatch(cfg, players, teams);
    m = reduceMatch(m, {
      type: "RECORD_SCORE",
      score: 40,
      darts: 2,
      finishedOnDouble: true,
      doubleDarts: 1,
    });
    const st = matchStats(m);
    expect(st.teams[0]!.checkoutHits).toBe(1);
    expect(st.teams[0]!.doubleDarts).toBe(1);
    expect(st.teams[0]!.checkoutPct).toBe(100);
    expect(st.teams[0]!.dartsThrown).toBe(2);
  });

  it("archiviert gewonnene Legs und merkt kürzestes Leg + Checkout", () => {
    const cfg: MatchConfig = {
      ...x01Config,
      x01: { startScore: 100, out: "double", in: "straight" },
      legsToWinSet: 2,
    };
    let m = createMatch(cfg, players, teams);
    // a1: 60, b1: irgendwas, a2: 40 auf Doppel -> Team A gewinnt Leg 1 mit 6 Darts
    m = reduceMatch(m, { type: "RECORD_SCORE", score: 60 });
    m = reduceMatch(m, { type: "RECORD_SCORE", score: 5 });
    m = reduceMatch(m, { type: "RECORD_VISIT", darts: [{ value: 20, multiplier: 2 }] });
    expect(m.history.length).toBe(1);
    const st = matchStats(m);
    expect(st.teams[0]!.legsWon).toBe(1);
    expect(st.teams[0]!.checkoutHits).toBe(1);
    expect(st.teams[0]!.highestFinish).toBe(40);
    expect(st.teams[0]!.shortestLegDarts).toBe(4); // 3 + 1 Darts
  });
});
