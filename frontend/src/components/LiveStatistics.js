import React from 'react';

const LiveStatistics = ({ gameState }) => {
    // Sicherheits-Check
    if (!gameState || !gameState.players) {
        return <div className="stats-wrapper" style={{justifyContent:'center', alignItems:'center', color:'#666'}}>Lade...</div>;
    }

    const p1 = gameState.players[0] || {};
    const p2 = gameState.players[1] || {};

    const val = (v, suffix = '') => (v !== undefined && v !== null ? v + suffix : '0' + suffix);
    const avg = (v) => (v ? parseFloat(v).toFixed(2) : '0.00');

    // ---------------------------------------------------------
    // VERSUCH: Short Leg aus den 'turns' (Würfen) rekonstruieren
    // ---------------------------------------------------------
    const calculateBestLegFromTurns = (player, playerIndex) => {
        // 1. Standard-Check
        if (player.bestLeg > 0) return player.bestLeg;

        // 2. Wir analysieren jeden einzelnen Wurf im Spiel
        if (gameState.turns && Array.isArray(gameState.turns) && gameState.turns.length > 0) {
            let legDartsCounter = {}; // Zählt Darts pro Leg
            let finishedLegsDarts = []; // Speichert Ergebnisse fertiger Legs
            
            // Wir müssen wissen, welche ID der Spieler hat
            const pId = player.id;

            // Gehe alle Würfe durch
            gameState.turns.forEach(turn => {
                // Ermittle, wer geworfen hat
                const throwerId = turn.player || turn.playerId || (turn.playerIndex === playerIndex ? pId : null);
                
                // Eine Leg-ID oder Zähler, um Würfe zuzuordnen (falls vorhanden)
                // Wenn keine Leg-ID da ist, versuchen wir es anhand von "Reset"-Punkten zu erraten
                // Aber oft gibt es 'legId' oder 'leg_id' im Turn
                const legKey = turn.legId || turn.leg_id || "unknown";

                // Wenn dieser Spieler geworfen hat, zähle hoch (Annahme: 3 Darts pro Turn, außer es steht explizit da)
                if (throwerId === pId || turn.playerIndex === playerIndex) {
                    const dartsInTurn = turn.darts || turn.dartsThrown || 3; 
                    
                    if (!legDartsCounter[legKey]) legDartsCounter[legKey] = 0;
                    legDartsCounter[legKey] += dartsInTurn;
                }

                // Prüfe, ob dieser Turn ein Leg beendet hat (Checkout)
                if (turn.checkout || turn.isCheckout || turn.score === 0 || (turn.pointsLeft === 0 && throwerId === pId)) {
                    if (legDartsCounter[legKey]) {
                        finishedLegsDarts.push(legDartsCounter[legKey]);
                    }
                }
            });

            if (finishedLegsDarts.length > 0) {
                return Math.min(...finishedLegsDarts);
            }
        }
        
        return 0;
    };

    const p1BestLeg = calculateBestLegFromTurns(p1, 0);
    const p2BestLeg = calculateBestLegFromTurns(p2, 1);

    // ---------------------------------------------------------
    // Stats & Helpers
    // ---------------------------------------------------------
    const calculateFirst9Avg = (player) => {
        const scores = player.scores || [];
        if (scores.length === 0) return '0.00';
        const first9Scores = scores.slice(0, 9);
        const totalPoints = first9Scores.reduce((sum, score) => sum + score, 0);
        const totalDarts = Math.min(first9Scores.length * 3, 9);
        if (totalDarts === 0) return '0.00';
        return (totalPoints / Math.ceil(totalDarts / 3)).toFixed(2);
    };

    const p1First9Avg = calculateFirst9Avg(p1);
    const p2First9Avg = calculateFirst9Avg(p2);

    const getStat = (p, ...keys) => {
        for (let key of keys) {
            if (p[key] !== undefined) return p[key];
        }
        return 0;
    };

    const p1Scores60Plus = getStat(p1, 'scores60plus', 'scores60s');
    const p2Scores60Plus = getStat(p2, 'scores60plus', 'scores60s');
    const p1Scores100Plus = getStat(p1, 'scores100plus', 'scores100s');
    const p2Scores100Plus = getStat(p2, 'scores100plus', 'scores100s');
    const p1Scores140Plus = getStat(p1, 'scores140plus', 'scores140s');
    const p2Scores140Plus = getStat(p2, 'scores140plus', 'scores140s');
    const p1Scores180 = getStat(p1, 'scores180', 'scores180s');
    const p2Scores180 = getStat(p2, 'scores180', 'scores180s');
    const p1HighFinish = getStat(p1, 'highestFinish', 'highFinish');
    const p2HighFinish = getStat(p2, 'highestFinish', 'highFinish');

    const p1Doubles = p1.doublesHit && p1.doublesThrown ? `${Math.round((p1.doublesHit / p1.doublesThrown) * 100)}% (${p1.doublesHit}/${p1.doublesThrown})` : '0% (0/0)';
    const p2Doubles = p2.doublesHit && p2.doublesThrown ? `${Math.round((p2.doublesHit / p2.doublesThrown) * 100)}% (${p2.doublesHit}/${p2.doublesThrown})` : '0% (0/0)';

    const StatRow = ({ label, v1, v2, highlightP1, highlightP2 }) => (
        <div className="stat-row">
            <div className={`stat-cell left ${highlightP1 ? 'highlight' : ''}`}>{v1}</div>
            <div className="stat-cell center">{label}</div>
            <div className={`stat-cell right ${highlightP2 ? 'highlight' : ''}`}>{v2}</div>
        </div>
    );

    // DEBUG VORBEREITUNG
    const getDeepDebug = () => {
        let info = "";
        
        // Check global Scores
        if (gameState.scores) {
            info += `GLOBAL SCORES TYPE: ${typeof gameState.scores}\n`;
            info += `GLOBAL SCORES: ${JSON.stringify(gameState.scores).substring(0, 150)}...\n\n`;
        } else {
            info += "GLOBAL SCORES: nicht vorhanden\n\n";
        }

        // Check global Turns
        if (gameState.turns && Array.isArray(gameState.turns)) {
            info += `TURNS: Array mit ${gameState.turns.length} Einträgen.\n`;
            if (gameState.turns.length > 0) {
                info += `Turn #1 Beispiel: ${JSON.stringify(gameState.turns[0])}\n`;
            }
        } else {
            info += "TURNS: nicht vorhanden oder kein Array\n";
        }

        return info;
    };

    return (
        <div className="stats-wrapper">
            <div className="stats-header">
                <div className="p-name">{p1.name || "Player 1"}</div>
                <div className="vs">VS</div>
                <div className="p-name">{p2.name || "Player 2"}</div>
            </div>

            <div className="stats-table">
                <StatRow
                    label="MATCH Ø"
                    v1={avg(p1.avg)}
                    v2={avg(p2.avg)}
                    highlightP1={parseFloat(p1.avg || 0) > parseFloat(p2.avg || 0)}
                    highlightP2={parseFloat(p2.avg || 0) > parseFloat(p1.avg || 0)}
                />
                <StatRow label="FIRST 9 Ø" v1={p1First9Avg} v2={p2First9Avg} />
                <StatRow label="DOPPEL %" v1={p1Doubles} v2={p2Doubles} />
                <StatRow label="60+" v1={val(p1Scores60Plus)} v2={val(p2Scores60Plus)} />
                <StatRow label="100+" v1={val(p1Scores100Plus)} v2={val(p2Scores100Plus)} />
                <StatRow label="140+" v1={val(p1Scores140Plus)} v2={val(p2Scores140Plus)} />
                <StatRow label="180ER" v1={val(p1Scores180)} v2={val(p2Scores180)} />
                <StatRow label="HIGH FINISH" v1={val(p1HighFinish)} v2={val(p2HighFinish)} />
                <StatRow label="SHORT LEG" v1={val(p1BestLeg)} v2={val(p2BestLeg)} />
            </div>

            {/* DEBUGGING - FINALER CHECK DER GLOBALEN DATEN */}
            <div style={{
                marginTop: '10px', 
                padding: '10px', 
                background: '#002', 
                color: '#aaf', 
                textAlign: 'left',
                fontSize: '11px',
                fontFamily: 'monospace',
                border: '1px solid blue',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
            }}>
                <strong>DEEP DIVE DEBUG:</strong><br/>
                {getDeepDebug()}
            </div>
        </div>
    );
};

export default LiveStatistics;