import React from 'react';
import './PlayerScores.css';

const PlayerScores = ({ gameState: room }) => { // Rename for clarity
  // Guard clause to prevent crashes if the room or its nested properties are not yet loaded.
  if (!room || !Array.isArray(room.players)) {
    return <div>Lade Spielerinformationen...</div>;
  }

  const { players } = room;
  const gameStarted = room.gameState && room.gameState.scores && room.gameState.currentPlayerIndex !== undefined;

  if (!gameStarted) {
    // Show players before game starts
    return (
      <div className="player-scores">
        <h3>Spieler in diesem Raum:</h3>
        {players.map((player) => (
          <div key={player.id} className="player-score waiting">
            <h4>{player.name}</h4>
            <p>Bereit zum Spielen</p>
            <p>Starting Score: {room.gameOptions?.startingScore || 501}</p>
          </div>
        ))}
      </div>
    );
  }

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
