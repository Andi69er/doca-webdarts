import React from 'react';
import './PlayerScores.css';

const PlayerScores = ({ gameState }) => {
  // Guard clause to prevent crashes if gameState or its properties are not yet loaded.
  if (!gameState || !Array.isArray(gameState.players) || !gameState.scores) {
    return <div>Lade Spielerinformationen...</div>;
  }

  const { players, currentPlayerIndex, scores } = gameState;
  const currentPlayerId = players[currentPlayerIndex]?.id;

  return (
    <div className="player-scores">
      {players.map((player) => (
        <div key={player.id} className={`player-score ${player.id === currentPlayerId ? 'active-player' : ''}`}>
          <h3>{player.name}</h3>
          <p>Score: {scores[player.id]}</p>
        </div>
      ))}
    </div>
  );
};

export default PlayerScores;
