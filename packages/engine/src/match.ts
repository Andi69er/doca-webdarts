/**
 * Match-Orchestrierung: verbindet Ausbullen, Teilspiele (X01/Cricket),
 * Wurfreihenfolge im Doppel und den Leg-/Satz-Fortschritt.
 *
 * `reduceMatch(state, action)` ist rein und deterministisch. Für Undo/History
 * gibt es die Klasse `MatchController`, die Snapshots stapelt.
 */

import { addBullOffThrow, createBullOff } from "./bulloff";
import {
  addLegBullOffThrow,
  createLegBullOff,
  legBullOffOrder,
  shouldStartLegBullOff,
} from "./legbulloff";
import { findCheckout } from "./checkout";
import { applyCricketVisit, createCricketLeg } from "./cricket";
import { applyX01Visit, createX01Leg } from "./x01";
import type {
  Dart,
  GameMode,
  LegState,
  MatchAction,
  MatchConfig,
  MatchState,
  Player,
  Team,
  ThrowerInfo,
  X01LegState,
} from "./types";

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

export function createMatch(config: MatchConfig, players: Player[], teams: Team[]): MatchState {
  if (teams.length !== 2) throw new Error("Es müssen genau zwei Teams sein.");
  return {
    config,
    players,
    teams,
    phase: config.bullOff ? "bulloff" : "playing",
    bullOff: config.bullOff ? createBullOff() : null,
    leg: createLeg(config, teams.length),
    legIndexInSet: 0,
    setIndex: 0,
    globalLegNumber: 0,
    legsWonInSet: [0, 0],
    setsWon: [0, 0],
    legStarterTeamIndex: 0,
    visitCounter: 0,
    history: [],
    legBullOff: null,
    matchWinnerTeamIndex: null,
  };
}

function createLeg(config: MatchConfig, teamCount: number): LegState {
  if (config.mode === "x01") {
    if (!config.x01) throw new Error("x01-Optionen fehlen.");
    return createX01Leg(config.x01, teamCount);
  }
  if (!config.cricket) throw new Error("cricket-Optionen fehlen.");
  return createCricketLeg(config.cricket, teamCount);
}

// ---------------------------------------------------------------------------
// Wurfreihenfolge
// ---------------------------------------------------------------------------

export function throwOrder(state: MatchState): { teamIndex: number; playerId: string }[] {
  const starter = state.legStarterTeamIndex;
  const other = 1 - starter;
  const order: { teamIndex: number; playerId: string }[] = [];

  const teamSize = Math.max(
    state.teams[0]!.playerIds.length,
    state.teams[1]!.playerIds.length,
  );
  const firstPlayerOffset = state.legIndexInSet % 2;

  for (let slot = 0; slot < teamSize; slot++) {
    for (const ti of [starter, other]) {
      const ids = state.teams[ti]!.playerIds;
      const idx = (slot + firstPlayerOffset) % ids.length;
      order.push({ teamIndex: ti, playerId: ids[idx]! });
    }
  }
  return order;
}

