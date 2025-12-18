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
    // INTELLIGENTE SUCHE NACH SHORT LEG
    // ---------------------------------------------------------
    const findShortLeg = (player, playerIndex) => {
        // 1. Direkter Wert im Spieler?
        if (player.bestLeg > 0) return player.bestLeg;
        if (player.stats && player.stats.bestLeg > 0) return player.stats.bestLeg;

        // 2. Suche in 'legsWon' im Haupt-State
        // Manche Systeme speichern hier Arrays: [{winner: 0, darts: 15}, ...]
        if (gameState.legsWon && Array.isArray(gameState.legsWon)) {
            const myLegs = gameState.legsWon.filter(l => 
                l.winner === playerIndex || l.winnerId === player.id
            );
            const darts = myLegs.map(l => l.darts || l.dartsThrown || 0).filter(d => d > 0);
            if (darts.length > 0) return Math.min(...darts);
        }

        // 3. Suche in 'history' des Spielers (falls vorhanden)
        if (player.history && Array.isArray(player.history)) {
            const hDarts = player.history.map(h => h.darts || h.dartsThrown || h.throws || 0).filter(d => d > 0);
            if (hDarts.length > 0) return Math.min(...hDarts);
        }

        // 4. Fallback: Wenn wir finishes haben, gibt es vielleicht ein 'darts' array gleicher Länge?
        if (player.finishes && player.finishes.length > 0) {
            // Check auf 'legDarts', 'dartsPerLeg'
            if (player.legDarts && Array.isArray(player.legDarts)) {
                return Math.min(...player.legDarts.filter(d => d > 0));
            }
        }

        return 0;
    };

    const p1BestLeg = findShortLeg(p1, 0);
    const p2BestLeg = findShortLeg(p2, 1);

    // ---------------------------------------------------------
    // Debug Daten Vorbereitung
    // ---------------------------------------------------------
    const getP2Debug = () => {
        // Wir kopieren P2, entfernen aber riesige Arrays für die Lesbarkeit
        const cleanP2 = { ...p2 };
        if (cleanP2.scores) cleanP2.scores = `[Array ${cleanP2.scores.length}]`;
        // Wir wollen history sehen, falls es existiert
        if (!cleanP2.history || cleanP2.history.length === 0) cleanP2.history = "Leer/Nicht vorhanden";
        
        return JSON.stringify(cleanP2, null, 2);
    };

    const getGlobalDebug = () => {
        return `legsWon: ${JSON.stringify(gameState.legsWon)}\nsetsWon: ${JSON.stringify(gameState.setsWon)}`;
    };

    // ---------------------------------------------------------
    // Restliche Stats
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

            {/* DEBUGGING - ZEIGT PLAYER 2 und GLOBALE LEGS */}
            <div style={{
                marginTop: '10px', 
                padding: '10px', 
                background: '#000', 
                color: '#0ff', 
                textAlign: 'left',
                fontSize: '11px',
                fontFamily: 'monospace',
                border: '1px solid cyan',
                whiteSpace: 'pre-wrap'
            }}>
                <strong>CHECK (Player 2 & LegsWon):</strong><br/>
                {getGlobalDebug()}<br/>
                -----------------<br/>
                P2 DATA:<br/>
                {getP2Debug()}
            </div>
        </div>
    );
};

export default LiveStatistics;