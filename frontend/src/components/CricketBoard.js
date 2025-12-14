import React from 'react';

const CricketBoard = ({ gameState, user }) => {
    if (!gameState || !gameState.players || gameState.mode !== 'cricket') return null;

    const players = gameState.players;
    const player1 = players[0];
    const player2 = players[1];

    const targets = [20, 19, 18, 17, 16, 15, 25]; // 25 is bullseye

    const renderPlayerCricketCard = (player, label, isRightSide = false) => {
        if (!player) {
            return (
                <div className="player-card empty">
                    <h3>{label}</h3>
                    <div className="waiting-text">Warte...</div>
                </div>
            );
        }

        const isActive = gameState && gameState.gameStatus === 'active' && gameState.players[gameState.currentPlayerIndex]?.id === player.id;

        // --- Block: Sets & Legs (Graue Box) ---
        const LegsBlock = (
            <div className="legs-section-bild1" style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-around',
                backgroundColor: '#333',
                borderRadius: '6px',
                padding: '5px 10px',
                minWidth: '80px',
                margin: '0 10px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#aaa' }}>Legs</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{player.legs || 0}</span>
                </div>
            </div>
        );

        // --- Block: Points (Grüne Zahl) ---
        const PointsBlock = (
            <div className="player-score" style={{ fontSize: '4.5em', fontWeight: 'bold', color: '#4ade80', margin: '0 15px', lineHeight: 1 }}>
                {player.points || 0}
            </div>
        );

        // --- Block: Cricket Targets ---
        const CricketTargetsBlock = (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 15px', width: '200px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', marginBottom: '10px' }}>
                    {targets.map(target => {
                        const marks = player.marks?.[target] || 0;
                        const isClosed = marks >= 3;
                        return (
                            <div key={target} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '5px',
                                backgroundColor: isClosed ? '#4ade80' : '#333',
                                borderRadius: '4px',
                                minHeight: '40px',
                                justifyContent: 'center'
                            }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{target === 25 ? 'BULL' : target}</span>
                                <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                                    {[1, 2, 3].map(i => (
                                        <div key={i} style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: i <= marks ? '#fff' : '#666'
                                        }} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        return (
            <div className={`player-card ${isActive ? 'active-player' : ''}`} style={{
                border: isActive ? '2px solid yellow' : '1px solid #333',
                backgroundColor: '#1f2937',
                padding: '10px',
                borderRadius: '8px',
                position: 'relative',
                color: 'white'
            }}>
                <div style={{ position: 'absolute', top: '10px', left: '10px', width: '12px', height: '12px', backgroundColor: 'red', borderRadius: '50%', boxShadow: '0 0 5px red' }}></div>

                <h3 style={{ textAlign: 'center', marginBottom: '15px', fontSize: '1.2em' }}>
                    {player.name} {user && user.id === player.id ? '(Du)' : ''}
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isRightSide ? (
                        <>{CricketTargetsBlock}{PointsBlock}{LegsBlock}</>
                    ) : (
                        <>{LegsBlock}{PointsBlock}{CricketTargetsBlock}</>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="player-scores-container" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
            <div className="player-score-section" style={{ flex: 1 }}>
                {renderPlayerCricketCard(player1, "Player 1", false)}
            </div>

            <div className="player-history-section" style={{ flex: 1 }}>
                <div className="history-wrapper" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 style={{ color: 'white', fontSize: '2em' }}>CRICKET</h2>
                </div>
            </div>

            <div className="player-score-section" style={{ flex: 1 }}>
                {renderPlayerCricketCard(player2, "Player 2", true)}
            </div>
        </div>
    );
};

export default CricketBoard;
