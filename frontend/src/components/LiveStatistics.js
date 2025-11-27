import React from 'react';

function LiveStatistics({ gameState: room }) {
  // Guard against missing data
  if (!room || !Array.isArray(room.players) || !room.gameState) {
    return <div>Lade Statistiken...</div>;
  }

  const players = room.players;
  // Statistics are not yet fully implemented in the backend gameState, so this provides a graceful fallback.
  const currentStats = room.gameState.statistics || {};

  const calculateFirstNineAvg = (firstNineDarts) => {
    if (!firstNineDarts || firstNineDarts.length === 0) return 0;
    const sum = firstNineDarts.reduce((a, b) => a + b, 0);
    return (sum / firstNineDarts.length).toFixed(2);
  };

  const getShortLeg = (legsPlayed) => {
    if (!legsPlayed || legsPlayed.length === 0) return 'N/A';
    return Math.min(...legsPlayed);
  };

  const getScoreDistribution = (dist) => {
    if (!dist) return '';
    return `19-: ${dist['19-'] || 0}, 20-39: ${dist['20-39'] || 0}, 40-59: ${dist['40-59'] || 0}, 60-79: ${dist['60-79'] || 0}, 80-99: ${dist['80-99'] || 0}, 100-119: ${dist['100-119'] || 0}, 120-139: ${dist['120-139'] || 0}, 140-159: ${dist['140-159'] || 0}, 160-180: ${dist['160-180'] || 0}, 180+: ${dist['180+'] || 0}`;
  };

  const player1 = players[0];
  const player2 = players[1];
  const stats1 = (player1 && currentStats[player1.id]) || {};
  const stats2 = (player2 && currentStats[player2.id]) || {};

  return (
    <div className="live-statistics">
      <h4>LIVE STATISTICS</h4>
      <div className="stats-table">
        <div className="stats-header">
          <div className="player-name-col">{player1?.name?.toUpperCase() || ''}</div>
          <div className="label-col"></div>
          <div className="player-name-col">{player2?.name?.toUpperCase() || ''}</div>
        </div>
        <div className="stats-row">
          <div className="stat-value">{(stats1.average || 0).toFixed(2)}</div>
          <div className="stat-label">AVERAGE</div>
          <div className="stat-value">{(stats2.average || 0).toFixed(2)}</div>
        </div>
        <div className="stats-row">
          <div className="stat-value">{calculateFirstNineAvg(stats1.firstNineDarts)}</div>
          <div className="stat-label">FIRST 9</div>
          <div className="stat-value">{calculateFirstNineAvg(stats2.firstNineDarts)}</div>
        </div>
        <div className="stats-row">
          <div className="stat-value">{stats1.doubles || 0}%</div>
          <div className="stat-label">DOUBLES</div>
          <div className="stat-value">{stats2.doubles || 0}%</div>
        </div>
        <div className="stats-row">
          <div className="stat-value">{stats1.highScore || 0}</div>
          <div className="stat-label">HIGHSCORE</div>
          <div className="stat-value">{stats2.highScore || 0}</div>
        </div>
      </div>
    </div>
  );
}

export default LiveStatistics;
