import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchConfig } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { TeamNameModal } from "./TeamNameModal";
import { CameraCheck } from "./CameraCheck";
import { Avatar } from "./Avatar";
import { embed, type EmbedMember } from "../embed";

/** Partner-Eingabe für "Beide an einem Board": Freitext oder Mitglied aus der Liste. */
function PartnerEditor({
  value,
  members,
  disabled,
  onCommit,
}: {
  value: string;
  members: EmbedMember[];
  disabled?: boolean;
  onCommit: (name: string, member: EmbedMember | null) => void;
}) {
  const [txt, setTxt] = useState(value);
  useEffect(() => setTxt(value), [value]);
  const commit = () => {
    const v = txt.trim();
    if (v === value.trim()) return;
    const m = members.find((x) => x.name.toLowerCase() === v.toLowerCase()) ?? null;
    onCommit(v, m);
  };
  return (
    <div className="row" style={{ gap: 6, flex: 1 }}>
      <input
        list="wd-members"
        aria-label="Partner: Name oder DOCA-Mitglied"
        placeholder="Partner: Name oder DOCA-Mitglied"
        value={txt}
        disabled={disabled}
        maxLength={24}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        style={{ minWidth: 0, flex: 1 }}
      />
      {value.trim() && !disabled && (
        <button className="ghost" title="Partner entfernen" onClick={() => onCommit("", null)}>
          ×
        </button>
      )}
    </div>
  );
}

