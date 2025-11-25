import React from 'react';
import './styles/ThrowHistory.css';

const ThrowHistory = ({ gameState }) => {
  // GUARD CLAUSE: Do not render if gameState or the specific player data is not yet defined.
  if (!gameState || !gameState.players || !gameState.players[gameState.currentPlayerIndex]) {
    return null; // Render nothing until the data is ready
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // Additional Guard Clause: Ensure the 'throws' array exists before trying to slice it.
  if (!currentPlayer.throws) {
    return null;
  }

  // Get the last 3 throws for display
  const recentThrows = currentPlayer.throws.slice(-3);

  return (
    <div className="throw-history-container">
      <h3>Last 3 Throws</h3>
      <ul className="throw-history-list">
        {recentThrows.map((score, index) => (
          <li key={index}>{score}</li>
        ))}
      </ul>
    </div>
  );
};

export default ThrowHistory;