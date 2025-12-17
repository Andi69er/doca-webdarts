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
    // BERECHNUNG FÜR SHORT LEG (BEST LEG)
    // Sucht an allen möglichen Orten nach dem Wert
    // ---------------------------------------------------------
    const findBestLeg = (player, playerIndex) => {
        // Liste aller möglichen Variablennamen, die Backends nutzen könnten
        const candidates = [
            player.bestLeg,
            player.best_leg,
            player.shortLeg,
            player.short_leg,
            player.bestLegDarts,
            player.best_leg_darts,
            // Oft sind Stats in einem Unterobjekt 'stats'
            player.stats ? player.stats.bestLeg : null,
            player.stats ? player.stats.best_leg : null,
            player.stats ? player.stats.shortLeg : null,
            player.stats ? player.stats.best_leg_darts : null
        ];

        // Suche den ersten Wert, der eine Zahl und größer als 0 ist
        const found = candidates.find(v => v && !isNaN(v) && parseInt(v) > 0);
        
        if (found) return found;

        // Fallback: Wenn es eine Leg-Historie im gameState gibt, berechne es selbst
        if (gameState.legs && Array.isArray(gameState.legs)) {
            const playerLegs = gameState.legs.filter(leg => 
                // Prüfe ob dieser Spieler das Leg gewonnen hat (Index, Name oder ID)
                leg.winner === playerIndex || 
                leg.winner === player.name || 
                leg.winningPlayer === playerIndex ||
                (leg.winner_id && leg.winner_id === player.id)
            );

            const dartsThrown = playerLegs.map(leg => 
                leg.darts || leg.dartsThrown || leg.darts_thrown || leg.throws
            ).filter(d => d > 0);

            if (dartsThrown.length > 0) {
                return Math.min(...dartsThrown);
            }
        }

        return 0; // Nichts gefunden oder noch kein Leg gewonnen
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

    // Werte sicher abrufen (Fallback auf 0)
    const p1Scores60Plus = p1.scores60plus || (p1.stats ? p1.stats.scores60plus : 0) || 0;
    const p2Scores60Plus = p2.scores60plus || (p2.stats ? p2.stats.scores60plus : 0) || 0;
    
    const p1Scores100Plus = p1.scores100plus || (p1.stats ? p1.stats.scores100plus : 0) || 0;
    const p2Scores100Plus = p2.scores100plus || (p2.stats ? p2.stats.scores100plus : 0) || 0;
    
    const p1Scores140Plus = p1.scores140plus || (p1.stats ? p1.stats.scores140plus : 0) || 0;
    const p2Scores140Plus = p2.scores140plus || (p2.stats ? p2.stats.scores140plus : 0) || 0;
    
    const p1Scores180 = p1.scores180 || (p1.stats ? p1.stats.scores180 : 0) || 0;
    const p2Scores180 = p2.scores180 || (p2.stats ? p2.stats.scores180 : 0) || 0;
    
    const p1HighFinish = p1.highestFinish || (p1.stats ? p1.stats.highestFinish : 0) || 0;
    const p2HighFinish = p2.highestFinish || (p2.stats ? p2.stats.highestFinish : 0) || 0;

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
                
                {/* 
                   Hier ist nur noch die Zeile SHORT LEG. 
                   Die Zeile "NIEDRIGSTES LEG IM MATCH" wurde entfernt. 
                */}
                <StatRow label="SHORT LEG" v1={val(p1BestLeg)} v2={val(p2BestLeg)} />
            </div>
        </div>
    );
};

export default LiveStatistics;