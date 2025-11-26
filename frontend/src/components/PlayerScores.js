import React from 'react';
import './PlayerScores.css';

const PlayerScores = ({ gameState: room }) => { // Rename for clarity
  // Guard clause to prevent crashes if the room or its nested properties are not yet loaded.
  if (!room || !Array.isArray(room.players) || !room.gameState || !room.gameState.scores) {
    return <div>Lade Spielerinformationen...</div>;
  }

  const { players } = room;
  const { scores, currentPlayerIndex } = room.gameState;
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
