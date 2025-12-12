import React, { useState, useEffect, useCallback } from 'react';

const NumberPad = ({ onScoreInput, onUndo, isActive, isLocked, checkoutSuggestions, isOpponentLocked, isMyTurn, canUseUndo }) => {
    const [currentInput, setCurrentInput] = useState('');

    // Styles (wie gehabt Mittelgroß)
    const styles = {
        wrapper: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '100%', maxWidth: '280px', margin: '0 auto', height: '100%', overflow: 'hidden', padding: '10px'
        },
        status: { fontSize: '0.9rem', color: isActive ? '#4CAF50' : '#888', marginBottom: '10px', textAlign: 'center', minHeight: '20px', fontWeight: 'bold' },
        preview: {
            width: '100%', height: '70px', background: 'white', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem',
            fontWeight: 'bold', color: '#000', marginBottom: '15px', opacity: isLocked ? 0.6 : 1
        },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', width: '100%', marginBottom: '10px' },
        btn: {
            height: '55px', fontSize: '1.4rem', fontWeight: 'bold', border: 'none', borderRadius: '6px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
        },
        btnNum: { backgroundColor: '#2a2a3e' },
        btnClear: { backgroundColor: '#d9534f' },
        btnEnter: { backgroundColor: '#4CAF50' },
        btnUndo: { backgroundColor: '#d9534f', width: '100%', height: '45px', fontSize: '1rem', fontWeight: 'bold', borderRadius: '6px', border: 'none', color: 'white', marginTop: '5px' }
    };


    const handleNumPress = useCallback((num) => {
        // Wenn ich Undo nutzen kann (Score eingegeben), keine weiteren Eingaben
        if (canUseUndo) return;
        // Wenn Gegner gesperrt ist, keine Eingaben
        if (isOpponentLocked) return;
        // Standard-Checks
        if (!isActive || isLocked) return;
        if (currentInput.length >= 3) return;
        setCurrentInput(prev => prev + num);
    }, [isActive, isLocked, isOpponentLocked, canUseUndo, currentInput]);

    const handleEnter = useCallback(() => {
        // Wenn ich Undo nutzen kann (Score eingegeben), keine weitere Eingabe
        if (canUseUndo) return;
        // Wenn Gegner gesperrt ist, keine Eingabe
        if (isOpponentLocked) return;
        // Standard-Checks
        if (!isActive || isLocked) return;
        if (currentInput === '') return;
        const score = parseInt(currentInput, 10);
        if (isNaN(score) || score > 180) {
            setCurrentInput('');
            return;
        }
        onScoreInput(score);
        setCurrentInput('');
    }, [currentInput, isActive, isLocked, isOpponentLocked, canUseUndo, onScoreInput]);


    // KEYBOARD LISTENER
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Undo ist immer erlaubt wenn canUseUndo true ist
            if (e.key.toLowerCase() === 'u' && canUseUndo) {
                if(onUndo) onUndo();
                return;
            }

            // Wenn ich Undo nutzen kann, keine anderen Eingaben
            if (canUseUndo) return;

            // Wenn Gegner gesperrt ist, keine Eingaben
            if (isOpponentLocked) return;

            // Standard-Checks
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
    }, [handleNumPress, handleEnter, isActive, isLocked, canUseUndo, isOpponentLocked, onUndo]);

    return (
        <div style={styles.wrapper}>
            <div style={styles.status}>
                {canUseUndo ? "Score eingegeben - Undo möglich (U)" :
                 isOpponentLocked ? "Warte 5 Sekunden..." :
                 (!isActive ? "Gegner ist dran..." :
                 (isLocked ? "Wurf gesendet..." : "Du bist dran!"))}
            </div>

            <div style={styles.preview}>
                {currentInput || "0"}
            </div>

            {checkoutSuggestions && checkoutSuggestions.length > 0 && isActive && (
                <div style={{color:'#ffd700', marginBottom:'5px'}}>{checkoutSuggestions.map(s => `${s.score}: ${s.checkout}`).join(' | ')}</div>
            )}

            <div style={styles.grid}>
                {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => {
                    const isDisabled = !isActive || isLocked || canUseUndo || isOpponentLocked;
                    return (
                        <button key={num} style={{...styles.btn, ...styles.btnNum, opacity: isDisabled ? 0.5 : 1}} onClick={() => handleNumPress(num.toString())} disabled={isDisabled}>{num}</button>
                    );
                })}
                <button style={{...styles.btn, ...styles.btnClear, opacity: (!isActive || isLocked || canUseUndo || isOpponentLocked) ? 0.5 : 1}} onClick={() => setCurrentInput('')} disabled={!isActive || isLocked || canUseUndo || isOpponentLocked}>C</button>
                <button style={{...styles.btn, ...styles.btnNum, opacity: (!isActive || isLocked || canUseUndo || isOpponentLocked) ? 0.5 : 1}} onClick={() => handleNumPress('0')} disabled={!isActive || isLocked || canUseUndo || isOpponentLocked}>0</button>
                <button style={{...styles.btn, ...styles.btnEnter, opacity: (!isActive || isLocked || currentInput==='' || canUseUndo || isOpponentLocked) ? 0.5 : 1}} onClick={handleEnter} disabled={!isActive || isLocked || currentInput==='' || canUseUndo || isOpponentLocked}>⏎</button>
            </div>
            <button style={{...styles.btnUndo, opacity: (!canUseUndo) ? 0.5 : 1}} onClick={onUndo} disabled={!canUseUndo}>⟲ Undo (U)</button>
        </div>
    );
};

export default NumberPad;