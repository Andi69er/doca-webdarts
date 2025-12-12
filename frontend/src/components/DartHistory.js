import React, { useEffect, useRef } from 'react';
// Styles kommen idealerweise global oder inline, um Konflikte zu vermeiden

const DartHistory = ({ history, currentUserId }) => {
    // Falls history direkt als Array kommt (von PlayerScores übergeben)
    // ODER falls wir das gameState Objekt bekommen (wie in deinem Code-Beispiel)

    // Wir versuchen, eine saubere Liste zu extrahieren
    let displayList = [];

    if (Array.isArray(history)) {
        displayList = history;
    }
    // Fallback: Falls "history" eigentlich das "room" Objekt ist (wie in deinem Code)
    else if (history && history.gameState) {
        const room = history;
        const { mode } = room.gameState;

        // Versuchen, eine gemeinsame History zu finden
        if (room.gameState.throwHistory) {
             displayList = room.gameState.throwHistory;
        }
        // Falls X01 Turns nach Spieler getrennt sind, müssen wir sie mergen (komplexer)
        else if (room.gameState.turns) {
             // Hier müssten wir wissen, wie 'turns' aussieht.
             // Vereinfachung: Wir nehmen an, PlayerScores.js übergibt uns schon das richtige Array.
             displayList = [];
        }
    }

    // Gruppieren nach Leg (jede 3 Würfe ein Leg)
    const groupedByLeg = [];
    for (let i = 0; i < displayList.length; i += 3) {
        groupedByLeg.push(displayList.slice(i, i + 3));
    }

    const listRef = useRef(null);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [displayList]);

    if (!displayList || displayList.length === 0) {
        return <div style={{textAlign: 'center', color: '#666', fontSize: '0.8rem', paddingTop: '10px'}}>Keine Würfe</div>;
    }

    return (
        <div className="throw-history-container" ref={listRef} style={{height: '100%', overflowY: 'auto'}}>
            <ul className="throw-history-list" style={{listStyle: 'none', padding: 0, margin: 0}}>
                {displayList.map((entry, index) => {
                    // Wert extrahieren (kann Objekt oder Zahl sein)
                    let score = typeof entry === 'object' ? (entry.score || entry.points || entry.value) : entry;
                    
                    // Wer hat geworfen? (Annahme: id oder playerId im Objekt)
                    const isMe = entry.userId === currentUserId || entry.playerId === currentUserId;
                    
                    return (
                        <li key={index} style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #333',
                            background: '#222',
                            color: '#fff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderLeft: isMe ? '3px solid #ffcc00' : '3px solid #ccc'
                        }}>
                            <span style={{color: '#888', fontSize: '0.7rem'}}>#{index + 1}</span>
                            <span style={{fontWeight: 'bold'}}>{score}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default DartHistory;