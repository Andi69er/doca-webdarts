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
    // BERECHNUNG: Short Leg via 'checkoutDarts'
    // ---------------------------------------------------------
    const findShortLeg = (player, playerIndex) => {
        // 1. Zuerst schauen, ob es direkt beim Spieler steht (Standard-Weg)
        if (player.bestLeg > 0) return player.bestLeg;

        // 2. Wir untersuchen das Feld 'checkoutDarts' aus dem Haupt-GameState
        const cd = gameState.checkoutDarts;

        if (cd) {
            // FALL A: Es ist ein Array von Objekten (z.B. [{winner: 0, darts: 15}])
            if (Array.isArray(cd)) {
                // Filtere Einträge, die zu diesem Spieler gehören
                const playerCheckouts = cd.filter(entry => {
                    // Prüfe auf Index, ID oder Name
                    if (entry.winner === playerIndex) return true;
                    if (entry.winnerIndex === playerIndex) return true;
                    if (entry.player === player.name) return true;
                    if (entry.playerId === player.id) return true;
                    // Manchmal ist das Array einfach nach Spielerindex sortiert (Array in Array)
                    if (Array.isArray(entry) && cd.indexOf(entry) === playerIndex) return true;
                    return false;
                });

                // Sammle die Dart-Zahlen
                const darts = playerCheckouts.map(entry => {
                    if (typeof entry === 'number') return entry; // Falls es direkt Zahlen sind
                    return entry.darts || entry.count || entry.throws || 0;
                }).filter(d => d > 0);

                if (darts.length > 0) return Math.min(...darts);
            }
            
            // FALL B: Es ist ein Objekt mit Player-IDs als Keys (z.B. { "player_id": [15, 18] })
            else if (typeof cd === 'object') {
                // Suche nach der ID oder dem Index des Spielers im Objekt
                let playerStats = cd[player.id] || cd[player.name] || cd[playerIndex];
                
                if (playerStats) {
                    // Wenn es ein einzelner Wert ist
                    if (typeof playerStats === 'number' && playerStats > 0) return playerStats;
                    
                    // Wenn es ein Array von Darts ist
                    if (Array.isArray(playerStats)) {
                        const valid = playerStats.filter(d => typeof d === 'number' && d > 0);
                        if (valid.length > 0) return Math.min(...valid);
                    }
                }
            }
        }

        return 0;
    };

    const p1BestLeg = findShortLeg(p1, 0);
    const p2BestLeg = findShortLeg(p2, 1);

    // ---------------------------------------------------------
    // Restliche Stats (unverändert)
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

            {/* DEBUGGING - WICHTIG: Zeigt Inhalt von checkoutDarts */}
            <div style={{
                marginTop: '10px', 
                padding: '10px', 
                background: '#440', 
                color: '#ff0', 
                textAlign: 'left',
                fontSize: '11px',
                fontFamily: 'monospace',
                border: '2px solid yellow',
                wordBreak: 'break-all'
            }}>
                <strong>CHECKOUT DARTS DATEN:</strong><br/>
                {JSON.stringify(gameState.checkoutDarts, null, 2)}
            </div>
        </div>
    );
};

export default LiveStatistics;