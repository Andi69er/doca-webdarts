import React from 'react';
import './PlayerScores.css';

const PlayerScores = ({ gameState: room }) => {
  if (!room || !Array.isArray(room.players)) {
    return <div>Loading player information...</div>;
  }

  const { players } = room;
  const gameStarted = room.gameState && room.gameState.scores && room.gameState.currentPlayerIndex !== undefined;

  if (!gameStarted) {
    return (
      <div className="player-scores">
        {players.map((player) => (
          <div key={player.id} className="player-score waiting">
            <h4>{player.name}</h4>
            <p>READY TO PLAY</p>
          </div>
        ))}
      </div>
    );
  }

  const { scores, currentPlayerIndex, sets, legs } = room.gameState;
  const currentPlayerId = players[currentPlayerIndex]?.id;

  return (
    <div className="player-scores">
      <div className="scoreboard-cards">
        {players.slice(0, 2).map((player, index) => ( // Assuming 2 players
          <div key={player.id} className={`player-card ${player.id === currentPlayerId ? 'active' : ''}`}>
            <div className="player-name">{player.name.toUpperCase()}</div>
            <div className="player-score-display">
              {scores[player.id]}
            </div>
            <div className="player-stats-details">
              <div className="stats-row">
                <span>SETS: {sets ? sets[player.id] || 0 : 0}</span>
                <span>LEGS: {legs ? legs[player.id] || 0 : 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerScores;
