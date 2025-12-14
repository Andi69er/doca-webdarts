import React from 'react';

const CricketBoard = ({ gameState, user }) => {
    if (!gameState || !gameState.players || gameState.mode !== 'cricket') return null;

    const players = gameState.players;
    const player1 = players[0];
    const player2 = players[1];

    const targets = [20, 19, 18, 17, 16, 15, 25]; // 25 is bullseye

    const getMarkSymbol = (marks) => {
        if (marks === 0) return '';
        if (marks === 1) return '/';
        if (marks === 2) return 'X';
        if (marks >= 3) return '⊗';
        return '';
    };

    const isClosed = (marks) => marks >= 3;

    return (
        <div className="cricket-board" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
            backgroundColor: '#1a1a1a',
            borderRadius: '10px',
            padding: '20px',
            color: 'white'
        }}>
            <h2 style={{ marginBottom: '20px', fontSize: '2em', textAlign: 'center' }}>CRICKET</h2>

            {/* Scoreboard Table */}
            <div className="cricket-table" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 1fr',
                gap: '10px',
                width: '100%',
                fontSize: '1.2em'
            }}>
                {/* Header Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontWeight: 'bold'
                }}>
                    {player1?.name || 'Player 1'}
                    {user && user.id === player1?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontWeight: 'bold'
                }}>
                    Target
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontWeight: 'bold'
                }}>
                    {player2?.name || 'Player 2'}
                    {user && user.id === player2?.id ? ' (Du)' : ''}
                </div>

                {/* Target Rows */}
                {targets.map(target => {
                    const p1Marks = player1?.marks?.[target] || 0;
                    const p2Marks = player2?.marks?.[target] || 0;
                    const targetClosed = isClosed(p1Marks) && isClosed(p2Marks);

                    return (
                        <React.Fragment key={target}>
                            {/* Player 1 Marks */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '15px 10px',
                                backgroundColor: targetClosed ? '#555' : (isClosed(p1Marks) ? '#4ade80' : '#333'),
                                borderRadius: '5px',
                                fontSize: '1.5em',
                                fontWeight: 'bold',
                                minHeight: '50px'
                            }}>
                                {getMarkSymbol(p1Marks)}
                            </div>

                            {/* Target Number */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '15px 10px',
                                backgroundColor: '#444',
                                borderRadius: '5px',
                                fontSize: '1.5em',
                                fontWeight: 'bold',
                                minHeight: '50px'
                            }}>
                                {target === 25 ? 'BULL' : target}
                            </div>

                            {/* Player 2 Marks */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '15px 10px',
                                backgroundColor: targetClosed ? '#555' : (isClosed(p2Marks) ? '#4ade80' : '#333'),
                                borderRadius: '5px',
                                fontSize: '1.5em',
                                fontWeight: 'bold',
                                minHeight: '50px'
                            }}>
                                {getMarkSymbol(p2Marks)}
                            </div>
                        </React.Fragment>
                    );
                })}

                {/* Total Score Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '15px 10px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontSize: '1.8em',
                    fontWeight: 'bold',
                    color: '#4ade80'
                }}>
                    {player1?.points || 0}
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '15px 10px',
                    backgroundColor: '#444',
                    borderRadius: '5px',
                    fontSize: '1.2em',
                    fontWeight: 'bold'
                }}>
                    TOTAL
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '15px 10px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontSize: '1.8em',
                    fontWeight: 'bold',
                    color: '#4ade80'
                }}>
                    {player2?.points || 0}
                </div>
            </div>

            {/* Active Player Indicator */}
            {gameState.gameStatus === 'active' && (
                <div style={{
                    marginTop: '20px',
                    padding: '10px 20px',
                    backgroundColor: '#4ade80',
                    borderRadius: '5px',
                    fontSize: '1.2em',
                    fontWeight: 'bold'
                }}>
                    {gameState.players[gameState.currentPlayerIndex]?.name} ist dran
                </div>
            )}
        </div>
    );
};

export default CricketBoard;
