import React, { useState, useEffect } from 'react';
import './LegWinnerPopup.css';

function LegWinnerPopup({ legWinner, nextPlayerName, isGameEnded, onContinue }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && onContinue) {
      onContinue();
    }
  }, [countdown, onContinue]);

  const winnerName = legWinner?.name || legWinner || 'Spieler';

  if (isGameEnded) {
    return null;
  }

  return (
    <div className="leg-winner-popup">
      <div className="leg-winner-content">
        <h2 className="leg-winner-text">🎯 {winnerName} gewinnt das Leg! 🎯</h2>
        <div className="countdown-container">
          <p className="countdown-text">
            Spiel geht in {countdown} Sekunden weiter...
          </p>
          <p className="next-player-text">
            Anwurf hat: <strong>{nextPlayerName}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LegWinnerPopup;
