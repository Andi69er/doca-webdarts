import React from 'react';
import './DartHistory.css';

const DartHistory = ({ gameState: room }) => {
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

  // Get all turns for the current player
  const playerTurns = turns ? turns[currentPlayer.id] || [] : [];

  // Group into sets of 3 (darts per turn)
  const turnsGrouped = [];
  for (let i = 0; i < playerTurns.length; i += 3) {
    turnsGrouped.push(playerTurns.slice(i, i + 3));
  }

  return (
    <div className="dart-history-container">
      <h4 className="player-name">{currentPlayer.name}</h4>
      <div className="history-list">
        {turnsGrouped.length === 0 ? (
          <div className="no-turns">Keine Würfe bisher</div>
        ) : (
          turnsGrouped.map((turn, index) => (
            <div key={index} className="turn-row">
              <span className="turn-label">Aufnahme {index + 1}:</span>
              <span className="turn-scores">{turn.join(' + ') || '-'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DartHistory;
