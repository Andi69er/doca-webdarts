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
    // Aggressive Suche nach allen gespielten Legs (auch in Sets)
    // ---------------------------------------------------------
    const getAllLegs = () => {
        let allLegs = [];
        
        // 1. Suche in direkter Leg-Liste
        if (gameState.legs && Array.isArray(gameState.legs)) {
            allLegs = [...allLegs, ...gameState.legs];
        }

        // 2. Suche in Sets (falls Set-Modus)
        if (gameState.sets && Array.isArray(gameState.sets)) {
            gameState.sets.forEach(set => {
                if (set.legs && Array.isArray(set.legs)) {
                    allLegs = [...allLegs, ...set.legs];
                }
            });
        }

        // 3. Suche in matchLog oder history
        if (gameState.matchLog && Array.isArray(gameState.matchLog)) {
            allLegs = [...allLegs, ...gameState.matchLog];
        }
        
        return allLegs;
    };

    const playedLegs = getAllLegs();

    // ---------------------------------------------------------
    // BERECHNUNG: Short Leg aus der Liste aller Legs
    // ---------------------------------------------------------
    const calculateShortLeg = (player, playerIndex) => {
        // Zuerst: Gibt es einen direkten Wert im Spieler-Objekt?
        const directKeys = ['bestLeg', 'best_leg', 'shortLeg', 'short_leg', 'bestLegDarts', 'lowLeg'];
        for (let key of directKeys) {
            if (player[key] && parseInt(player[key]) > 0) return player[key];
            if (player.stats && player.stats[key] && parseInt(player.stats[key]) > 0) return player.stats[key];
        }

        if (playedLegs.length === 0) return 0;

        // Filtere Legs, die dieser Spieler gewonnen hat
        const wonLegs = playedLegs.filter(leg => {
            const winner = leg.winner || leg.winningPlayer || leg.winner_id;
            
            // Vergleiche Index (0/1), ID oder Name
            const byIndex = winner === playerIndex;
            const byId = player.id && winner === player.id;
            const byName = player.name && winner === player.name;
            
            // Manche Systeme nutzen auch 'result': 'won' im Kontext des Spielers
            return byIndex || byId || byName;
        });

        // Extrahiere Dart-Anzahl
        const dartsCounts = wonLegs.map(leg => {
            // Direkte Dart-Zahl
            if (leg.darts && leg.darts > 0) return parseInt(leg.darts);
            if (leg.dartsThrown && leg.dartsThrown > 0) return parseInt(leg.dartsThrown);
            if (leg.throws && leg.throws > 0) return parseInt(leg.throws);
            if (leg.darts_thrown && leg.darts_thrown > 0) return parseInt(leg.darts_thrown);

            // Wenn keine Zahl da ist: Visits zählen (Anzahl Aufnahmen * 3)
            // Das ist ungenau beim Checkout, aber besser als 0
            const visits = leg.visits || leg.scores || leg.history;
            if (visits && Array.isArray(visits) && visits.length > 0) {
                // Versuchen wir herauszufinden, wessen Visits das sind
                // (Oft sind Visits verschachtelt nach Spielern)
                return visits.length * 3; 
            }
            return 0;
        }).filter(d => d > 0);

        if (dartsCounts.length > 0) {
            return Math.min(...dartsCounts);
        }

        return 0;
    };

    const p1BestLeg = calculateShortLeg(p1, 0);
    const p2BestLeg = calculateShortLeg(p2, 1);

    // ---------------------------------------------------------

    // First 9 Average
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

    // Hilfsfunktion für Stats
    const getStat = (p, ...keys) => {
        for (let key of keys) {
            if (p[key]) return p[key];
            if (p.stats && p.stats[key]) return p.stats[key];
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

            {/* DEBUGGING BEREICH - Kann später entfernt werden */}
            <div style={{fontSize: '10px', color: '#555', marginTop: '10px', textAlign:'left', padding:'5px', border:'1px solid #333'}}>
                <strong>Debug Info:</strong><br/>
                Gefundene Legs total: {playedLegs.length}<br/>
                Keys in Leg #1: {playedLegs[0] ? Object.keys(playedLegs[0]).join(', ') : 'keine Legs'}<br/>
                P1 ID: {p1.id} | P2 ID: {p2.id}
            </div>
        </div>
    );
};

export default LiveStatistics;