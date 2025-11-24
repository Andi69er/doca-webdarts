import React from 'react';

function PlayerScores({ players, scores }) {
  return (
    <div className="player-scores">
      <h3>Player Scores</h3>
      {players.map((player, index) => (
        <div key={player.id} className={`player-score ${index === 0 ? 'active' : ''}`}>
          <div className="player-name">{player.name}</div>
          <div className="player-stats">
            <div className="score">{scores[index] || 0}</div>
            <div className="averages">
              <span>Live AVG: {player.liveAvg || 0}</span>
              <span>Live: {player.live || 0}</span>
            </div>
            {scores[index] <= 170 && scores[index] > 0 && (
              <div className="checkout">Checkout: {calculateCheckout(scores[index])}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function calculateCheckout(score) {
  // Simple checkout suggestions - can be expanded with full checkout table
  const checkouts = {
    170: 'T20 T20 Bull',
    167: 'T20 T19 D12',
    164: 'T20 T18 Bull',
    // Add more checkouts...
  };
  return checkouts[score] || 'TBD';
}

export default PlayerScores;