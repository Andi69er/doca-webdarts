import React, { useState } from 'react';

// Basic styling for the NumberPad, can be moved to a CSS file
const styles = {
  numberPad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    padding: '20px',
    maxWidth: '300px',
    margin: '20px auto',
  },
  button: {
    padding: '20px',
    fontSize: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #ccc',
    cursor: 'pointer',
  },
  display: {
    gridColumn: '1 / -1',
    backgroundColor: '#eee',
    padding: '10px',
    fontSize: '2rem',
    textAlign: 'right',
    marginBottom: '10px',
    minHeight: '50px',
  },
  enterButton: {
    gridColumn: '1 / -1',
    backgroundColor: '#28a745',
    color: 'white',
  },
  disabled: {
      backgroundColor: '#6c757d',
      cursor: 'not-allowed',
  }
};

function NumberPad({ onScoreInput, isActive, gameState: room }) {
  const [input, setInput] = useState('');

  const handleNumberClick = (number) => {
    if (!isActive) return;
    setInput(prev => prev + number);
  };

  const handleClear = () => {
    if (!isActive) return;
    setInput('');
  };

  const handleEnter = () => {
    if (!isActive || !input) return;
    const score = parseInt(input, 10);
    if (!isNaN(score)) {
      onScoreInput(score);
    }
    setInput('');
  };
  
  const waitingTimer = room?.gameState?.waitingTimer;


  return (
    <div style={styles.numberPad}>
      <div style={styles.display}>{input || '0'}</div>
      
      {isActive && waitingTimer > 0 && (
         <div style={{...styles.display, fontSize: '1rem', textAlign: 'center'}}>
           Zeit verbleibend: {waitingTimer}s
         </div>
      )}

      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
        <button key={number} style={isActive ? styles.button : {...styles.button, ...styles.disabled}} onClick={() => handleNumberClick(number.toString())} disabled={!isActive}>
          {number}
        </button>
      ))}
      <button style={isActive ? styles.button : {...styles.button, ...styles.disabled}} onClick={handleClear} disabled={!isActive}>C</button>
      <button style={isActive ? styles.button : {...styles.button, ...styles.disabled}} onClick={() => handleNumberClick('0')} disabled={!isActive}>0</button>
      <button style={isActive ? {...styles.button, ...styles.enterButton} : {...styles.button, ...styles.enterButton, ...styles.disabled}} onClick={handleEnter} disabled={!isActive}>
        Enter
      </button>
    </div>
  );
}

export default NumberPad;
