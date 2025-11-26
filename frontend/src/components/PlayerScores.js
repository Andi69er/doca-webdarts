import React from 'react';
import './PlayerScores.css';

const PlayerScores = ({ gameState }) => {
  // WICHTIGE ABSICHERUNG: Verhindert den Crash, wenn "gameState" oder "players" noch nicht geladen ist.
  if (!gameState || !Array.isArray(gameState.players)) {
    return <div>Lade Spielerinformationen...</div>;
  }
  const { players, currentPlayerIndex } = gameState;
  const currentPlayerId = players[currentPlayerIndex]?.id;
};

export default PlayerScores;