export function RoomLobby({ app }: { app: AppApi }) {
  const state = app.room!;
  const isHost = app.myId === state.hostId;
  const mySeatObj = state.seats.find((s) => s.occupantId === app.myId) ?? null;
  const mySeat = mySeatObj?.key ?? null;
  const cfg = state.config;

  const patch = (p: Partial<MatchConfig>) => app.updateConfig({ ...cfg, ...p }, state.teamNames);

  /** Darf ich den Namen von Team `ti` setzen? Host oder Spieler 1 des Teams. */
  const canEditTeam = (ti: number) =>
    isHost || (mySeatObj?.teamIndex === ti && mySeatObj?.indexInTeam === 0);

  // Namens-Popup: teamIndex oder null
  const [nameModal, setNameModal] = useState<number | null>(null);
  const promptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (mySeatObj && mySeatObj.indexInTeam === 0 && !promptedRef.current.has(mySeatObj.key)) {
      promptedRef.current.add(mySeatObj.key);
      setNameModal(mySeatObj.teamIndex);
    }
  }, [mySeatObj?.key, mySeatObj?.indexInTeam, mySeatObj?.teamIndex]);

  // Anzeige-/Eingabehilfe für die Spiellänge: "First to N" oder "Best of N".
  // Gespeichert wird immer die Anzahl nötiger Siege (legsToWinSet / setsToWin).
  const [legFmt, setLegFmt] = useState<"firstto" | "bestof">("firstto");
  const [setFmt, setSetFmt] = useState<"firstto" | "bestof">("firstto");
  const toWins = (fmt: "firstto" | "bestof", n: number, cap: number) => {
    const raw = fmt === "bestof" ? Math.ceil((Number(n) || 1) / 2) : Number(n) || 1;
    return Math.min(cap, Math.max(1, raw));
  };
  const fromWins = (fmt: "firstto" | "bestof", w: number) =>
    fmt === "bestof" ? Math.max(1, w) * 2 - 1 : Math.max(1, w);

  const allSeated = state.seats.every((s) => s.occupantId);
  const teams = useMemo(
    () => [0, 1].map((t) => state.seats.filter((s) => s.teamIndex === t)),
    [state.seats],
  );
  const modalTeam = nameModal;
  const members = embed?.members ?? [];
  const isDoubles = state.config.teamSize === 2;
  const usesSets = cfg.setsToWin > 1;
  const lockNote = isHost ? null : <span className="lobby-lock">nur der Host ändert das</span>;

  // WM-Modus: Distanzen der PDC-WM als Schnellwahl (füllt nur die Format-Felder).
  const WM_ROUNDS: { key: string; label: string; sets: number }[] = [
    { key: "r12", label: "Runde 1 / 2 · Best of 5 Sätze", sets: 3 },
    { key: "r3", label: "Runde 3 / Achtelfinale · Best of 7", sets: 4 },
    { key: "qf", label: "Viertelfinale · Best of 9", sets: 5 },
    { key: "sf", label: "Halbfinale · Best of 11", sets: 6 },
    { key: "f", label: "Finale · Best of 13", sets: 7 },
  ];
  const wmCurrent =
    cfg.mode === "x01" && cfg.legsToWinSet === 3 && !!cfg.twoClearLegs
      ? (WM_ROUNDS.find((r) => r.sets === cfg.setsToWin)?.key ?? "")
      : "";
  const applyWm = (key: string) => {
    const r = WM_ROUNDS.find((x) => x.key === key);
    if (!r) {
      // „– nicht nach WM-Distanz –": kein 2-Clear mehr, nur die eingestellten Sätze/Legs.
      if (cfg.twoClearLegs) patch({ twoClearLegs: false });
      return;
    }
    patch({
      setsToWin: r.sets,
      legsToWinSet: 3,
      twoClearLegs: true,
      x01: { ...(cfg.x01 ?? { startScore: 501, out: "double", in: "straight" }), startScore: 501, out: "double" },
    });
  };

  return (
    <div className="stack lobby-setup">
      {members.length > 0 && (
        <datalist id="wd-members">
          {members.map((m) => (
            <option key={m.id} value={m.name} />
          ))}
        </datalist>
      )}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="ghost" onClick={app.leaveRoom}>
          ← Zurück zur Lobby
        </button>
        <span className="hint">
          {state.videoEnabled ? "Video aktiv" : "Video deaktiviert (keine LiveKit-Keys)"}
        </span>
      </div>

      <div className="lobby-head">
        <h2 className="room-title">{state.name || "Neues Match"}</h2>
        <p className="hint">Stelle dein Spiel zusammen.</p>
      </div>

      {state.bot && (
        <div className="hint">
          🤖 Bot <strong>{state.bot.name}</strong> (Ø {state.bot.average}) –{" "}
          {state.bot.seatKey ? "sitzt am Tisch" : "vom Host auf einen freien Platz setzen"}.
        </div>
      )}

      {/* ── 1) Spielmodus ─────────────────────────────────────────────── */}
      <div className="card stack lobby-block">
        <div className="lobby-block-head">
          <h3 className="section-title">Spielmodus</h3>
          {lockNote}
        </div>
        <div className="grid2">
          <label className="field">
            <span className="lbl">Spielart</span>
            <select
              disabled={!isHost}
              value={cfg.mode}
              onChange={(e) => patch({ mode: e.target.value as MatchConfig["mode"] })}
            >
              <option value="x01">X01</option>
              <option value="cricket">Cricket</option>
            </select>
          </label>

          <label className="field">
            <span className="lbl">Team-Größe</span>
            <select
              disabled={!isHost}
              value={cfg.teamSize}
              onChange={(e) => patch({ teamSize: Number(e.target.value) as 1 | 2 })}
            >
              <option value={2}>Doppel (2v2)</option>
              <option value={1}>Einzel (1v1)</option>
            </select>
          </label>

          {cfg.mode === "x01" && (
            <>
              <label className="field">
                <span className="lbl">Punktzahl</span>
                <select
                  disabled={!isHost}
                  value={cfg.x01!.startScore}
                  onChange={(e) => patch({ x01: { ...cfg.x01!, startScore: Number(e.target.value) } })}
                >
                  {[301, 501, 701].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="lbl">Checkout</span>
                <select
                  disabled={!isHost}
                  value={cfg.x01!.out}
                  onChange={(e) =>
                    patch({ x01: { ...cfg.x01!, out: e.target.value as "straight" | "double" | "master" } })
                  }
                >
                  <option value="double">Double Out</option>
                  <option value="master">Master Out</option>
                  <option value="straight">Straight Out</option>
                </select>
              </label>
            </>
          )}

          {cfg.mode === "cricket" && (
            <label className="field">
              <span className="lbl">Cricket-Variante</span>
              <select
                disabled={!isHost}
                value={cfg.cricket!.variant}
                onChange={(e) =>
                  patch({ cricket: { variant: e.target.value as "standard" | "cutthroat" } })
                }
              >
                <option value="standard">Standard</option>
                <option value="cutthroat">Cut-Throat</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {/* ── 2) Format ─────────────────────────────────────────────────── */}
      <div className="card stack lobby-block">
        <div className="lobby-block-head">
          <h3 className="section-title">Format</h3>
          {lockNote}
        </div>
        {cfg.mode === "x01" && (
          <label className="field">
            <span className="lbl">WM-Modus (Distanz)</span>
            <select
              disabled={!isHost}
              value={wmCurrent}
              onChange={(e) => applyWm(e.target.value)}
            >
              <option value="">– nicht nach WM-Distanz –</option>
              {WM_ROUNDS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
            <span className="hint">
              „– nicht nach WM-Distanz –": es zählen nur die unten eingestellten Sätze/Legs. Sonst
              füllt die Auswahl die Felder (je Satz First to 3 Legs, Entscheidungssatz 2 Clear Legs).
            </span>
          </label>
        )}

        <div className="grid2">
          <label className="field">
            <span className="lbl">Sätze (1 = ohne)</span>
            <div className="row" style={{ gap: 6 }}>
              <select
                disabled={!isHost}
                value={setFmt}
                onChange={(e) => setSetFmt(e.target.value as "firstto" | "bestof")}
                style={{ flex: "0 0 auto" }}
              >
                <option value="firstto">First to</option>
                <option value="bestof">Best of</option>
              </select>
              <input
                type="number"
                min={1}
                max={25}
                disabled={!isHost}
                value={usesSets ? fromWins(setFmt, cfg.setsToWin) : 1}
                onChange={(e) => patch({ setsToWin: toWins(setFmt, Number(e.target.value), 13) })}
                style={{ width: 64 }}
              />
            </div>
          </label>

          <label className="field">
            <span className="lbl">{usesSets ? "Legs pro Satz" : "Legs"}</span>
            <div className="row" style={{ gap: 6 }}>
              <select
                disabled={!isHost}
                value={legFmt}
                onChange={(e) => setLegFmt(e.target.value as "firstto" | "bestof")}
                style={{ flex: "0 0 auto" }}
              >
                <option value="firstto">First to</option>
                <option value="bestof">Best of</option>
              </select>
              <input
                type="number"
                min={1}
                max={41}
                disabled={!isHost}
                value={fromWins(legFmt, cfg.legsToWinSet)}
                onChange={(e) => patch({ legsToWinSet: toWins(legFmt, Number(e.target.value), 21) })}
                style={{ width: 64 }}
              />
            </div>
          </label>
        </div>
        <div className="hint">
          {usesSets ? (
            <>
              Satz: wer zuerst <strong>{cfg.legsToWinSet}</strong> Leg
              {cfg.legsToWinSet > 1 ? "s" : ""} hat (= Best of {cfg.legsToWinSet * 2 - 1}). Match: wer
              zuerst <strong>{cfg.setsToWin}</strong> Sätze hat (= Best of {cfg.setsToWin * 2 - 1}).
            </>
          ) : (
            <>
              Wer zuerst <strong>{cfg.legsToWinSet}</strong> Leg{cfg.legsToWinSet > 1 ? "s" : ""}{" "}
              gewinnt · First to {cfg.legsToWinSet} = Best of {cfg.legsToWinSet * 2 - 1}.
            </>
          )}
        </div>
      </div>

      {/* ── 3) Optionen ──────────────────────────────────────────────── */}
      <div className="card stack lobby-block">
        <div className="lobby-block-head">
          <h3 className="section-title">Optionen</h3>
          {lockNote}
        </div>
        <label className="lobby-opt">
          <input
            type="checkbox"
            disabled={!isHost}
            checked={cfg.bullOff}
            onChange={(e) => patch({ bullOff: e.target.checked })}
          />
          <span>
            Ausbullen um den Anwurf
            <span className="hint"> – vor dem ersten Leg wird ausgebullt</span>
          </span>
        </label>

        <label className="lobby-opt">
          <input
            type="checkbox"
            disabled={!isHost}
            checked={!!cfg.twoClearLegs}
            onChange={(e) => patch({ twoClearLegs: e.target.checked })}
          />
          <span>
            2 Clear Legs
            <span className="hint">
              {" "}
              – nur im Entscheidungssatz: Sieg erst mit 2 Legs Vorsprung, Sudden Death bei{" "}
              {cfg.legsToWinSet + 2}:{cfg.legsToWinSet + 2}
            </span>
          </span>
        </label>

        <div className="lobby-opt">
          <input
            id="opt-legbull"
            type="checkbox"
            disabled={!isHost}
            checked={(cfg.legBulloffRounds ?? 0) > 0}
            onChange={(e) => patch({ legBulloffRounds: e.target.checked ? 20 : 0 })}
          />
          <span>
            <label htmlFor="opt-legbull">Nach X Runden das Leg durch Ausbullen entscheiden</label>
            {(cfg.legBulloffRounds ?? 0) > 0 && (
              <span className="row" style={{ gap: 6, margin: "6px 0" }}>
                <span className="hint">Limit (Aufnahmen pro Spieler):</span>
                <input
                  type="number"
                  min={5}
                  max={40}
                  disabled={!isHost}
                  value={cfg.legBulloffRounds ?? 20}
                  onChange={(e) =>
                    patch({
                      legBulloffRounds: Math.max(5, Math.min(40, Number(e.target.value) || 20)),
                    })
                  }
                  style={{ width: 64 }}
                />
              </span>
            )}
            <span className="hint">
              alle Spieler werfen 3 Darts auf Bull (A1 → B1 → A2 → B2), näher gewinnt das Leg. Greift
              nicht, wenn das Leg das Match entscheiden würde.
            </span>
          </span>
        </div>
      </div>

      {/* ── 4) Gegner & Verbindung ───────────────────────────────────── */}
      <div className="card stack lobby-block">
        <div className="lobby-block-head">
          <h3 className="section-title">Gegner &amp; Verbindung</h3>
        </div>

        <div className="seat-grid">
          {teams.map((seats, ti) => (
            <div key={ti} className={`team-col ${ti === 0 ? "a" : "b"}`}>
              <input
                className="team-name-input"
                aria-label={`Name ${ti === 0 ? "Team A" : "Team B"}`}
                disabled={!canEditTeam(ti)}
                value={state.teamNames[ti as 0 | 1]}
                onChange={(e) => app.setTeamName(ti, e.target.value)}
                style={{ width: "100%", fontWeight: 700 }}
              />
              {canEditTeam(ti) && (
                <button
                  className="ghost"
                  style={{ width: "100%", fontSize: 12, padding: "5px 8px", marginTop: 6 }}
                  onClick={() => setNameModal(ti)}
                >
                  ✎ Teamname
                </button>
              )}
              {isDoubles && (
                <label className="row" style={{ gap: 8, margin: "8px 0 2px", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={state.localTeams[ti as 0 | 1]}
                    onChange={(e) => app.setLocalTeam(ti, e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Beide an einem Board (1 Kamera)</span>
                </label>
              )}
              {seats.map((s) => {
                const mine = s.occupantId === app.myId;
                const isBotSeat =
                  s.occupantId === state.bot?.seatKey || s.playerName === state.bot?.name;
                const isBotHere = state.bot?.seatKey === s.key;

                if (s.isLocalPartner) {
                  const operatorId =
                    state.seats.find((x) => x.teamIndex === ti && x.indexInTeam === 0)?.occupantId ??
                    null;
                  const iAmOperator = operatorId != null && operatorId === app.myId;
                  return (
                    <div key={s.key} className={`seat ${s.playerName ? "filled" : ""}`}>
                      <span className="seat-name">
                        <Avatar src={s.playerImage} name={s.playerName ?? "P"} size={26} />
                        {s.playerName ?? <span className="hint">Partner offen</span>}
                        <span className="hint" style={{ marginLeft: 6 }}>
                          · lokal
                        </span>
                      </span>
                      {iAmOperator ? (
                        <PartnerEditor
                          value={s.playerName ?? ""}
                          members={members}
                          disabled={operatorId == null}
                          onCommit={(name, m) =>
                            app.setPartner(ti, name, m?.id ?? null, m?.image ?? null)
                          }
                        />
                      ) : (
                        <span className="hint">
                          {operatorId ? "vom Spieler an Platz 1 geführt" : "wartet auf Platz 1"}
                        </span>
                      )}
                    </div>
                  );
                }

                const seatOffline = !!s.occupantId && !isBotSeat && !s.connected;

                return (
                  <div
                    key={s.key}
                    className={`seat ${s.occupantId ? "filled" : ""} ${mine ? "mine" : ""} ${
                      seatOffline ? "offline" : ""
                    }`}
                  >
                    <span className="seat-name">
                      {s.occupantId ? (
                        <>
                          <Avatar
                            src={s.playerImage}
                            name={isBotSeat ? "🤖" : (s.playerName ?? "?")}
                            size={26}
                          />
                          {s.playerName}
                          {seatOffline && (
                            <span className="hint" style={{ marginLeft: 6 }}>
                              · kurz weg, Platz reserviert
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="hint">frei</span>
                      )}
                    </span>
                    {s.occupantId ? (
                      isBotHere && isHost ? (
                        <button className="ghost" onClick={() => app.placeBot(null)}>
                          Bot entfernen
                        </button>
                      ) : mine ? (
                        <button className="ghost" onClick={() => app.takeSeat(null)}>
                          Platz verlassen
                        </button>
                      ) : (
                        <span className="hint">belegt</span>
                      )
                    ) : (
                      <div className="row" style={{ gap: 6 }}>
                        <button onClick={() => app.takeSeat(s.key)}>Hier setzen</button>
                        {state.bot && isHost && (
                          <button className="ghost" onClick={() => app.placeBot(s.key)}>
                            🤖 Bot
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hint">
          {mySeat ? "Du bist am Tisch." : "Du bist Zuschauer."} Zuschauer:{" "}
          {state.spectators.map((s) => s.name).join(", ") || "—"}
        </div>

        {state.videoEnabled && <CameraCheck />}
      </div>

      {isHost ? (
        <button className="primary big" disabled={!allSeated} onClick={app.startMatch}>
          {allSeated ? "Match erstellen" : "Warte auf alle Spieler…"}
        </button>
      ) : (
        <div className="hint">Der Host startet das Match.</div>
      )}

      {modalTeam !== null && (
        <TeamNameModal
          teamIndex={modalTeam}
          current={state.teamNames[modalTeam as 0 | 1]}
          onKeep={() => setNameModal(null)}
          onSave={(name) => {
            app.setTeamName(modalTeam, name);
            setNameModal(null);
          }}
        />
      )}
    </div>
  );
}
