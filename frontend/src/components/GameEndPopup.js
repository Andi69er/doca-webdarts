import React, { useState, useEffect, useCallback } from 'react';
import './GameEndPopup.css';

function GameEndPopup({ winner, countdown, onRematch }) {
  const [countdownTime, setCountdownTime] = useState(countdown || 10);

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
  }, [countdownTime]);

  const handleRematch = useCallback(() => {
    onRematch();
  }, [onRematch]);

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