import React, { useState, useEffect, useCallback } from 'react';
import './GameEndPopup.css';

function GameEndPopup({ winner, countdown, onRematch, checkout }) {
  const [countdownTime, setCountdownTime] = useState(countdown || 10);

  const handleRematch = useCallback(() => {
    onRematch();
  }, [onRematch]);

  useEffect(() => {
    if (countdownTime > 0) {
      const timer = setTimeout(() => {
        setCountdownTime(countdownTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Auto rematch or close after countdown
      handleRematch();
    }
  }, [countdownTime, handleRematch]);

  const winnerName = winner ? winner.name || winner : 'Unknown';

  return (
    <div className="game-end-popup">
      <div className="fireworks-container">
        {/* Fireworks animation particles */}
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
      </div>
      <div className="popup-content">
        <h2 className="winner-announcement">
          🏆 Winner: {winnerName} 🏆
        </h2>
        {checkout && (
          <div className="checkout-info">
            <h4 style={{ margin: '0 0 5px 0', color: '#ffd700' }}>Finish-Weg für den Gegner:</h4>
            <p style={{ margin: 0, fontSize: '1.2em', fontFamily: 'monospace' }}>{checkout}</p>
          </div>
        )}
        <div className="countdown">
          Rematch in {countdownTime} seconds...
        </div>
        <button className="revenge-button" onClick={handleRematch}>
          Revenge! (Switch Players)
        </button>
      </div>
    </div>
  );
}

export default GameEndPopup;