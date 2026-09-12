/**
 * DOCA Webdarts – Domänenmodell der Scoring-Engine.
 *
 * Grundidee: Die Engine ist rein funktional. Aus einem `MatchState` + `MatchAction`
 * entsteht deterministisch ein neuer `MatchState`. Dadurch lässt sich der Zustand
 * über das Netz synchronisieren (Aktionen verschicken, jeder Client rechnet gleich)
 * und beliebig zurückspulen (Undo = alten Snapshot nehmen).
 */

// ---------------------------------------------------------------------------
// Wurf-Primitive
// ---------------------------------------------------------------------------

/** Multiplikator eines Einzelwurfs. 1 = Single, 2 = Double, 3 = Triple. */
export type Multiplier = 1 | 2 | 3;

/**
 * Ein einzelner Dart.
 * `value` ist das Feld: 1..20 für die Zahlensegmente, 25 für Bull.
 * Bull-Single = { value: 25, multiplier: 1 } (25 Punkte),
 * Bull-Double = { value: 25, multiplier: 2 } (50 Punkte, zählt als Double).
 * Ein Fehlwurf (daneben) ist { value: 0, multiplier: 1 }.
 */
export interface Dart {
  value: number;
  multiplier: Multiplier;
}

/** Punkte eines Darts. */
export function dartPoints(d: Dart): number {
  return d.value * d.multiplier;
}

/** Ist dieser Dart ein Double (inkl. Bull-Double)? Wichtig fürs Double-Out. */
export function isDouble(d: Dart): boolean {
  return d.multiplier === 2 && d.value > 0;
}

/** Ein „Visit“ = die (bis zu) drei Darts eines Spielers in einem Aufnahme-Durchgang. */
export type Visit = Dart[];

// ---------------------------------------------------------------------------
// Spieler & Teams
// ---------------------------------------------------------------------------

export interface Player {
  id: string;
  name: string;
  /** Profilbild-URL (Mitglied, PDC-Star oder Bot); leer = keins. */
  image?: string | null;
}

/**
 * Ein Team. Bei Doppel (2v2) hat `playerIds` zwei Einträge, bei Einzel einen.
 * Die Reihenfolge im Array ist die feste Wurfreihenfolge innerhalb des Teams.
 */
export interface Team {
  id: string;
  name: string;
  playerIds: string[];
}

// ---------------------------------------------------------------------------
// Match-Konfiguration
// ---------------------------------------------------------------------------

export type GameMode = "x01" | "cricket";

/** Wie muss ein X01-Leg eröffnet / beendet werden? */
export type InOutMode = "straight" | "double" | "master";

export interface X01Options {
  /** Startpunkte, klassisch 501 (auch 301, 701 …). */
  startScore: number;
  /** Finish-Regel. `double` = klassisches Double-Out. `master` = Double oder Triple. */
  out: InOutMode;
  /** Eröffnungs-Regel. Fast immer `straight`. */
  in: InOutMode;
}

export interface CricketOptions {
  /**
   * `standard` = Punkte zählen, solange die Zahl beim Gegner offen ist.
   * `cutthroat` = Punkte gehen an die Gegner (wer am wenigsten hat, gewinnt).
   */
  variant: "standard" | "cutthroat";
}

