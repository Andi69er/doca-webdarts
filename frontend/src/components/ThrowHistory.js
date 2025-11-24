import React from 'react';

function ThrowHistory({ history }) {
  return (
    <div className="throw-history">
      <h4>Throw History</h4>
      <div className="history-list">
        {history.slice(-10).map((throwItem, index) => (
          <div key={index} className="throw-item">
            <span className="throw-score">{throwItem.score}</span>
            <span className="throw-darts">{throwItem.darts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ThrowHistory;