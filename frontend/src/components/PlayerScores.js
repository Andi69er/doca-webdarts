import React from 'react';
import './PlayerScores.css';

const PlayerScores = ({ players, currentPlayerId }) => {
  // WICHTIGE ABSICHERUNG: Verhindert den Crash, wenn "players" noch nicht geladen ist.
  // Wenn 'players' kein gültiges Array ist, wird eine Lade-Nachricht angezeigt.
  if (!players || !Array.isArray(players)) {
    return <div>Lade Spielerinformationen...</div>;
  }

  return (
    <div className="player-scores">
      {players.map((player) => (
        <div key={player.id} className={`player-score ${player.id === currentPlayerId ? 'active-player' : ''}`}>
          <h3>{player.name}</h3>
          <p>Score: {player.score}</p>
        </div>
      ))}
    </div>
  );
};

export default PlayerScores;