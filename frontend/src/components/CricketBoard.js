import React from 'react';

const CricketBoard = ({ gameState, user }) => {
    // Sicherheitscheck: Wenn kein Spielstatus da ist, nichts anzeigen
    if (!gameState || !gameState.players || gameState.mode !== 'cricket') return null;

    const players = gameState.players;
    const player1 = players[0];
    const player2 = players[1];

    // Die Ziel-Segmente für Cricket
    const targets = [20, 19, 18, 17, 16, 15, 25]; // 25 = Bull

    // Hilfsfunktion: Wandelt Trefferanzahl in Symbole um
    const getMarkSymbol = (marks) => {
        if (!marks || marks === 0) return '';
        if (marks === 1) return '/';
        if (marks === 2) return 'X';
        if (marks >= 3) return '⊗'; // Geschlossen
        return '';
    };

    // Hilfsfunktion: Prüft, ob ein Segment geschlossen ist (>= 3 Treffer)
    const isClosed = (marks) => marks >= 3;

    return (
        <div className="cricket-board" style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a1a',
            borderRadius: '10px',
            padding: '20px',
            color: 'white'
        }}>
            <h3 style={{
                margin: '0 0 20px 0',
                textAlign: 'center',
                fontSize: '1.4em',
                fontWeight: 'bold',
                color: '#4ade80' // Grüne Überschrift passend zum Design
            }}>
                SCOREBOARD
            </h3>

            {/* Das Grid-Layout: Spieler 1 | Target | Spieler 2 */}
            <div className="cricket-table" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 1fr', // 3 Spalten
                gap: '8px',
                width: '100%',
                fontSize: '1.1em',
                flex: 1,
                alignContent: 'start'
            }}>
                {/* --- KOPFZEILE (NAMEN) --- */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '8px', backgroundColor: '#333', borderRadius: '5px',
                    fontWeight: 'bold', fontSize: '0.9em', color: '#ccc'
                }}>
                    {player1?.name || 'Player 1'}
                    {user && user.id === player1?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '8px', backgroundColor: '#333', borderRadius: '5px',
                    fontWeight: 'bold', fontSize: '0.9em', color: '#ccc'
                }}>
                    Target
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '8px', backgroundColor: '#333', borderRadius: '5px',
                    fontWeight: 'bold', fontSize: '0.9em', color: '#ccc'
                }}>
                    {player2?.name || 'Player 2'}
                    {user && user.id === player2?.id ? ' (Du)' : ''}
                </div>

                {/* --- HAUPTZEILEN (20 bis Bull) --- */}
                {targets.map(target => {
                    const p1Marks = player1?.marks?.[target] || 0;
                    const p2Marks = player2?.marks?.[target] || 0;
                    
                    // Prüfen, ob beide das Segment zu haben (dann wird es grau/inaktiv)
                    const bothClosed = isClosed(p1Marks) && isClosed(p2Marks);

                    return (
                        <React.Fragment key={target}>
                            {/* Player 1 Marks */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '12px 8px',
                                backgroundColor: bothClosed ? '#444' : (isClosed(p1Marks) ? '#2e5c3e' : '#252525'),
                                color: isClosed(p1Marks) ? '#4ade80' : 'white',
                                borderRadius: '5px',
                                fontSize: '1.4em', fontWeight: 'bold', minHeight: '45px',
                                transition: 'all 0.3s ease',
                                boxShadow: isClosed(p1Marks) ? '0 0 5px rgba(74, 222, 128, 0.2)' : 'none'
                            }}>
                                {getMarkSymbol(p1Marks)}
                            </div>

                            {/* Target Zahl */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '12px 8px',
                                backgroundColor: '#333',
                                color: bothClosed ? '#666' : '#fff',
                                textDecoration: bothClosed ? 'line-through' : 'none',
                                borderRadius: '5px',
                                fontSize: '1.3em', fontWeight: 'bold', minHeight: '45px'
                            }}>
                                {target === 25 ? 'BULL' : target}
                            </div>

                            {/* Player 2 Marks */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '12px 8px',
                                backgroundColor: bothClosed ? '#444' : (isClosed(p2Marks) ? '#2e5c3e' : '#252525'),
                                color: isClosed(p2Marks) ? '#4ade80' : 'white',
                                borderRadius: '5px',
                                fontSize: '1.4em', fontWeight: 'bold', minHeight: '45px',
                                transition: 'all 0.3s ease',
                                boxShadow: isClosed(p2Marks) ? '0 0 5px rgba(74, 222, 128, 0.2)' : 'none'
                            }}>
                                {getMarkSymbol(p2Marks)}
                            </div>
                        </React.Fragment>
                    );
                })}

                {/* --- TOTAL SCORE ZEILE (Wichtig für Cricket!) --- */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '15px', backgroundColor: '#333', borderRadius: '5px',
                    fontSize: '1.5em', fontWeight: 'bold', color: '#4ade80', marginTop: '10px'
                }}>
                    {player1?.points || 0}
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '15px', backgroundColor: '#333', borderRadius: '5px',
                    fontSize: '1em', fontWeight: 'bold', color: '#bbb', marginTop: '10px'
                }}>
                    TOTAL
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '15px', backgroundColor: '#333', borderRadius: '5px',
                    fontSize: '1.5em', fontWeight: 'bold', color: '#4ade80', marginTop: '10px'
                }}>
                    {player2?.points || 0}
                </div>

            </div>

            {/* Anzeige wer dran ist */}
            {gameState.gameStatus === 'active' && (
                <div style={{
                    marginTop: '20px',
                    padding: '12px',
                    backgroundColor: '#4ade80',
                    color: '#000',
                    borderRadius: '5px',
                    fontSize: '1.2em',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    boxShadow: '0 0 10px rgba(74, 222, 128, 0.4)'
                }}>
                    {gameState.players[gameState.currentPlayerIndex]?.name} ist dran
                </div>
            )}
        </div>
    );
};

export default CricketBoard;