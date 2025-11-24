import React from 'react';

function LiveStatistics({ statistics, gameState }) {
  // Assuming statistics is an object with player IDs as keys
  const players = gameState.players || [];
  const currentStats = statistics || {};

  const calculateFirstNineAvg = (firstNineDarts) => {
    if (firstNineDarts.length === 0) return 0;
    const sum = firstNineDarts.reduce((a, b) => a + b, 0);
    return (sum / firstNineDarts.length).toFixed(2);
  };

  const getShortLeg = (legsPlayed) => {
    if (legsPlayed.length === 0) return 'N/A';
    return Math.min(...legsPlayed);
  };

  const getScoreDistribution = (dist) => {
    return `19-: ${dist['19-']}, 20-39: ${dist['20-39']}, 40-59: ${dist['40-59']}, 60-79: ${dist['60-79']}, 80-99: ${dist['80-99']}, 100-119: ${dist['100-119']}, 120-139: ${dist['120-139']}, 140-159: ${dist['140-159']}, 160-180: ${dist['160-180']}, 180+: ${dist['180+']}`;
  };

  return (
    <div className="live-statistics">
      <h4>Live Statistics</h4>
      {players.map(player => {
        const stats = currentStats[player.id] || {};
        return (
          <div key={player.id} className="player-stats">
            <h5>{player.name}</h5>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Sets:</span>
                <span className="stat-value">{stats.sets || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Legs:</span>
                <span className="stat-value">{stats.legs || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average:</span>
                <span className="stat-value">{(stats.average || 0).toFixed(2)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">First 9 Ø:</span>
                <span className="stat-value">{calculateFirstNineAvg(stats.firstNineDarts || [])}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Short Leg:</span>
                <span className="stat-value">{getShortLeg(stats.legsPlayed || [])}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Doubles:</span>
                <span className="stat-value">{stats.doubles || 0}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">High Score:</span>
                <span className="stat-value">{stats.highScore || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Highest Finish:</span>
                <span className="stat-value">{stats.highestFinish || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">180s:</span>
                <span className="stat-value">{stats.oneEighties || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Ton+ Finishes:</span>
                <span className="stat-value">{stats.tonPlusFinishes || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Score Distribution:</span>
                <span className="stat-value">{getScoreDistribution(stats.scoreDistribution || {})}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default LiveStatistics;