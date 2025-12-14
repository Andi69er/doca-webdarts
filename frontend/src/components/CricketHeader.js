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
            padding: '15px 20px',
            backgroundColor: '#1a1a1a',
            color: 'white',
            borderBottom: '1px solid #333'
        }}>
            {/* Player 1 */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{
                    fontSize: '1.1em',
                    fontWeight: 'bold',
                    marginBottom: '5px'
                }}>
                    {player1?.name || 'Player 1'}
                    {user && user.id === player1?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    fontSize: '2em',
                    fontWeight: 'bold',
                    color: '#4ade80'
                }}>
                    {player1?.points || 0}
                </div>
            </div>

            {/* VS */}
            <div style={{
                fontSize: '1.5em',
                fontWeight: 'bold',
                color: '#ccc'
            }}>
                vs
            </div>

            {/* Player 2 */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{
                    fontSize: '1.1em',
                    fontWeight: 'bold',
                    marginBottom: '5px'
                }}>
                    {player2?.name || 'Player 2'}
                    {user && user.id === player2?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    fontSize: '2em',
                    fontWeight: 'bold',
                    color: '#4ade80'
                }}>
                    {player2?.points || 0}
                </div>
            </div>
        </div>
    );
};

export default CricketHeader;