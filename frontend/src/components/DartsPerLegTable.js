import React from 'react';

const DartsPerLegTable = ({ gameState }) => {
    // Styles für Zentrierung und VS-Look
    const styles = {
        container: {
            backgroundColor: 'transparent', // Hintergrund vom Eltern-Element nutzen
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center', // Vertikal mittig
            alignItems: 'center',     // Horizontal mittig
            fontFamily: 'sans-serif',
        },
        header: {
            textAlign: 'center',
            color: '#ffd700', // Gold wie "Verlauf"
            fontSize: '0.9rem',
            marginBottom: '10px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            letterSpacing: '1px'
        },
        grid: {
            display: 'grid',
            // Spalten: Name(rechts) | Scores(links)
            gridTemplateColumns: 'auto auto', 
            columnGap: '15px',
            rowGap: '8px',
            alignItems: 'center',
            justifyContent: 'center'
        },
        playerName: {
            textAlign: 'right', // Namen rechtsbündig zur Mitte hin
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '1rem',
            whiteSpace: 'nowrap',
        },
        scoresRow: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start', // Zahlen starten direkt neben dem Namen
            gap: '8px',
            overflowX: 'auto',
            maxWidth: '200px' // Damit es nicht zu breit wird
        },
        scoreCell: {
            minWidth: '22px',
            textAlign: 'center',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: '500'
        },
        divider: {
            gridColumn: '1 / -1',
            height: '1px',
            backgroundColor: '#444',
            margin: '2px 0',
            width: '100%'
        },
        legNumRow: {
             display: 'flex',
             flexDirection: 'row',
             justifyContent: 'flex-start',
             gap: '8px',
             paddingTop: '5px'
        },
        legNum: {
            color: '#666',
            fontSize: '0.75rem',
            minWidth: '22px',
            textAlign: 'center'
        },
        bestLeg: {
            color: '#4CAF50', // Grün statt Unterstrich (sieht moderner aus)
            fontWeight: 'bold',
            borderBottom: '2px solid #4CAF50'
        }
    };

    if (!gameState) return <div style={{...styles.container, color:'#666'}}>Lade...</div>;

    const players = gameState.players || [];
    const p1 = players[0] || { name: 'Player 1', id: 'p1' };
    const p2 = players[1] || { name: 'Player 2', id: 'p2' };

    const allTurns = gameState.turns || {}; 
    const p1Turns = allTurns[p1.id] || [];
    const p2Turns = allTurns[p2.id] || [];

    const minLegs = 5;
    const currentMaxLegs = Math.max(p1Turns.length, p2Turns.length);
    const totalColumns = Math.max(minLegs, currentMaxLegs);

    const isBest = (val1, val2) => {
        if (!val1 || !val2 || val1 === '-' || val2 === '-') return false;
        return parseInt(val1) < parseInt(val2);
    };

    return (
        <div style={styles.container}>
            {/* Titel optional, falls du ihn nicht schon drüber hast */}
            {/* <div style={styles.header}>Darts pro Leg</div> */}

            <div style={styles.grid}>
                
                {/* --- Spieler 1 --- */}
                <div style={styles.playerName}>{p1.name}</div>
                <div style={styles.scoresRow}>
                    {Array.from({ length: totalColumns }).map((_, i) => {
                        const val = p1Turns[i] !== undefined ? p1Turns[i] : '-';
                        const opponentVal = p2Turns[i] !== undefined ? p2Turns[i] : '-';
                        const best = isBest(val, opponentVal);
                        
                        return (
                            <div key={i} style={{
                                ...styles.scoreCell, 
                                ...(best ? styles.bestLeg : {})
                            }}>
                                {val}
                            </div>
                        );
                    })}
                </div>

                {/* --- Trennlinie --- */}
                <div style={styles.divider}></div>

                {/* --- Spieler 2 --- */}
                <div style={styles.playerName}>{p2.name}</div>
                <div style={styles.scoresRow}>
                    {Array.from({ length: totalColumns }).map((_, i) => {
                        const val = p2Turns[i] !== undefined ? p2Turns[i] : '-';
                        const opponentVal = p1Turns[i] !== undefined ? p1Turns[i] : '-';
                        const best = isBest(val, opponentVal);

                        return (
                            <div key={i} style={{
                                ...styles.scoreCell, 
                                ...(best ? styles.bestLeg : {})
                            }}>
                                {val}
                            </div>
                        );
                    })}
                </div>

                {/* --- Leg Nummern --- */}
                <div></div> {/* Leerer Platz links */}
                <div style={styles.legNumRow}>
                    {Array.from({ length: totalColumns }).map((_, i) => (
                        <div key={i} style={styles.legNum}>{i + 1}</div>
                    ))}
                </div>

            </div>
        </div>
    );
};

export default DartsPerLegTable;