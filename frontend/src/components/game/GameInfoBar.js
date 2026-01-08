import React from 'react';

const GameInfoBar = ({ gameState }) => {
    if (!gameState) return null;

    const { gameOptions, mode } = gameState;
    if (!gameOptions) return null;

    let infoText = '';
    if (mode === 'x01') {
        const score = gameOptions.startingScore || 501;
        const im = gameOptions.inMode === 'double' ? 'Double In' : 'Single In';
        const om = gameOptions.outMode === 'double' ? 'Double Out' :
                      gameOptions.outMode === 'master' ? 'Master Out' : 'Single Out';
        const s = gameOptions.sets || 0;
        const l = gameOptions.legs || 1;
        const wt = gameOptions.winType === 'bestOf' ? 'Best Of' : 'First To';
        infoText = `${score} • ${im}/${om} • ${wt} • Sets: ${s}, Legs: ${l}`;
    } else if (mode === 'cricket') {
        const s = gameOptions.sets || 0;
        const l = gameOptions.legs || 1;
        const wt = gameOptions.winType === 'bestOf' ? 'Best Of' : 'First To';
        infoText = `Cricket • ${wt} • Sets: ${s}, Legs: ${l}`;
    }

    return (
        <div style={{
            backgroundColor: '#222',
            color: '#fff',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '14px',
            borderBottom: '1px solid #444'
        }}>
            <strong>Spiel-Einstellungen:</strong> {infoText}
        </div>
    );
};

export default GameInfoBar;
