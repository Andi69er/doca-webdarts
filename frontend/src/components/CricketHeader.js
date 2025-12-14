import React from 'react';

const CricketHeader = ({ gameState, user }) => {
    if (!gameState || !gameState.players || gameState.mode !== 'cricket') return null;

    const players = gameState.players;
    const player1 = players[0];
    const player2 = players[1];

    return (
        <div className="cricket-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '10px',
            marginBottom: '20px',
            color: 'white'
        }}>
            {/* Player 1 Section */}
            <div className="player-section" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1
            }}>
                <h2 style={{
                    margin: '0 0 10px 0',
                    fontSize: '2.5em',
                    fontWeight: 'bold',
                    color: '#4ade80'
                }}>
                    {player1?.points || 0}
                </h2>
                <div style={{
                    fontSize: '1.2em',
                    fontWeight: 'bold',
                    textAlign: 'center'
                }}>
                    {player1?.name || 'Player 1'}
                    {user && user.id === player1?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    fontSize: '0.9em',
                    color: '#ccc',
                    marginTop: '5px'
                }}>
                    Sets: {player1?.legs || 0} | Legs: {player1?.sets || 0}
                </div>
            </div>

            {/* Center Title */}
            <div className="game-title" style={{
                flex: 1,
                textAlign: 'center'
            }}>
                <h1 style={{
                    margin: 0,
                    fontSize: '3em',
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #4ade80, #60a5fa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                }}>
                    CRICKET
                </h1>
            </div>

            {/* Player 2 Section */}
            <div className="player-section" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1
            }}>
                <h2 style={{
                    margin: '0 0 10px 0',
                    fontSize: '2.5em',
                    fontWeight: 'bold',
                    color: '#4ade80'
                }}>
                    {player2?.points || 0}
                </h2>
                <div style={{
                    fontSize: '1.2em',
                    fontWeight: 'bold',
                    textAlign: 'center'
                }}>
                    {player2?.name || 'Player 2'}
                    {user && user.id === player2?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    fontSize: '0.9em',
                    color: '#ccc',
                    marginTop: '5px'
                }}>
                    Sets: {player2?.legs || 0} | Legs: {player2?.sets || 0}
                </div>
            </div>
        </div>
    );
};

export default CricketHeader;