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
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a1a',
            borderRadius: '10px',
            padding: '15px',
            color: 'white'
        }}>
            {/* Cricket Targets Grid */}
            <div className="cricket-table" style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 1fr',
                gap: '8px',
                width: '100%',
                fontSize: '1.1em',
                flex: 1,
                alignContent: 'start'
            }}>
                {/* Header Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    fontSize: '0.9em'
                }}>
                    {player1?.name || 'Player 1'}
                    {user && user.id === player1?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    fontSize: '0.9em'
                }}>
                    Target
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px',
                    backgroundColor: '#333',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    fontSize: '0.9em'
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
                                padding: '12px 8px',
                                backgroundColor: targetClosed ? '#555' : (isClosed(p1Marks) ? '#4ade80' : '#333'),
                                borderRadius: '5px',
                                fontSize: '1.4em',
                                fontWeight: 'bold',
                                minHeight: '45px',
                                transition: 'background-color 0.3s ease'
                            }}>
                                {getMarkSymbol(p1Marks)}
                            </div>

                            {/* Target Number */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '12px 8px',
                                backgroundColor: '#444',
                                borderRadius: '5px',
                                fontSize: '1.3em',
                                fontWeight: 'bold',
                                minHeight: '45px'
                            }}>
                                {target === 25 ? 'BULL' : target}
                            </div>

                            {/* Player 2 Marks */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '12px 8px',
                                backgroundColor: targetClosed ? '#555' : (isClosed(p2Marks) ? '#4ade80' : '#333'),
                                borderRadius: '5px',
                                fontSize: '1.4em',
                                fontWeight: 'bold',
                                minHeight: '45px',
                                transition: 'background-color 0.3s ease'
                            }}>
                                {getMarkSymbol(p2Marks)}
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Active Player Indicator */}
            {gameState.gameStatus === 'active' && (
                <div style={{
                    marginTop: '15px',
                    padding: '8px 16px',
                    backgroundColor: '#4ade80',
                    borderRadius: '5px',
                    fontSize: '1.1em',
                    fontWeight: 'bold',
                    textAlign: 'center'
                }}>
                    {gameState.players[gameState.currentPlayerIndex]?.name} ist dran
                </div>
            )}
        </div>
    );
};

export default CricketBoard;
