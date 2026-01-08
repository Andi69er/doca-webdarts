import React, { useCallback } from 'react';
import './GameEndPopup.css';

function GameEndPopup({ winner, onRematch, onExit }) {
  const handleRematch = useCallback(() => {
    if (onRematch) onRematch();
  }, [onRematch]);

  const handleExit = useCallback(() => {
    if (onExit) onExit();
  }, [onExit]);

  const winnerName = winner ? winner.name || winner : 'Spieler';

  return (
    <div className="game-end-popup">
      <div className="fireworks-container">
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
        <div className="firework"></div>
      </div>
      <div className="popup-content">
        <h2 className="winner-announcement">
          🏆 {winnerName} gewinnt! 🏆
        </h2>
        <div className="buttons-container">
          <button className="revenge-button" onClick={handleRematch}>
            🔄 Revanche
          </button>
          <button className="exit-button" onClick={handleExit}>
            🏠 Zur Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameEndPopup;
