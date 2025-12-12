import React from 'react';
import './styles/ThrowHistory.css';

const ThrowHistory = ({ gameState }) => {
  // Guard clause for missing data
  if (!gameState || !gameState.gameState || !Array.isArray(gameState.players)) {
    return (
      <div className="throw-history-container">
        <h4>Wurfhistorie</h4>
        <ul className="throw-history-list">
          <li>-</li>
        </ul>
      </div>
    );
  }

  const { players } = gameState;
  const { currentPlayerIndex, mode } = gameState.gameState;

  const currentPlayer = players[currentPlayerIndex];
  if (!currentPlayer) {
    return (
      <div className="throw-history-container">
        <h4>Wurfhistorie</h4>
        <ul className="throw-history-list">
          <li>-</li>
        </ul>
      </div>
    );
  }

  let playerHistory = [];

  if (mode === 'X01' || mode === 'x01') {
    // For X01, use turns array (scores per turn)
    const { turns } = gameState.gameState;
    playerHistory = turns ? (turns[currentPlayer.id] || []) : [];
  } else if (mode === 'BullOff' || mode === 'bull-off') {
    // For BullOff, use throwHistory array of objects
    const { throwHistory } = gameState.gameState;
    playerHistory = throwHistory ? (throwHistory[currentPlayer.id] || []).map(throwItem => throwItem.score) : [];
  } else {
    // Fallback: try to get from gameState directly
    const history = gameState.gameState.throwHistory || gameState.history || [];
    playerHistory = Array.isArray(history) ? history : [];
  }

  // Additional Guard Clause: Ensure the history array for the player exists.
  if (!playerHistory || playerHistory.length === 0) {
    return (
      <div className="throw-history-container">
        <h4>Wurfhistorie</h4>
        <ul className="throw-history-list">
          <li>-</li>
        </ul>
      </div>
    );
  }

  // Get the last throws for display (wie viele Darts für den Gewinn benötigt wurde)
  const recentThrows = playerHistory.slice(-10);

  return (
    <div className="throw-history-container">
      <h4>Wurfhistorie</h4>
      <ul className="throw-history-list">
        {recentThrows.map((score, index) => (
          <li key={index}>{score}</li>
        ))}
      </ul>
    </div>
  );
};

export default ThrowHistory;
