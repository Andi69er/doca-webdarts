import React from 'react';

const CricketHeader = ({ gameState, user }) => {
    if (!gameState || !gameState.players || gameState.mode !== 'cricket') return null;

    const isDoubles = gameState.teamMode === 'doubles';
    const players = gameState.players;
    
    // Gruppierung für Doubles
    const teamAPlayers = isDoubles ? players.filter(p => gameState.teamAssignments?.[p.id] === 'teamA') : [players[0]];
    const teamBPlayers = isDoubles ? players.filter(p => gameState.teamAssignments?.[p.id] === 'teamB') : [players[1]];

    const renderTeamInfo = (teamPlayers, teamKey) => {
        const primaryPlayer = teamPlayers[0];
        const teamName = isDoubles ? (gameState.teamNames?.[teamKey] || (teamKey === 'teamA' ? 'Team A' : 'Team B')) : primaryPlayer?.name;
        
        // Wer ist gerade dran?
        const activePlayer = teamPlayers.find(p => 
            gameState.players[gameState.currentPlayerIndex]?.id === p.id
        );

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <div style={{
                    fontSize: '1.1em',
                    fontWeight: 'bold',
                    marginBottom: '5px',
                    color: activePlayer ? 'yellow' : 'white'
                }}>
                    {teamName}
                    {isDoubles && (
                        <div style={{ fontSize: '0.7em', fontWeight: 'normal', opacity: 0.8 }}>
                            {teamPlayers.map(p => p.name + (user && user.id === p.id ? ' (Du)' : '')).join(' & ')}
                        </div>
                    )}
                    {!isDoubles && user && user.id === primaryPlayer?.id ? ' (Du)' : ''}
                </div>
                <div style={{
                    fontSize: '2em',
                    fontWeight: 'bold',
                    color: '#4ade80'
                }}>
                    {primaryPlayer?.points || 0}
                </div>
            </div>
        );
    };

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
            {renderTeamInfo(teamAPlayers, 'teamA')}

            {/* VS */}
            <div style={{
                fontSize: '1.5em',
                fontWeight: 'bold',
                color: '#ccc'
            }}>
                vs
            </div>

            {renderTeamInfo(teamBPlayers, 'teamB')}
        </div>
    );
};

export default CricketHeader;