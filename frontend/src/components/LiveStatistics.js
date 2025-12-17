import React from 'react';

const LiveStatistics = ({ gameState }) => {
    // Sicherheits-Check: Absturz verhindern, wenn Daten fehlen
    if (!gameState || !gameState.players) {
        return <div className="stats-wrapper" style={{justifyContent:'center', alignItems:'center', color:'#666'}}>Lade...</div>;
    }

    const p1 = gameState.players[0] || {};
    const p2 = gameState.players[1] || {};

    const val = (v, suffix = '') => (v !== undefined && v !== null ? v + suffix : '0' + suffix);
    const avg = (v) => (v ? parseFloat(v).toFixed(2) : '0.00');

    // Berechne 9-Dart Average (Average der ersten 9 Darts)
    const calculateFirst9Avg = (player) => {
        const scores = player.scores || [];
        if (scores.length === 0) return '0.00';

        // Nimm die ersten 9 Scores, aber maximal die verfügbaren
        const first9Scores = scores.slice(0, 9);
        const totalPoints = first9Scores.reduce((sum, score) => sum + score, 0);
        const totalDarts = Math.min(first9Scores.length * 3, 9); // Max 9 Darts

        if (totalDarts === 0) return '0.00';
        return (totalPoints / Math.ceil(totalDarts / 3)).toFixed(2);
    };

    const p1First9Avg = calculateFirst9Avg(p1);
    const p2First9Avg = calculateFirst9Avg(p2);

    // Berechne zusätzliche Statistiken
    const getScoreRange = (player, min, max = null) => {
        const scores = player.scores || [];
        if (max) {
            return scores.filter(s => s >= min && s <= max).length;
        }
        // Wenn kein max, dann zähle alle >= min (für 60+, 100+, 140+)
        if (min >= 60) {
            return scores.filter(s => s >= min).length;
        }
        // Für 19- zähle alle < min
        return scores.filter(s => s < min).length;
    };

    // (Variablen für Score Ranges, falls du sie später brauchst, lasse ich drin)
    const p1Scores19Minus = getScoreRange(p1, 19);
    const p2Scores19Minus = getScoreRange(p2, 19);
    // ... restliche Range-Berechnungen im Hintergrund ...

    // Verwende die vom Backend berechneten Werte (um Doppelzählung von 180 zu vermeiden)
    const p1Scores60Plus = p1.scores60plus || 0;
    const p2Scores60Plus = p2.scores60plus || 0;
    const p1Scores100Plus = p1.scores100plus || 0;
    const p2Scores100Plus = p2.scores100plus || 0;
    const p1Scores140Plus = p1.scores140plus || 0;
    const p2Scores140Plus = p2.scores140plus || 0;

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
                
                {/* Hier wird nun das niedrigste Leg (Short Leg) des jeweiligen Spielers angezeigt */}
                <StatRow label="SHORT LEG" v1={val(p1.bestLeg)} v2={val(p2.bestLeg)} />
            </div>
        </div>
    );
};

export default LiveStatistics;