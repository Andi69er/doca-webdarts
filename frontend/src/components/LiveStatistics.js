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
    // Versuch, das Short Leg zu finden (anhand gängiger Namen)
    // ---------------------------------------------------------
    const findBestLeg = (player) => {
        // Liste der üblichen Verdächtigen
        const candidates = [
            player.bestLeg, player.best_leg, 
            player.shortLeg, player.short_leg, 
            player.bestLegDarts, player.best_leg_darts,
            player.lowLeg, player.low_leg,
            player.fastestLeg,
            player.minDarts,
            // Stats Unterobjekt
            player.stats ? player.stats.bestLeg : null,
            player.stats ? player.stats.best_leg : null,
            player.stats ? player.stats.shortLeg : null,
            player.stats ? player.stats.bestLegDarts : null
        ];

        // Nimm den ersten Wert > 0
        const found = candidates.find(v => v && !isNaN(v) && parseInt(v) > 0);
        return found || 0;
    };

    const p1BestLeg = findBestLeg(p1);
    const p2BestLeg = findBestLeg(p2);
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

    // Score Ranges & High Finish (Fallback Logik)
    const getStat = (p, ...keys) => {
        for (let key of keys) {
            if (p[key] !== undefined) return p[key];
            if (p.stats && p.stats[key] !== undefined) return p.stats[key];
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
    const p1HighFinish = getStat(p1, 'highestFinish', 'highFinish', 'bestFinish');
    const p2HighFinish = getStat(p2, 'highestFinish', 'highFinish', 'bestFinish');

    const p1Doubles = p1.doublesHit && p1.doublesThrown ? `${Math.round((p1.doublesHit / p1.doublesThrown) * 100)}% (${p1.doublesHit}/${p1.doublesThrown})` : '0% (0/0)';
    const p2Doubles = p2.doublesHit && p2.doublesThrown ? `${Math.round((p2.doublesHit / p2.doublesThrown) * 100)}% (${p2.doublesHit}/${p2.doublesThrown})` : '0% (0/0)';

    const StatRow = ({ label, v1, v2, highlightP1, highlightP2 }) => (
        <div className="stat-row">
            <div className={`stat-cell left ${highlightP1 ? 'highlight' : ''}`}>{v1}</div>
            <div className="stat-cell center">{label}</div>
            <div className={`stat-cell right ${highlightP2 ? 'highlight' : ''}`}>{v2}</div>
        </div>
    );

    // DEBUG HILFE: Sammle alle Keys von P1
    const p1Keys = Object.keys(p1).join(', ');
    const p1StatsKeys = p1.stats ? Object.keys(p1.stats).join(', ') : 'kein stats objekt';

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

            {/* WICHTIG: Das hier zeigt uns, welche Daten überhaupt da sind! */}
            <div style={{fontSize: '10px', color: '#888', marginTop: '10px', textAlign:'left', padding:'5px', borderTop:'1px solid #333', wordBreak: 'break-all'}}>
                <strong>DATEN ANALYSE (P1):</strong><br/>
                Haupt-Daten: {p1Keys}<br/><br/>
                Stats-Daten: {p1StatsKeys}
            </div>
        </div>
    );
};

export default LiveStatistics;