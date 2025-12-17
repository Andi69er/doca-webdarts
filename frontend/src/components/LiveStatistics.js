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
    // NEU: Erweiterte Berechnung für das Short Leg (Best Leg)
    // ---------------------------------------------------------
    const calculateBestLeg = (player, playerIndex) => {
        // 1. Wenn der Wert direkt im Spieler-Objekt steht und > 0 ist, nimm ihn
        if (player.bestLeg && player.bestLeg > 0) return player.bestLeg;
        if (player.shortLeg && player.shortLeg > 0) return player.shortLeg; // Manchmal heißt es shortLeg

        // 2. Falls gameState eine Leg-Historie hat ('legs' oder 'matchLog'), berechne es selbst
        // Wir suchen nach Legs, die dieser Spieler gewonnen hat
        const history = gameState.legs || gameState.matchLog || gameState.sets; 
        
        if (history && Array.isArray(history)) {
            // Filtere alle Legs, die dieser Spieler gewonnen hat
            // Wir prüfen auf Index (0/1) oder Name
            const wonLegs = history.filter(leg => 
                leg.winner === playerIndex || 
                leg.winner === player.name || 
                leg.winningPlayer === playerIndex
            );

            // Extrahiere die Anzahl der Darts (Feldname variiert oft: 'darts', 'dartsThrown', 'throws')
            const dartCounts = wonLegs.map(leg => {
                return leg.darts || leg.dartsThrown || leg.throws || 0;
            }).filter(d => d > 0);

            // Wenn wir Werte gefunden haben, nimm den kleinsten (Minimum)
            if (dartCounts.length > 0) {
                return Math.min(...dartCounts);
            }
        }

        return 0; // Kein Short Leg gefunden
    };

    const p1BestLeg = calculateBestLeg(p1, 0);
    const p2BestLeg = calculateBestLeg(p2, 1);
    // ---------------------------------------------------------


    // First 9 Average Berechnung
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

    // Score Ranges
    const p1Scores60Plus = p1.scores60plus || 0;
    const p2Scores60Plus = p2.scores60plus || 0;
    const p1Scores100Plus = p1.scores100plus || 0;
    const p2Scores100Plus = p2.scores100plus || 0;
    const p1Scores140Plus = p1.scores140plus || 0;
    const p2Scores140Plus = p2.scores140plus || 0;

    // Doppelquote
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
                <StatRow label="180ER" v1={val(p1.scores180)} v2={val(p2.scores180)} />
                <StatRow label="HIGH FINISH" v1={val(p1.highestFinish)} v2={val(p2.highestFinish)} />
                
                {/* Hier verwenden wir jetzt die berechneten Werte */}
                <StatRow label="SHORT LEG" v1={val(p1BestLeg)} v2={val(p2BestLeg)} />
            </div>
        </div>
    );
};

export default LiveStatistics;