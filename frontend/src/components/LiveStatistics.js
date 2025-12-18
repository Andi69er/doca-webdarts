import React from 'react';

const LiveStatistics = ({ gameState }) => {
    // Debugging (F12 im Browser -> Konsole): Damit sehen wir, was wirklich ankommt
    console.log("DEBUG GAMESTATE:", gameState);

    // Sicherheits-Check
    if (!gameState || !gameState.players) {
        return <div className="stats-wrapper" style={{justifyContent:'center', alignItems:'center', color:'#666'}}>Lade...</div>;
    }

    const p1 = gameState.players[0] || {};
    const p2 = gameState.players[1] || {};

    const val = (v, suffix = '') => (v !== undefined && v !== null ? v + suffix : '0' + suffix);
    const avg = (v) => (v ? parseFloat(v).toFixed(2) : '0.00');

    // ---------------------------------------------------------
    // BERECHNUNG FÜR SHORT LEG (BEST LEG)
    // ---------------------------------------------------------
    const findBestLeg = (player, playerIndex) => {
        // 1. Direkte Werte prüfen (falls das Backend sie doch liefert)
        const candidates = [
            player.bestLeg, player.best_leg, 
            player.shortLeg, player.short_leg, 
            player.bestLegDarts,
            player.stats ? player.stats.bestLeg : 0,
            player.stats ? player.stats.best_leg : 0
        ];
        const found = candidates.find(v => v && !isNaN(v) && parseInt(v) > 0);
        if (found) return found;

        // 2. Manuelle Berechnung aus der Historie (gameState.legs)
        // Das ist der wichtigste Teil, wenn das Backend keine fertige Zahl liefert.
        if (gameState.legs && Array.isArray(gameState.legs)) {
            
            // Wir filtern alle Legs, die dieser Spieler gewonnen hat.
            // WICHTIG: Wir prüfen ID, Name und Index!
            const wonLegs = gameState.legs.filter(leg => {
                const winner = leg.winner || leg.winningPlayer || leg.winner_id;
                
                // Check 1: Ist der Gewinner der Index (0 oder 1)?
                if (winner === playerIndex) return true;
                
                // Check 2: Ist der Gewinner die Player-ID? (Das ist wahrscheinlich der Fall!)
                if (player.id && winner === player.id) return true;
                
                // Check 3: Ist der Gewinner der Name?
                if (player.name && winner === player.name) return true;

                return false;
            });

            // Jetzt schauen wir uns die gewonnenen Legs an
            const dartCounts = wonLegs.map(leg => {
                // A) Steht die Anzahl der Darts direkt im Leg-Objekt?
                if (leg.darts && leg.darts > 0) return parseInt(leg.darts);
                if (leg.dartsThrown && leg.dartsThrown > 0) return parseInt(leg.dartsThrown);
                if (leg.throws && leg.throws > 0) return parseInt(leg.throws);

                // B) Wenn nicht: Können wir die Visits (Aufnahmen) zählen?
                // Meistens gibt es ein Array 'visits', 'scores' oder 'throws'
                const visits = leg.visits || leg.scores || leg.history;
                if (visits && Array.isArray(visits) && visits.length > 0) {
                    // Annahme: Jede Aufnahme hat 3 Darts. 
                    // (Das ist nicht 100% exakt für das Checkout, aber besser als 0)
                    return visits.length * 3;
                }
                
                return 0;
            }).filter(d => d > 0);

            if (dartCounts.length > 0) {
                return Math.min(...dartCounts);
            }
        }

        return 0;
    };

    const p1BestLeg = findBestLeg(p1, 0);
    const p2BestLeg = findBestLeg(p2, 1);
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

    // Score Ranges (mit Fallback auf stats-Objekt)
    const getStat = (p, key1, key2) => {
        return p[key1] || (p.stats ? p.stats[key1] : 0) || p[key2] || (p.stats ? p.stats[key2] : 0) || 0;
    }

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

    // Doppelquote
    const p1Doubles = p1.doublesHit && p1.doublesThrown 
        ? `${Math.round((p1.doublesHit / p1.doublesThrown) * 100)}% (${p1.doublesHit}/${p1.doublesThrown})` 
        : '0% (0/0)';
    const p2Doubles = p2.doublesHit && p2.doublesThrown 
        ? `${Math.round((p2.doublesHit / p2.doublesThrown) * 100)}% (${p2.doublesHit}/${p2.doublesThrown})` 
        : '0% (0/0)';

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
        </div>
    );
};

export default LiveStatistics;