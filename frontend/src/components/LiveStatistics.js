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
    // VERSUCH: Short Leg aus dem gesamten GameState suchen
    // ---------------------------------------------------------
    const findShortLegGlobal = (player, playerIndex) => {
        // 1. Check im Player-Objekt (falls es doch da ist)
        if (player.bestLeg > 0) return player.bestLeg;
        if (player.bestLegDarts > 0) return player.bestLegDarts;
        
        let allLegs = [];

        // 2. Wir suchen an allen möglichen Orten im gameState nach Listen
        if (gameState.matchLog && Array.isArray(gameState.matchLog)) allLegs = gameState.matchLog;
        else if (gameState.history && Array.isArray(gameState.history)) allLegs = gameState.history;
        else if (gameState.legs && Array.isArray(gameState.legs)) allLegs = gameState.legs;
        else if (gameState.timeline && Array.isArray(gameState.timeline)) allLegs = gameState.timeline;
        
        // Auch in Sets schauen
        if (gameState.sets && Array.isArray(gameState.sets)) {
            gameState.sets.forEach(set => {
                if (set.legs && Array.isArray(set.legs)) {
                    allLegs = [...allLegs, ...set.legs];
                }
            });
        }

        if (allLegs.length === 0) return 0;

        // Wir filtern die Legs, die dieser Spieler gewonnen hat
        const wonLegs = allLegs.filter(leg => {
            const w = leg.winner || leg.winningPlayer || leg.winner_id;
            // Prüfung auf Index, ID oder Name
            return w === playerIndex || w === player.id || w === player.name;
        });

        // Darts zählen
        const dartsCounts = wonLegs.map(leg => {
            if (leg.darts > 0) return leg.darts;
            if (leg.dartsThrown > 0) return leg.dartsThrown;
            if (leg.throws > 0) return leg.throws;
            // Falls Visits gespeichert sind
            if (leg.visits && Array.isArray(leg.visits)) return leg.visits.length * 3;
            return 0;
        }).filter(d => d > 0);

        if (dartsCounts.length > 0) return Math.min(...dartsCounts);
        
        return 0;
    };

    const p1BestLeg = findShortLegGlobal(p1, 0);
    const p2BestLeg = findShortLegGlobal(p2, 1);

    // ---------------------------------------------------------
    // DEBUG HELPERS
    // ---------------------------------------------------------
    const getGameStateKeys = () => {
        // Wir zeigen nur die Schlüssel (Namen) der Felder an, um zu sehen was da ist
        return Object.keys(gameState).join(', ');
    };

    const getArrayCheck = (key) => {
        const val = gameState[key];
        if (Array.isArray(val)) return `${key}: [Array mit ${val.length} Einträgen]`;
        return null;
    };

    // ---------------------------------------------------------
    // Standard Stats
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

            {/* DEBUGGING - ZEIGT DIE STRUKTUR VOM SPIEL AN */}
            <div style={{
                marginTop: '10px', 
                padding: '10px', 
                background: '#222', 
                color: '#0f0', 
                textAlign: 'left',
                fontSize: '11px',
                fontFamily: 'monospace',
                border: '2px solid #0f0'
            }}>
                <strong>GAME STATE STRUKTUR:</strong><br/>
                Keys: {getGameStateKeys()}<br/>
                <br/>
                <strong>Mögliche Listen:</strong><br/>
                {getArrayCheck('matchLog') || '- kein matchLog'}<br/>
                {getArrayCheck('history') || '- keine history'}<br/>
                {getArrayCheck('timeline') || '- keine timeline'}<br/>
                {getArrayCheck('sets') || '- keine sets'}
            </div>
        </div>
    );
};

export default LiveStatistics;