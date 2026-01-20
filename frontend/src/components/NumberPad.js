import React, { useState, useEffect, useCallback } from 'react';

const NumberPad = ({ onScoreInput, onUndo, isActive, isLocked, checkoutSuggestions, isOpponentLocked, isRemoteLocked, isMyTurn, canUseUndo, gameRunning }) => {
    const [currentInput, setCurrentInput] = useState('');

    // Styles - FIXIERTE GRÖSSEN um Springen zu verhindern
    const styles = {
        wrapper: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '200px', margin: '0 auto', height: '100%', overflow: 'hidden', padding: '5px'
        },
        // Feste Höhe für Status, Text wird abgeschnitten falls zu lang, kein Layout-Shift
        status: { 
            fontSize: '0.8rem', 
            color: isActive ? '#4CAF50' : '#888', 
            marginBottom: '5px', 
            textAlign: 'center', 
            height: '20px', 
            lineHeight: '20px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%'
        },
        // Feste Höhe für Preview
        preview: {
            width: '100%', height: '50px', background: 'white', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem',
            fontWeight: 'bold', color: '#000', marginBottom: '10px', opacity: isLocked ? 0.6 : 1
        },
        // Grid Fixierung
        grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', width: '100%', marginBottom: '5px' },
        btn: {
            height: '45px', fontSize: '1.4rem', fontWeight: 'bold', border: 'none', borderRadius: '6px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            padding: 0, margin: 0 // Reset padding/margin
        },
        btnNum: { backgroundColor: '#2a2a3e' },
        btnClear: { backgroundColor: '#d9534f' },
        btnEnter: { backgroundColor: '#4CAF50' },
        // Checkout Suggestions Container mit fester Höhe
        suggestions: {
            color:'#ffd700', marginBottom:'5px', fontSize:'0.75rem', height:'16px', lineHeight:'16px', overflow:'hidden', width:'100%', textAlign:'center'
        },
        btnUndo: { backgroundColor: '#d9534f', width: '100%', height: '35px', fontSize: '1rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', color: 'white', marginTop: '5px' }
    };


    const handleNumPress = useCallback((num) => {
        if (isOpponentLocked) return;
        if (!isActive || isLocked) return;
        if (currentInput.length >= 3) return;
        setCurrentInput(prev => prev + num);
    }, [isActive, isLocked, isOpponentLocked, currentInput]);

    const handleEnter = useCallback(() => {
        if (isOpponentLocked) return;
        if (!isActive || isLocked) return;
        if (currentInput === '') return;
        const score = parseInt(currentInput, 10);
        if (isNaN(score) || score > 180) {
            setCurrentInput('');
            return;
        }
        onScoreInput(score);
        setCurrentInput('');
    }, [currentInput, isActive, isLocked, isOpponentLocked, onScoreInput]);


    // KEYBOARD LISTENER
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key.toLowerCase() === 'u' && canUseUndo) {
                if(onUndo) onUndo();
                return;
            }

            if (isOpponentLocked) return;
            if (!gameRunning) return;
            if (!isActive) return;
            if (isLocked) return;

            if (e.key >= '0' && e.key <= '9') {
                handleNumPress(e.key);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleEnter();
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                setCurrentInput(prev => prev.slice(0, -1));
            } else if (e.key.toLowerCase() === 'c') {
                setCurrentInput('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNumPress, handleEnter, isActive, isLocked, canUseUndo, isOpponentLocked, onUndo, gameRunning]);

    return (
        <div style={styles.wrapper}>
            <div style={styles.status}>
                {!gameRunning ? "Warte auf Start" :
                 canUseUndo ? "Undo möglich (U)" :
                 isRemoteLocked ? "Gesperrt..." :
                 isLocked ? (isActive ? "Gesperrt..." : "Warte...") :
                 (!isActive ? "Gegner ist dran" : "Du bist dran!")}
            </div>

            <div style={styles.preview}>
                {currentInput || "0"}
            </div>

            {/* Feste Höhe für Suggestions, damit nichts springt wenn sie erscheinen/verschwinden */}
            <div style={styles.suggestions}>
                {checkoutSuggestions && checkoutSuggestions.length > 0 && isActive ? 
                    checkoutSuggestions.map(s => `${s.score}: ${s.checkout}`).join(' | ') : 
                    '\u00A0' // Non-breaking space um Höhe zu halten
                }
            </div>

            <div style={styles.grid}>
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => {
                    const isDisabled = !gameRunning || !isActive || isLocked || canUseUndo || isOpponentLocked;
                    return (
                        <button key={num} style={{...styles.btn, ...styles.btnNum, opacity: isDisabled ? 0.5 : 1}} onClick={() => handleNumPress(num.toString())} disabled={isDisabled}>{num}</button>
                    );
                })}
                <button style={{...styles.btn, ...styles.btnClear, opacity: (!gameRunning || !isActive || isLocked || canUseUndo || isOpponentLocked) ? 0.5 : 1}} onClick={() => setCurrentInput('')} disabled={!gameRunning || !isActive || isLocked || canUseUndo || isOpponentLocked}>C</button>
                <button style={{...styles.btn, ...styles.btnNum, opacity: (!gameRunning || !isActive || isLocked || canUseUndo || isOpponentLocked) ? 0.5 : 1}} onClick={() => handleNumPress('0')} disabled={!gameRunning || !isActive || isLocked || canUseUndo || isOpponentLocked}>0</button>
                <button style={{...styles.btn, ...styles.btnEnter, opacity: (!gameRunning || !isActive || isLocked || currentInput==='' || canUseUndo || isOpponentLocked) ? 0.5 : 1}} onClick={handleEnter} disabled={!gameRunning || !isActive || isLocked || currentInput==='' || canUseUndo || isOpponentLocked}>⏎</button>
            </div>
            <button style={{...styles.btnUndo, opacity: (!canUseUndo) ? 0.5 : 1}} onClick={onUndo} disabled={!canUseUndo}>⟲ Undo (U)</button>
        </div>
    );
};

export default NumberPad;