export interface MatchConfig {
  mode: GameMode;
  x01?: X01Options;
  cricket?: CricketOptions;
  /** Legs, die ein Team für einen Satz-Gewinn braucht. */
  legsToWinSet: number;
  /**
   * Sätze, die ein Team für den Match-Gewinn braucht.
   * 1 = es gibt keine Sätze, nur Legs (dann zählt `legsToWinSet` fürs Match).
   */
  setsToWin: number;
  /** Vor dem ersten Leg wird ausgebullt, um den Anwurf zu bestimmen. */
  bullOff: boolean;
  /**
   * „Nach X Runden das Leg durch Ausbullen entscheiden": Hat nach dieser Anzahl
   * Aufnahmen PRO SPIELER (0 = aus) niemand ausgecheckt, werfen alle Spieler in
   * fester Reihenfolge (A1 → B1 → A2 → B2 …) je 3 Darts auf Bull – der beste Wurf
   * eines Teams gewinnt das Leg. Greift NICHT, wenn dieses Leg das Match
   * entscheiden würde (dann wird normal zu Ende gespielt).
   */
  legBulloffRounds?: number;
  /**
   * „2 Clear Legs" – nur im Entscheidungssatz (wie PDC-WM): der Satz ist erst
   * gewonnen, wenn ein Team `legsToWinSet` Legs UND mindestens 2 Legs Vorsprung
   * hat. Sudden Death, sobald beide Teams `legsToWinSet + 2` Legs haben (dann
   * entscheidet das nächste Leg). Ohne Sätze zählt das gesamte Leg-Match als
   * Entscheidungssatz.
   */
  twoClearLegs?: boolean;
  /**
   * Deckelt die Gesamt-Legs OHNE Sätze (z.B. Liga-Format "Best of 14": erst
   * zu `legsToWinSet` Legs gewinnt normal, wird dieser Deckel erreicht, ohne
   * dass eine Seite `legsToWinSet` erreicht hat, endet das Match unentschieden
   * (`matchWinnerTeamIndex: null`). 0/undefined = kein Deckel, es wird bis zum
   * Sieg gespielt wie bisher. Wirkungslos, sobald Sätze verwendet werden.
   */
  legsCap?: number;
  /** Spieler pro Team: 2 = Doppel (Standard), 1 = Einzel. Bestimmt die Sitzplätze. */
  teamSize: 1 | 2;
}

// ---------------------------------------------------------------------------
// Ausbullen
// ---------------------------------------------------------------------------

/**
 * Ergebnis eines Bull-Wurfs beim Ausbullen.
 * `DBULL` = Bulls Eye (Mitte), `SBULL` = äußeres Bull, `MISS` = kein Bull.
 * `mm` = optionale gemessene Entfernung zur Mitte in Millimetern (feinere Wertung).
 */
export type BullOffThrow =
  | { kind: "DBULL" }
  | { kind: "SBULL" }
  | { kind: "MISS" }
  | { kind: "mm"; mm: number };

export interface BullOffAttempt {
  teamIndex: number;
  /** Der Spieler, der für sein Team ausbullt. */
  playerId: string;
  /** Bis zu 3 Darts auf das Bull. Der beste (näheste) Dart zählt für die Wertung. */
  darts: BullOffThrow[];
}

export interface BullOffState {
  /** Nach Runden gruppierte Versuche (bei Gleichstand wird nachgeworfen). */
  rounds: BullOffAttempt[][];
  currentRound: BullOffAttempt[];
  /** Steht der Gewinner fest, ist hier der Team-Index. */
  winnerTeamIndex: number | null;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Teilspiel-Zustände (ein Leg)
// ---------------------------------------------------------------------------

export interface X01Visit {
  teamIndex: number;
  playerId: string;
  darts: Dart[];
  /** Tatsächlich geworfene Darts (bei „Summe“-Eingabe geschätzt, Standard 3). */
  dartsUsed: number;
  /** Gezählte Punkte dieser Aufnahme (0 bei Bust). */
  scored: number;
  /** Darts dieser Aufnahme, die auf ein Doppel gingen (fürs Checkout-%). */
  doubleAttempts: number;
  bust: boolean;
  /** Nur bei Leg-Gewinn per Doppel relevant: war der Checkout-Dart Bull (D25)?
   *  Kommt aus einer expliziten Rückfrage an den Spieler (aus der Endsumme
   *  allein nicht zuverlässig ableitbar) – für die 3K-Bestleistung "Bullfinish". */
  bullFinish?: boolean;
}

export interface X01LegState {
  mode: "x01";
  /** Restpunkte je Team (Index = Team-Index). */
  remaining: number[];
  /** Aufnahmen-Verlauf je Team, für Average/Statistik. */
  visits: X01Visit[];
  winnerTeamIndex: number | null;
}

export interface CricketVisit {
  teamIndex: number;
  playerId: string;
  darts: Dart[];
  dartsUsed: number;
}

export interface CricketLegState {
  mode: "cricket";
  /** marks[teamIndex][target] – target ist "15".."20" und "B" (Bull). 0..3+, gedeckelt bei Punktezählung. */
  marks: Record<CricketTarget, number>[];
  /** Punkte je Team. */
  points: number[];
  visits: CricketVisit[];
  winnerTeamIndex: number | null;
}

export type CricketTarget = "15" | "16" | "17" | "18" | "19" | "20" | "B";
export const CRICKET_TARGETS: CricketTarget[] = ["15", "16", "17", "18", "19", "20", "B"];

export type LegState = X01LegState | CricketLegState;

/** Ein abgeschlossenes Leg – für Match-Statistik und „Darts pro Leg“. */
export interface LegRecord {
  leg: LegState;
  setIndex: number;
  legIndexInSet: number;
  winnerTeamIndex: number;
}

// ---------------------------------------------------------------------------
// Leg-Entscheidungs-Ausbullen (Timeout nach X Runden)
// ---------------------------------------------------------------------------

export interface LegBullOffAttempt {
  playerId: string;
  teamIndex: number;
  /** Bis zu 3 Darts auf Bull. */
  darts: BullOffThrow[];
}

export interface LegBullOffState {
  /** Wurfreihenfolge als playerId-Liste, z.B. [A1, B1, A2, B2]. */
  order: string[];
  /** Bereits abgegebene Würfe – in Reihenfolge von `order`. */
  attempts: LegBullOffAttempt[];
  winnerTeamIndex: number | null;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Match-Zustand
// ---------------------------------------------------------------------------

export type MatchPhase = "setup" | "bulloff" | "playing" | "finished";

export interface MatchState {
  config: MatchConfig;
  players: Player[];
  /** Genau zwei Teams. Index 0 und 1. */
  teams: Team[];

