import React from 'react';
import './styles/ThrowHistory.css';

const ThrowHistory = ({ gameState: room }) => {
  // Guard clause for missing data
  if (!room || !room.gameState || !Array.isArray(room.players)) {
    return null; 
  }

  const { players } = room;
  const { currentPlayerIndex, turns } = room.gameState;
  
  const currentPlayer = players[currentPlayerIndex];
  if (!currentPlayer) {
      return null;
  }
  
  const playerTurns = turns ? turns[currentPlayer.id] : [];

  // Additional Guard Clause: Ensure the 'turns' array for the player exists.
  if (!playerTurns || playerTurns.length === 0) {
    return (
        <div className="throw-history-container">
            <h3>Last 3 Throws</h3>
            <ul className="throw-history-list">
                <li>-</li>
            </ul>
        </div>
    );
  }

  // Get the last 3 throws for display
  const recentThrows = playerTurns.slice(-3);

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