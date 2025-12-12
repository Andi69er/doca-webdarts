import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [matchHistory, setMatchHistory] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    // Fetch user data and statistics
    Promise.all([
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch('/api/stats/1'), // Assuming user ID is 1 for demo
      fetch('/api/stats/1/history'),
      fetch('/api/stats/1/achievements')
    ])
      .then(([userRes, statsRes, historyRes, achievementsRes]) =>
        Promise.all([userRes.json(), statsRes.json(), historyRes.json(), achievementsRes.json()])
      )
      .then(([userData, statsData, historyData, achievementsData]) => {
        if (userData.error) {
          localStorage.removeItem('token');
          navigate('/');
          return;
        }
        setUser(userData);
        setStats(statsData);
        setMatchHistory(historyData);
        setAchievements(achievementsData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching profile data:', err);
        setLoading(false);
      });
  }, [navigate]);

  if (loading) return <div className="profile-loading">Loading profile...</div>;

  return (
    <div className="profile">
      <div className="profile-header">
        <button onClick={() => navigate('/')} className="back-btn">← Back to Lobby</button>
        <h1>Player Profile</h1>
      </div>

      <div className="profile-content">
        <div className="user-info-section">
          <h2>{user?.username}</h2>
          <p>Member since: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="stats-overview">
          <h2>Statistics Overview</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <h3>{stats.total_games || 0}</h3>
                <p>Total Games</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-content">
                <h3>{stats.wins || 0}</h3>
                <p>Wins</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <h3>{stats.win_rate || 0}%</h3>
                <p>Win Rate</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <h3>{stats.match_avg || 0}</h3>
                <p>Match Ø</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🔥</div>
              <div className="stat-content">
                <h3>{stats.first_9_avg || 0}</h3>
                <p>First 9 Ø</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💯</div>
              <div className="stat-content">
                <h3>{stats.checkout_percentage || 0}%</h3>
                <p>Doppel%</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⭐</div>
              <div className="stat-content">
                <h3>{stats.highest_finish || 0}</h3>
                <p>Highest Finish</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <h3>{stats.total_180s || 0}</h3>
                <p>180er</p>
              </div>
            </div>
          </div>
        </div>

        <div className="achievements-section">
          <h2>Achievements</h2>
          <div className="achievements-grid">
            {achievements.map((achievement, index) => (
              <div key={index} className="achievement-card">
                <div className="achievement-icon">{achievement.icon}</div>
                <div className="achievement-content">
                  <h4>{achievement.name}</h4>
                  <p>{achievement.description}</p>
                </div>
              </div>
            ))}
            {achievements.length === 0 && (
              <p>No achievements yet. Play some games to unlock them!</p>
            )}
          </div>
        </div>

        <div className="match-history-section">
          <h2>Recent Match History</h2>
          <div className="match-history-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Game Type</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>Average</th>
                  <th>180s</th>
                </tr>
              </thead>
              <tbody>
                {matchHistory.map((match) => (
                  <tr key={match.match_id}>
                    <td>{new Date(match.played_at).toLocaleDateString()}</td>
                    <td>{match.game_type.toUpperCase()}</td>
                    <td>{match.opponent_name || 'Unknown'}</td>
                    <td className={match.result === 'Sieg' ? 'win' : 'loss'}>
                      {match.result}
                    </td>
                    <td>{match.player_score} - {match.opponent_score}</td>
                    <td>{match.player_avg}</td>
                    <td>{match.player_180s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matchHistory.length === 0 && (
              <p>No matches played yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;