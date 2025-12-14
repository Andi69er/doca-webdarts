import React, { useState } from 'react';

const CricketInputPanel = ({ onScoreInput, isActive, isLocked, canUseUndo, onUndo }) => {
    const [currentThrows, setCurrentThrows] = useState([]);

    const targets = [20, 19, 18, 17, 16, 15];
    const multipliers = [
        { label: '', value: 1 }, // Single
        { label: 'D', value: 2 }, // Double
        { label: 'T', value: 3 }  // Triple
    ];

    const handleThrowClick = (target, multiplier) => {
        if (!isActive || isLocked) return;

        const throwData = { target, multiplier };
        const newThrows = [...currentThrows, throwData];

        // If we have 3 throws, submit them all
        if (newThrows.length >= 3) {
            // Calculate total score for cricket input
            const totalScore = newThrows.reduce((sum, throw_) => {
                return sum + (throw_.target * throw_.multiplier);
            }, 0);

            onScoreInput(totalScore.toString());
            setCurrentThrows([]);
        } else {
            setCurrentThrows(newThrows);
        }
    };

    const handleSpecialClick = (score) => {
        if (!isActive || isLocked) return;

        const newThrows = [...currentThrows, { target: score, multiplier: 1 }];

        if (newThrows.length >= 3) {
            const totalScore = newThrows.reduce((sum, throw_) => {
                return sum + (throw_.target * throw_.multiplier);
            }, 0);

            onScoreInput(totalScore.toString());
            setCurrentThrows([]);
        } else {
            setCurrentThrows(newThrows);
        }
    };

    const handleUndo = () => {
        if (currentThrows.length > 0) {
            setCurrentThrows(currentThrows.slice(0, -1));
        } else if (canUseUndo) {
            onUndo();
        }
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
                DEINE WÜRFE
            </h3>

            {/* Current throws indicator */}
            <div style={{
                marginBottom: '15px',
                padding: '10px',
                backgroundColor: '#333',
                borderRadius: '5px',
                textAlign: 'center',
                fontSize: '14px'
            }}>
                Wurf {currentThrows.length + 1} von 3
                {currentThrows.length > 0 && (
                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#ccc' }}>
                        {currentThrows.map((throw_, index) => (
                            <span key={index}>
                                {throw_.multiplier > 1 ? `${['D','T'][throw_.multiplier-2]}${throw_.target}` : throw_.target}
                                {index < currentThrows.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Target buttons grid */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {targets.map(target => (
                    <div key={target} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '4px'
                    }}>
                        {multipliers.map(multiplier => {
                            const isAvailable = multiplier.value === 1 || (target !== 25 && target !== 50);
                            const buttonText = multiplier.label ? `${multiplier.label}${target}` : `${target}`;

                            return (
                                <button
                                    key={`${target}-${multiplier.value}`}
                                    style={getButtonStyle(isAvailable)}
                                    onClick={() => handleThrowClick(target, multiplier.value)}
                                    disabled={!isAvailable || !isActive || isLocked}
                                >
                                    {buttonText}
                                </button>
                            );
                        })}
                    </div>
                ))}

                {/* Special buttons */}
                <div style={{
                    marginTop: '15px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '4px'
                }}>
                    <button
                        style={getButtonStyle(true)}
                        onClick={() => handleSpecialClick(25)}
                        disabled={!isActive || isLocked}
                    >
                        BULL
                    </button>
                    <button
                        style={getButtonStyle(true)}
                        onClick={() => handleSpecialClick(50)}
                        disabled={!isActive || isLocked}
                    >
                        BULLSEYE
                    </button>
                    <button
                        style={getButtonStyle(true)}
                        onClick={() => handleSpecialClick(0)}
                        disabled={!isActive || isLocked}
                    >
                        MISS
                    </button>
                </div>
            </div>

            {/* Undo button */}
            <button
                onClick={handleUndo}
                disabled={!canUseUndo && currentThrows.length === 0}
                style={{
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: (canUseUndo || currentThrows.length > 0) ? '#ff6b6b' : '#555',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: (canUseUndo || currentThrows.length > 0) ? 'pointer' : 'not-allowed',
                    opacity: (canUseUndo || currentThrows.length > 0) ? 1 : 0.6
                }}
            >
                {currentThrows.length > 0 ? 'WURF RÜCKGÄNGIG' : 'UNDO'}
            </button>
        </div>
    );
};

export default CricketInputPanel;