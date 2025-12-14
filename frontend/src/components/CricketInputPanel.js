import React from 'react';

const CricketInputPanel = ({ onScoreInput, isActive, isLocked, canUseUndo, onUndo, dartsThrownInTurn = 0 }) => {
    // This component no longer tracks the number of throws.
    // It sends each throw event immediately.

    const targets = [20, 19, 18, 17, 16, 15];
    const multipliers = [
        { label: 'Single', value: 1 }, 
        { label: 'D', value: 2 }, // Double
        { label: 'T', value: 3 }  // Triple
    ];

    const handleThrowClick = (target, multiplier) => {
        if (!isActive || isLocked) return;
        const throwData = { number: target, multiplier: multiplier };
        onScoreInput(throwData);
    };

    const handleSpecialClick = (target, multiplier = 1) => {
        if (!isActive || isLocked) return;
        const throwData = { number: target, multiplier: multiplier };
        onScoreInput(throwData);
    };

    const getButtonStyle = (isAvailable = true) => ({
        padding: '8px 12px',
        margin: '2px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: isAvailable ? (isActive && !isLocked ? '#4ade80' : '#555') : '#333',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: isAvailable && isActive && !isLocked ? 'pointer' : 'not-allowed',
        opacity: isAvailable && isActive && !isLocked ? 1 : 0.6,
        minWidth: '50px',
        transition: 'all 0.2s ease'
    });

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: '#1a1a1a',
            borderRadius: '10px',
            padding: '15px',
            color: 'white'
        }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1em', textAlign: 'center' }}>
                EINGABE
            </h3>

            {/* Turn status indicator */}
            <div style={{
                marginBottom: '15px',
                padding: '10px',
                backgroundColor: isActive && !isLocked ? '#4caf50' : '#333',
                borderRadius: '5px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                color: isActive && !isLocked ? 'black' : 'white'
            }}>
                {isActive && !isLocked ? `Du bist dran (${dartsThrownInTurn}/3)` : 'Warte...'}
            </div>

            {/* Grid for numbers 20-15 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {targets.map(target => (
                    <div key={target} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <span style={{ minWidth: '30px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#ccc', marginRight: '5px' }}>
                            {target}
                        </span>
                        
                        {multipliers.map(multiplier => (
                            <button
                                key={`${target}-${multiplier.value}`}
                                style={{ ...getButtonStyle(true), flex: 1, fontSize: '13px', padding: '6px 8px' }}
                                onClick={() => handleThrowClick(target, multiplier.value)}
                                disabled={!isActive || isLocked}
                            >
                                {multiplier.label}
                            </button>
                        ))}
                    </div>
                ))}

                {/* Special Buttons at the bottom */}
                <div style={{ marginTop: '10px', display: 'flex', gap: '4px' }}>
                    <button
                        style={{ ...getButtonStyle(true), flex: 1, fontSize: '13px', padding: '8px' }}
                        onClick={() => handleSpecialClick(25, 1)} // Single Bull
                        disabled={!isActive || isLocked}
                    >
                        BULL
                    </button>
                    <button
                        style={{ ...getButtonStyle(true), flex: 1, fontSize: '13px', padding: '8px' }}
                        onClick={() => handleSpecialClick(25, 2)} // Double Bull
                        disabled={!isActive || isLocked}
                    >
                        BULLSEYE
                    </button>
                    <button
                        style={{ ...getButtonStyle(true), flex: 1, fontSize: '13px', padding: '8px', backgroundColor: '#ef4444' }}
                        onClick={() => handleSpecialClick(0, 1)} // Miss
                        disabled={!isActive || isLocked}
                    >
                        MISS
                    </button>
                </div>
            </div>

            {/* Undo Button */}
            <button
                onClick={onUndo}
                disabled={!canUseUndo}
                style={{
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: canUseUndo ? '#ff6b6b' : '#555',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: canUseUndo ? 'pointer' : 'not-allowed',
                    opacity: canUseUndo ? 1 : 0.6
                }}
            >
                UNDO LETZTEN WURF
            </button>
        </div>
    );
};

export default CricketInputPanel;