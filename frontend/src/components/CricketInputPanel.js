import React, { useState } from 'react';

const CricketInputPanel = ({ onScoreInput, isActive, isLocked, canUseUndo, onUndo }) => {
    const [currentThrows, setCurrentThrows] = useState([]);

    const targets = [20, 19, 18, 17, 16, 15];
    const multipliers = [
        { label: 'Single', value: 1 }, 
        { label: 'D', value: 2 }, // Double
        { label: 'T', value: 3 }  // Triple
    ];

    const handleThrowClick = (target, multiplier) => {
        if (!isActive || isLocked) return;

        const throwData = { target, multiplier };
        const newThrows = [...currentThrows, throwData];

        submitOrUpdate(newThrows);
    };

    const handleSpecialClick = (score) => {
        if (!isActive || isLocked) return;

        // Logik für Spezialwürfe:
        // Bull (25) ist Target 25, Multiplikator 1
        // Bullseye (50) ist eigentlich Target 25, Multiplikator 2 (Double Bull)
        // Miss (0) ist Target 0, Multiplikator 1
        
        let throwData;
        if (score === 50) {
            throwData = { target: 25, multiplier: 2 }; // Bullseye als Double Bull speichern
        } else {
            throwData = { target: score, multiplier: 1 };
        }

        const newThrows = [...currentThrows, throwData];
        submitOrUpdate(newThrows);
    };

    // Hilfsfunktion zum Prüfen, ob 3 Würfe voll sind
    const submitOrUpdate = (newThrows) => {
        if (newThrows.length >= 3) {
            // WICHTIG: Wir senden jetzt das Array der Würfe, nicht die Summe!
            // Das Backend muss wissen, WELCHE Segmente getroffen wurden.
            onScoreInput(newThrows); 
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
                EINGABE
            </h3>

            {/* Anzeige der aktuellen Würfe (1 von 3 etc.) */}
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
                        {currentThrows.map((throw_, index) => {
                            // Schöne Anzeige für den User generieren
                            let displayText = throw_.target;
                            if (throw_.target === 25) {
                                displayText = throw_.multiplier === 2 ? 'BULLSEYE' : 'BULL';
                            } else if (throw_.target === 0) {
                                displayText = 'MISS';
                            } else {
                                displayText = (throw_.multiplier === 3 ? 'T' : throw_.multiplier === 2 ? 'D' : '') + throw_.target;
                            }
                            
                            return (
                                <span key={index}>
                                    {displayText}
                                    {index < currentThrows.length - 1 ? ', ' : ''}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Grid für die Zahlen 20-15 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {targets.map(target => (
                    <div key={target} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        {/* Label für die Zahl (z.B. "20") */}
                        <span style={{
                            minWidth: '30px',
                            textAlign: 'right',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: '#ccc',
                            marginRight: '5px'
                        }}>
                            {target}
                        </span>
                        
                        {/* Buttons: Single, Double, Triple */}
                        {multipliers.map(multiplier => {
                            return (
                                <button
                                    key={`${target}-${multiplier.value}`}
                                    style={{
                                        ...getButtonStyle(true),
                                        flex: 1,
                                        fontSize: '13px',
                                        padding: '6px 8px'
                                    }}
                                    onClick={() => handleThrowClick(target, multiplier.value)}
                                    disabled={!isActive || isLocked}
                                >
                                    {multiplier.label}
                                </button>
                            );
                        })}
                    </div>
                ))}

                {/* Spezial Buttons unten (Bull, Bullseye, Miss) */}
                <div style={{
                    marginTop: '10px',
                    display: 'flex',
                    gap: '4px'
                }}>
                    <button
                        style={{
                            ...getButtonStyle(true),
                            flex: 1,
                            fontSize: '13px',
                            padding: '8px'
                        }}
                        onClick={() => handleSpecialClick(25)}
                        disabled={!isActive || isLocked}
                    >
                        BULL
                    </button>
                    <button
                        style={{
                            ...getButtonStyle(true),
                            flex: 1,
                            fontSize: '13px',
                            padding: '8px'
                        }}
                        onClick={() => handleSpecialClick(50)}
                        disabled={!isActive || isLocked}
                    >
                        BULLSEYE
                    </button>
                    <button
                        style={{
                            ...getButtonStyle(true),
                            flex: 1,
                            fontSize: '13px',
                            padding: '8px',
                            backgroundColor: '#ef4444' // Rötlich für Miss
                        }}
                        onClick={() => handleSpecialClick(0)}
                        disabled={!isActive || isLocked}
                    >
                        MISS
                    </button>
                </div>
            </div>

            {/* Undo Button */}
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
                {currentThrows.length > 0 ? 'WURF LÖSCHEN' : 'UNDO'}
            </button>
        </div>
    );
};

export default CricketInputPanel;