/** Wer ist gerade am Wurf? */
export function currentThrower(state: MatchState): ThrowerInfo | null {
  if (state.phase !== "playing") return null;
  const order = throwOrder(state);
  const slot = order[state.visitCounter % order.length]!;
  const player = state.players.find((p) => p.id === slot.playerId);
  return {
    teamIndex: slot.teamIndex,
    playerId: slot.playerId,
    playerName: player?.name ?? slot.playerId,
    teamName: state.teams[slot.teamIndex]!.name,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduceMatch(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case "START_BULLOFF":
      return { ...state, phase: "bulloff", bullOff: createBullOff() };

    case "BULLOFF_THROW": {
      if (state.phase !== "bulloff" || !state.bullOff) return state;
      const bull = addBullOffThrow(state.bullOff, {
        teamIndex: action.teamIndex,
        playerId: action.playerId,
        darts: action.darts,
      });
      let next: MatchState = { ...state, bullOff: bull };
      if (bull.done && bull.winnerTeamIndex !== null) {
        next = { ...next, phase: "playing", legStarterTeamIndex: bull.winnerTeamIndex };
      }
      return next;
    }

    case "LEG_BULLOFF_THROW": {
      if (state.phase !== "playing" || !state.legBullOff || state.legBullOff.done) return state;
      const lbo = addLegBullOffThrow(state.legBullOff, {
        playerId: action.playerId,
        teamIndex: action.teamIndex,
        darts: action.darts,
      });
      if (lbo.done && lbo.winnerTeamIndex !== null) {
        // Aktuelles (unfertiges) Leg dem Ausbull-Sieger zuschreiben und fortfahren.
        const decidedLeg = { ...state.leg, winnerTeamIndex: lbo.winnerTeamIndex } as LegState;
        return advanceAfterLeg({ ...state, leg: decidedLeg, legBullOff: null }, lbo.winnerTeamIndex);
      }
      return { ...state, legBullOff: lbo };
    }

    case "BEGIN_PLAY":
      return state.phase === "bulloff" ? { ...state, phase: "playing" } : state;

    case "RECORD_SCORE": {
      const darts: Dart[] = scoreToDarts(action.score, action.finishedOnDouble ?? false, action.bullFinish);
      return recordVisit(state, darts, action.darts ?? 3, action.doubleDarts ?? 0, action.bullFinish);
    }

    case "RECORD_VISIT": {
      const doubles = action.darts.filter((d) => d.multiplier === 2 && d.value > 0).length;
      const lastDart = action.darts[action.darts.length - 1];
      const bullFinish = lastDart?.value === 25 && lastDart.multiplier === 2 ? true : undefined;
      return recordVisit(state, action.darts, action.darts.length, doubles, bullFinish);
    }

    default:
      return state;
  }
}

function recordVisit(
  state: MatchState,
  darts: Dart[],
  dartsUsed: number,
  doubleAttempts: number,
  bullFinish?: boolean,
): MatchState {
  if (state.phase !== "playing") return state;
  if (state.legBullOff && !state.legBullOff.done) return state; // Leg-Ausbullen läuft
  const thrower = currentThrower(state);
  if (!thrower) return state;

  let legWon = false;
  let newLeg: LegState;

  if (state.leg.mode === "x01") {
    const res = applyX01Visit(
      state.leg,
      state.config.x01!,
      thrower.teamIndex,
      thrower.playerId,
      darts,
      dartsUsed,
      doubleAttempts,
      bullFinish,
    );
    newLeg = res.state;
    legWon = res.legWon;
  } else {
    const res = applyCricketVisit(
      state.leg,
      state.config.cricket!,
      thrower.teamIndex,
      thrower.playerId,
      darts,
    );
    newLeg = res.state;
    legWon = res.legWon;
  }

  let next: MatchState = { ...state, leg: newLeg, visitCounter: state.visitCounter + 1 };
  if (legWon) {
    next = advanceAfterLeg(next, thrower.teamIndex);
  } else if (shouldStartLegBullOff(next, (newLeg as { visits: { teamIndex: number }[] }).visits)) {
    // Leg läuft zu lange → per Bull-Wurf entscheiden (A1 → B1 → A2 → B2 …).
    next = { ...next, legBullOff: createLegBullOff(legBullOffOrder(next)) };
  }
  return next;
}

/** Nach einem gewonnenen Leg: ins Archiv legen, Legs/Sätze zählen, ggf. Match beenden. */
function advanceAfterLeg(state: MatchState, winnerTeamIndex: number): MatchState {
  const history = [
    ...state.history,
    {
      leg: state.leg,
      setIndex: state.setIndex,
      legIndexInSet: state.legIndexInSet,
      winnerTeamIndex,
    },
  ];

  const legsWonInSet = state.legsWonInSet.slice();
  legsWonInSet[winnerTeamIndex] = legsWonInSet[winnerTeamIndex]! + 1;

  const setsWon = state.setsWon.slice();
  let setIndex = state.setIndex;
  let legIndexInSet = state.legIndexInSet + 1;
  let resetLegs = false;

  const usesSets = state.config.setsToWin > 1;

  // „2 Clear Legs" gilt nur im Entscheidungssatz. Ohne Sätze ist das ganze
  // Leg-Match der Entscheidungssatz; mit Sätzen der, in dem beide Teams nur
  // noch diesen einen Satz zum Match-Sieg brauchen.
  const legTarget = state.config.legsToWinSet;
  const wLegs = legsWonInSet[winnerTeamIndex]!;
  const lLegs = legsWonInSet[1 - winnerTeamIndex]!;
  const decidingSet =
    !usesSets ||
    (setsWon[0]! === state.config.setsToWin - 1 && setsWon[1]! === state.config.setsToWin - 1);
  const twoClear = !!state.config.twoClearLegs && decidingSet;
  const setDecided = twoClear
    ? wLegs >= legTarget && (wLegs - lLegs >= 2 || wLegs >= legTarget + 3)
    : wLegs >= legTarget;

  if (setDecided) {
    if (usesSets) {
      setsWon[winnerTeamIndex] = setsWon[winnerTeamIndex]! + 1;
      setIndex += 1;
      legIndexInSet = 0;
      resetLegs = true;
    }
    const target = usesSets ? state.config.setsToWin : state.config.legsToWinSet;
    const achieved = usesSets ? setsWon[winnerTeamIndex]! : legsWonInSet[winnerTeamIndex]!;
    if (achieved >= target) {
      return {
        ...state,
        history,
        legsWonInSet: resetLegs ? [0, 0] : legsWonInSet,
        setsWon,
        setIndex,
        legIndexInSet,
        legBullOff: null,
        phase: "finished",
        matchWinnerTeamIndex: winnerTeamIndex,
      };
    }
  } else if (!usesSets && !!state.config.legsCap && wLegs + lLegs >= state.config.legsCap) {
    // Liga-Format wie "Best of 14": Deckel erreicht, ohne dass jemand
    // `legsToWinSet` geschafft hat (z.B. 7:7 bei Deckel 14) -> Unentschieden.
    return {
      ...state,
      history,
      legsWonInSet,
      setsWon,
      setIndex,
      legIndexInSet,
      legBullOff: null,
      phase: "finished",
      matchWinnerTeamIndex: null,
    };
  }

  const nextStarter = 1 - state.legStarterTeamIndex;
  return {
    ...state,
    history,
    leg: createLeg(state.config, state.teams.length),
    legsWonInSet: resetLegs ? [0, 0] : legsWonInSet,
    setsWon,
    setIndex,
    legIndexInSet,
    legBullOff: null,
    globalLegNumber: state.globalLegNumber + 1,
    legStarterTeamIndex: nextStarter,
    visitCounter: 0,
  };
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

function scoreToDarts(score: number, finishedOnDouble: boolean, bullFinish?: boolean): Dart[] {
  if (score === 0) return [{ value: 0, multiplier: 1 }];
  if (finishedOnDouble) {
    // Der LETZTE Dart muss ein gültiges Doppel sein: D1..D20 (gerade 2..40)
    // oder Bull (50). Der Rest wird als ein Single-Dart davorgesetzt, sodass die
    // Punkte exakt aufgehen. Wichtig für ungerade Checkouts wie 41 (= 1 + D20).
    // `bullFinish` kommt aus einer expliziten Rückfrage an den Spieler (siehe
    // X01Visit.bullFinish) - ohne die raten wir hier sonst nur.
    let doubleVal: number;
    if (bullFinish) {
      doubleVal = 50; // vom Spieler bestätigt: Bull war der Checkout-Dart
    } else if (score < 50 && score % 2 === 0) {
      doubleVal = score; // sauberes, eindeutiges Doppel
    } else if (score <= 49 && score % 2 === 1) {
      doubleVal = score - 1; // ungerade < 50 → Single 1 + gerades Doppel
    } else {
      doubleVal = 40; // score 50/51/>51 ohne bestätigten Bullfinish → beliebiges gültiges Doppel
    }
    const rest = score - doubleVal;
    const darts: Dart[] = [];
    if (rest > 0) darts.push({ value: rest, multiplier: 1 });
    darts.push(
      doubleVal === 50
        ? { value: 25, multiplier: 2 }
        : { value: doubleVal / 2, multiplier: 2 },
    );
    return darts;
  }
  return [{ value: score, multiplier: 1 }];
}

// ---------------------------------------------------------------------------
// Selektor: Scoreboard
// ---------------------------------------------------------------------------

export interface ScoreboardTeam {
  name: string;
  players: string[];
  /** Profilbild-URLs je Spieler (gleiche Reihenfolge wie `players`). */
  playerImages: (string | null)[];
  legsWonInSet: number;
  setsWon: number;
  /** X01: Restpunkte. Cricket: Punkte. */
  score: number;
  /** X01: Startpunkte (fürs Panel). */
  startScore: number;
  /** 3-Dart-Average im aktuellen Leg. */
  legAverage: number;
  /** Darts, die dieses Team im aktuellen Leg geworfen hat. */
  dartsThisLeg: number;
  /** X01: Checkout-Vorschlag oder null (nur fürs Team am Wurf). */
  checkout: string | null;
}

export interface Scoreboard {
  phase: MatchState["phase"];
  mode: GameMode;
  teams: ScoreboardTeam[];
  thrower: ThrowerInfo | null;
  matchWinnerTeamIndex: number | null;
}

export function scoreboard(state: MatchState): Scoreboard {
  const thrower = currentThrower(state);
  const x01 = state.leg.mode === "x01" ? (state.leg as X01LegState) : null;

  return {
    phase: state.phase,
    mode: state.config.mode,
    matchWinnerTeamIndex: state.matchWinnerTeamIndex,
    thrower,
    teams: state.teams.map((team, ti) => {
      const players = team.playerIds.map(
        (id) => state.players.find((p) => p.id === id)?.name ?? id,
      );
      const playerImages = team.playerIds.map(
        (id) => state.players.find((p) => p.id === id)?.image ?? null,
      );
      let score = 0;
      let checkout: string | null = null;
      let legAverage = 0;
      let dartsThisLeg = 0;

      if (x01) {
        score = x01.remaining[ti]!;
        const tv = x01.visits.filter((v) => v.teamIndex === ti);
        dartsThisLeg = tv.reduce((n, v) => n + v.dartsUsed, 0);
        const pts = tv.reduce((n, v) => n + v.scored, 0);
        legAverage = dartsThisLeg ? (pts / dartsThisLeg) * 3 : 0;
        if (thrower?.teamIndex === ti) {
          checkout = findCheckout(score, 3, state.config.x01!.out)?.label ?? null;
        }
      } else if (state.leg.mode === "cricket") {
        score = state.leg.points[ti]!;
        dartsThisLeg = state.leg.visits
          .filter((v) => v.teamIndex === ti)
          .reduce((n, v) => n + v.dartsUsed, 0);
      }

      return {
        name: team.name,
        players,
        playerImages,
        legsWonInSet: state.legsWonInSet[ti]!,
        setsWon: state.setsWon[ti]!,
        score,
        startScore: state.config.x01?.startScore ?? 0,
        legAverage,
        dartsThisLeg,
        checkout,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Selektor: Match-Statistik (im Stil von darts-live)
// ---------------------------------------------------------------------------

export interface TeamStats {
  dartsThrown: number;
  pointsScored: number;
  /** 3-Dart-Average über das ganze Match. */
  average: number;
  /** 3-Dart-Average im aktuellen Leg. */
  legAverage: number;
  /** 3-Dart-Average der ersten 9 Darts pro Leg. */
  first9Average: number;
  /** Höchste Einzelaufnahme. */
  bestVisit: number;
  /** Aufnahme-Buckets (nach Punktzahl, im Stil von 2K). */
  b19minus: number; // 0–18
  b19: number; // 19–37
  b38: number; // 38–56
  b57: number; // 57–75
  b76: number; // 76–94
  b95: number; // 95–132
  b133: number; // 133–170
  b171: number; // 171–179
  b180: number; // 180
  legsWon: number;
  /** Erfolgreiche Checkouts (= gewonnene Legs im Double-Out). */
  checkoutHits: number;
  /** Darts, die insgesamt auf ein Doppel geworfen wurden. */
  doubleDarts: number;
  /** Checkout-Quote = checkoutHits / doubleDarts. */
  checkoutPct: number;
  highestFinish: number;
  /** Checkouts mit 100 oder mehr Punkten. */
  tonPlusFinishes: number;
  shortestLegDarts: number | null;
}

export interface MatchStats {
  mode: GameMode;
  teams: [TeamStats, TeamStats];
}

function emptyTeamStats(): TeamStats {
  return {
    dartsThrown: 0,
    pointsScored: 0,
    average: 0,
    legAverage: 0,
    first9Average: 0,
    bestVisit: 0,
    b19minus: 0,
    b19: 0,
    b38: 0,
    b57: 0,
    b76: 0,
    b95: 0,
    b133: 0,
    b171: 0,
    b180: 0,
    legsWon: 0,
    checkoutHits: 0,
    doubleDarts: 0,
    checkoutPct: 0,
    highestFinish: 0,
    tonPlusFinishes: 0,
    shortestLegDarts: null,
  };
}

type BucketKey = "b19minus" | "b19" | "b38" | "b57" | "b76" | "b95" | "b133" | "b171" | "b180";

/** Ordnet eine Aufnahme-Punktzahl einem Bucket-Feld von TeamStats zu. */
function scoreBucket(score: number): BucketKey {
  if (score <= 18) return "b19minus";
  if (score <= 37) return "b19";
  if (score <= 56) return "b38";
  if (score <= 75) return "b57";
  if (score <= 94) return "b76";
  if (score <= 132) return "b95";
  if (score <= 170) return "b133";
  if (score <= 179) return "b171";
  return "b180";
}

export function matchStats(state: MatchState): MatchStats {
  const teams: [TeamStats, TeamStats] = [emptyTeamStats(), emptyTeamStats()];
  // Bei "finished" steckt das letzte Leg schon im Archiv – nicht doppelt zählen.
  const includeCurrent = state.phase !== "finished";

  if (state.config.mode !== "x01") {
    // Cricket: nur Grundwerte (Darts + Punkte + MPR-artiger Wert als "average").
    const legs = [
      ...state.history.filter((r) => r.leg.mode === "cricket").map((r) => r.leg),
      includeCurrent && state.leg.mode === "cricket" ? state.leg : null,
    ].filter(Boolean) as { visits: { teamIndex: number; dartsUsed: number }[]; points: number[] }[];
    for (let t = 0; t < 2; t++) {
      const s = teams[t]!;
      for (const leg of legs) {
        s.dartsThrown += leg.visits
          .filter((v) => v.teamIndex === t)
          .reduce((n, v) => n + v.dartsUsed, 0);
        s.pointsScored += leg.points[t] ?? 0;
      }
      s.average = s.dartsThrown ? (s.pointsScored / (s.dartsThrown / 3)) : 0;
    }
    return { mode: "cricket", teams };
  }

  const start = state.config.x01!.startScore;

  const legs: { leg: X01LegState }[] = [
    ...state.history
      .filter((r) => r.leg.mode === "x01")
      .map((r) => ({ leg: r.leg as X01LegState })),
    ...(includeCurrent ? [{ leg: state.leg as X01LegState }] : []),
  ];

  for (let t = 0; t < 2; t++) {
    const s = teams[t]!;
    let f9pts = 0;
    let f9darts = 0;

    for (const { leg } of legs) {
      const tv = leg.visits.filter((v) => v.teamIndex === t);
      let rem = start;
      let legDarts = 0;

      tv.forEach((v, i) => {
        const before = rem;
        s.dartsThrown += v.dartsUsed;
        legDarts += v.dartsUsed;
        s.doubleDarts += v.doubleAttempts;
        s[scoreBucket(v.bust ? 0 : v.scored)] += 1;

        if (!v.bust) {
          s.pointsScored += v.scored;
          rem = before - v.scored;
          s.bestVisit = Math.max(s.bestVisit, v.scored);
          if (rem === 0) {
            s.checkoutHits++;
            s.highestFinish = Math.max(s.highestFinish, v.scored);
            if (v.scored >= 100) s.tonPlusFinishes++;
          }
        }

        if (i < 3) {
          f9pts += v.bust ? 0 : v.scored;
          f9darts += v.dartsUsed;
        }
      });

      if (leg.winnerTeamIndex === t) {
        s.legsWon++;
        s.shortestLegDarts =
          s.shortestLegDarts === null ? legDarts : Math.min(s.shortestLegDarts, legDarts);
      }
    }

    s.average = s.dartsThrown ? (s.pointsScored / s.dartsThrown) * 3 : 0;
    s.first9Average = f9darts ? (f9pts / f9darts) * 3 : 0;
    s.checkoutPct = s.doubleDarts ? (s.checkoutHits / s.doubleDarts) * 100 : 0;

    const cur = state.leg as X01LegState;
    const cv = cur.visits.filter((v) => v.teamIndex === t);
    const cd = cv.reduce((n, v) => n + v.dartsUsed, 0);
    const cp = cv.reduce((n, v) => n + (v.bust ? 0 : v.scored), 0);
    s.legAverage = cd ? (cp / cd) * 3 : 0;
  }

  return { mode: "x01", teams };
}

// ---------------------------------------------------------------------------
// Selektor: Einzelspieler-Statistik (für Karriere-/Hover-Werte)
// ---------------------------------------------------------------------------

/** Beitrag eines einzelnen Spielers über alle X01-Legs eines Matches. */
export interface PlayerStatLine {
  playerId: string;
  darts: number;
  points: number;
  /** 3-Dart-Average. */
  average: number;
  /** Darts auf ein Doppel. */
  doubleAttempts: number;
  /** Erfolgreiche Checkouts (der Spieler hat den letzten Dart geworfen). */
  checkoutHits: number;
  /** Doppelquote in Prozent (checkoutHits / doubleAttempts). */
  checkoutPct: number;
  /** Höchstes eigenes Finish. */
  highestFinish: number;
  /** Wenigste Darts (Team) in einem Leg, das dieser Spieler mitgewonnen hat. */
  shortestLegDarts: number | null;
  /** Legs, die dieser Spieler mitgewonnen hat. */
  legsWon: number;
}

/**
 * Zerlegt die Match-Statistik auf einzelne Spieler herunter (nur X01).
 * Grundlage für Karriere-Werte: Average, Doppelquote, kürzestes Leg, höchstes Finish.
 */
export function playerStats(state: MatchState): PlayerStatLine[] {
  const acc = new Map<string, PlayerStatLine>();
  const ensure = (id: string): PlayerStatLine => {
    let s = acc.get(id);
    if (!s) {
      s = {
        playerId: id,
        darts: 0,
        points: 0,
        average: 0,
        doubleAttempts: 0,
        checkoutHits: 0,
        checkoutPct: 0,
        highestFinish: 0,
        shortestLegDarts: null,
        legsWon: 0,
      };
      acc.set(id, s);
    }
    return s;
  };
  for (const p of state.players) ensure(p.id);

  const includeCurrent = state.phase !== "finished";
  const legs: X01LegState[] = [
    ...state.history.filter((r) => r.leg.mode === "x01").map((r) => r.leg as X01LegState),
    ...(includeCurrent && state.leg.mode === "x01" ? [state.leg as X01LegState] : []),
  ];

  for (const leg of legs) {
    const teamDarts = [0, 0];
    const teamPlayers: [Set<string>, Set<string>] = [new Set(), new Set()];

    for (const v of leg.visits) {
      teamDarts[v.teamIndex] = teamDarts[v.teamIndex]! + v.dartsUsed;
      teamPlayers[v.teamIndex]!.add(v.playerId);
      const s = ensure(v.playerId);
      s.darts += v.dartsUsed;
      s.doubleAttempts += v.doubleAttempts;
      if (!v.bust) s.points += v.scored;
    }

    if (leg.winnerTeamIndex !== null) {
      const wt = leg.winnerTeamIndex;
      const finisher = [...leg.visits].reverse().find((v) => v.teamIndex === wt && !v.bust);
      if (finisher) {
        const s = ensure(finisher.playerId);
        s.checkoutHits += 1;
        s.highestFinish = Math.max(s.highestFinish, finisher.scored);
      }
      for (const pid of teamPlayers[wt]!) {
        const s = ensure(pid);
        s.legsWon += 1;
        s.shortestLegDarts =
          s.shortestLegDarts === null ? teamDarts[wt]! : Math.min(s.shortestLegDarts, teamDarts[wt]!);
      }
    }
  }

  for (const s of acc.values()) {
    s.average = s.darts ? (s.points / s.darts) * 3 : 0;
    s.checkoutPct = s.doubleAttempts ? (s.checkoutHits / s.doubleAttempts) * 100 : 0;
  }
  return [...acc.values()];
}

// ---------------------------------------------------------------------------
// 3K-Bestleistungen (Highscore/Highfinish/Shortgame Doppel/Bullfinish)
// ---------------------------------------------------------------------------

export interface AchievementCandidate {
  playerId: string;
  performanceTypeCd: "HS" | "HF" | "SGD" | "BF";
  value: number;
}

/**
 * Grobe Kandidatenliste für 3K-Bestleistungen aus einem (Turnier-)Match.
 * Bewusst "dumm": kein Abgleich mit den echten 3K-Bandgrenzen (z.B. ob 155
 * überhaupt eine gemeldete Highscore-Kategorie ist) – das passiert erst beim
 * Melden selbst, wenn die aktuellen Kategorien live von 3K bekannt sind.
 * Nur X01, nur abgeschlossene Legs (state.history).
 */
export function collectAchievements(state: MatchState): AchievementCandidate[] {
  const out: AchievementCandidate[] = [];
  for (const rec of state.history) {
    if (rec.leg.mode !== "x01") continue;
    const leg = rec.leg as X01LegState;
    const teamDarts = [0, 0];
    for (const v of leg.visits) {
      teamDarts[v.teamIndex] = teamDarts[v.teamIndex]! + v.dartsUsed;
      if (!v.bust && v.scored >= 95) {
        out.push({ playerId: v.playerId, performanceTypeCd: "HS", value: v.scored });
      }
    }
    if (leg.winnerTeamIndex !== null) {
      const wt = leg.winnerTeamIndex;
      const finisher = [...leg.visits].reverse().find((v) => v.teamIndex === wt && !v.bust);
      if (finisher) {
        out.push({
          playerId: finisher.playerId,
          performanceTypeCd: finisher.bullFinish ? "BF" : "HF",
          value: finisher.scored,
        });
        // Shortgame gibt es bei 3K sowohl für Einzel ("Shortgame '9-18'") als
        // auch Doppel ("Shortgame Doppel '3-24'") - beide Male Code "SGD",
        // nur unterschiedliche Bandgrenzen. Deshalb hier nicht auf Doppel
        // filtern; welche Bandgrenze zutrifft, entscheidet der Server anhand
        // der live von 3K gemeldeten min/max für dieses Event.
        out.push({ playerId: finisher.playerId, performanceTypeCd: "SGD", value: teamDarts[wt]! });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Controller mit Undo/History
// ---------------------------------------------------------------------------

export class MatchController {
  private history: MatchState[];

  constructor(initial: MatchState) {
    this.history = [initial];
  }

  get state(): MatchState {
    return this.history[this.history.length - 1]!;
  }

  get canUndo(): boolean {
    return this.history.length > 1;
  }

  dispatch(action: MatchAction): MatchState {
    const next = reduceMatch(this.state, action);
    if (next !== this.state) this.history.push(next);
    return next;
  }

  undo(): MatchState {
    if (this.canUndo) this.history.pop();
    return this.state;
  }

  serialize(): string {
    return JSON.stringify(this.history);
  }

  static deserialize(json: string): MatchController {
    const hist = JSON.parse(json) as MatchState[];
    const c = new MatchController(hist[0]!);
    c.history = hist;
    return c;
  }
}