  phase: MatchPhase;
  bullOff: BullOffState | null;

  /** Aktuelles Leg. */
  leg: LegState;
  /** 0-basierter Leg-Zähler innerhalb des laufenden Satzes. */
  legIndexInSet: number;
  /** 0-basierter Satz-Zähler. */
  setIndex: number;
  /** Global über alle Sätze gezählte Legs – bestimmt u.a. den Anwurf. */
  globalLegNumber: number;

  /** Gewonnene Legs im laufenden Satz, je Team. */
  legsWonInSet: number[];
  /** Gewonnene Sätze, je Team. */
  setsWon: number[];

  /** Team-Index, der das aktuelle Leg angeworfen hat. */
  legStarterTeamIndex: number;
  /** Anzahl bereits abgeschlossener Visits im aktuellen Leg (bestimmt, wer dran ist). */
  visitCounter: number;

  /** Abgeschlossene Legs (ältestes zuerst) – Grundlage der Match-Statistik. */
  history: LegRecord[];

  /**
   * Läuft gerade das Leg-Entscheidungs-Ausbullen (Timeout nach X Runden)?
   * `phase` bleibt dabei "playing", die normale Eingabe ist aber gesperrt.
   */
  legBullOff?: LegBullOffState | null;

  /**
   * Gewinner-Team-Index, sobald `phase === "finished"`. Bleibt `null`, wenn das
   * Match (nur möglich mit `config.legsCap`) unentschieden endete - dort also
   * NICHT gleichbedeutend mit "noch nicht beendet"; das prüft man über `phase`.
   */
  matchWinnerTeamIndex: number | null;
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export type MatchAction =
  | { type: "START_BULLOFF" }
  /** Ein kompletter Ausbull-Wurf (1–3 Darts) für ein Team. */
  | { type: "BULLOFF_THROW"; teamIndex: number; playerId: string; darts: BullOffThrow[] }
  /** Ein Wurf beim Leg-Entscheidungs-Ausbullen (nach Runden-Timeout). */
  | { type: "LEG_BULLOFF_THROW"; playerId: string; teamIndex: number; darts: BullOffThrow[] }
  | { type: "BEGIN_PLAY" }
  /** Eine komplette Aufnahme des aktuell werfenden Spielers, Dart für Dart. */
  | { type: "RECORD_VISIT"; darts: Dart[] }
  /**
   * Bequemer Shortcut für Handeingabe „Summe“ (nur X01).
   * `darts` = tatsächlich geworfene Darts (Standard 3, beim Checkout ggf. 1–2).
   * `doubleDarts` = Darts dieser Aufnahme auf ein Doppel (fürs Checkout-%).
   */
  | {
      type: "RECORD_SCORE";
      score: number;
      darts?: number;
      finishedOnDouble?: boolean;
      doubleDarts?: number;
      /** Siehe X01Visit.bullFinish. */
      bullFinish?: boolean;
    };

// ---------------------------------------------------------------------------
// Abgeleitete Sicht fürs UI / Video-Layout
// ---------------------------------------------------------------------------

export interface ThrowerInfo {
  teamIndex: number;
  playerId: string;
  playerName: string;
  teamName: string;
}
