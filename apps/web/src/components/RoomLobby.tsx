import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchConfig } from "@webdarts/engine";
import type { AppApi } from "../useApp";
import { TeamNameModal } from "./TeamNameModal";
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

  const allSeated = state.seats.every((s) => s.occupantId);
  const teams = useMemo(
    () => [0, 1].map((t) => state.seats.filter((s) => s.teamIndex === t)),
    [state.seats],
  );
  const modalTeam = nameModal;
  const members = embed?.members ?? [];
  const isDoubles = state.config.teamSize === 2;

  return (
    <div className="stack">
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

      {state.name && <h2 className="room-title">{state.name}</h2>}

      {state.bot && (
        <div className="hint">
          🤖 Bot <strong>{state.bot.name}</strong> (Ø {state.bot.average}) –{" "}
          {state.bot.seatKey ? "sitzt am Tisch" : "vom Host auf einen freien Platz setzen"}.
        </div>
      )}

      <div className="card stack">
        <h3 className="section-title">Aufstellung</h3>
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
                const isBotSeat = s.occupantId === state.bot?.seatKey || s.playerName === state.bot?.name;
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
                        <span className="hint" style={{ marginLeft: 6 }}>· lokal</span>
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

                return (
                  <div key={s.key} className={`seat ${s.occupantId ? "filled" : ""} ${mine ? "mine" : ""}`}>
                    <span className="seat-name">
                      {s.occupantId ? (
                        <>
                          <Avatar
                            src={s.playerImage}
                            name={isBotSeat ? "🤖" : (s.playerName ?? "?")}
                            size={26}
                          />
                          {s.playerName}
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
      </div>

      <div className="card stack">
        <h3 className="section-title">Modus {isHost ? "" : "(nur Host ändert)"}</h3>
        <div className="grid2">
          <label className="field">
            <span className="lbl">Spielart</span>
            <select disabled={!isHost} value={cfg.mode} onChange={(e) => patch({ mode: e.target.value as MatchConfig["mode"] })}>
              <option value="x01">X01</option>
              <option value="cricket">Cricket</option>
            </select>
          </label>
          <label className="field">
            <span className="lbl">Team-Größe</span>
            <select disabled={!isHost} value={cfg.teamSize} onChange={(e) => patch({ teamSize: Number(e.target.value) as 1 | 2 })}>
              <option value={2}>Doppel (2v2)</option>
              <option value={1}>Einzel (1v1)</option>
            </select>
          </label>

          {cfg.mode === "x01" && (
            <>
              <label className="field">
            <span className="lbl">Startpunkte</span>
                <select
                  disabled={!isHost}
                  value={cfg.x01!.startScore}
                  onChange={(e) => patch({ x01: { ...cfg.x01!, startScore: Number(e.target.value) } })}
                >
                  {[301, 501, 701].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="field">
            <span className="lbl">Finish</span>
                <select
                  disabled={!isHost}
                  value={cfg.x01!.out}
                  onChange={(e) => patch({ x01: { ...cfg.x01!, out: e.target.value as "straight" | "double" | "master" } })}
                >
                  <option value="double">Double-Out</option>
                  <option value="master">Master-Out</option>
                  <option value="straight">Straight-Out</option>
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
                onChange={(e) => patch({ cricket: { variant: e.target.value as "standard" | "cutthroat" } })}
              >
                <option value="standard">Standard</option>
                <option value="cutthroat">Cut-Throat</option>
              </select>
            </label>
          )}

          <label className="field">
            <span className="lbl">Legs pro Satz</span>
            <input
              type="number"
              min={1}
              max={21}
              disabled={!isHost}
              value={cfg.legsToWinSet}
              onChange={(e) => patch({ legsToWinSet: Math.max(1, Number(e.target.value)) })}
            />
          </label>
          <label className="field">
            <span className="lbl">Sätze zum Sieg (1 = ohne)</span>
            <input
              type="number"
              min={1}
              max={13}
              disabled={!isHost}
              value={cfg.setsToWin}
              onChange={(e) => patch({ setsToWin: Math.max(1, Number(e.target.value)) })}
            />
          </label>
          <label className="row" style={{ margin: 0, gap: 8 }}>
            <input
              type="checkbox"
              disabled={!isHost}
              checked={cfg.bullOff}
              onChange={(e) => patch({ bullOff: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            <span>Ausbullen um den Anwurf</span>
          </label>
        </div>

        {isHost ? (
          <button className="primary big" disabled={!allSeated} onClick={app.startMatch}>
            {allSeated ? "Match starten" : "Warte auf alle Spieler…"}
          </button>
        ) : (
          <div className="hint">Der Host startet das Match.</div>
        )}
      </div>

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
