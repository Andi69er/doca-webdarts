import React from 'react';
import DartsPerLegTable from './DartsPerLegTable';

const PlayerScores = ({ gameState, user }) => {
  if (!gameState || !gameState.players) return null;

  const players = gameState.players;
  const player1 = players[0];
  const player2 = players[1]; 

  // Neue Funktion: isRightSide bestimmt, ob wir die Elemente tauschen
  const renderPlayerCard = (player, label, isRightSide = false) => {
    if (!player) {
      return (
        <div className="player-card empty">
          <h3>{label}</h3>
          <div className="waiting-text">Warte...</div>
        </div>
      );
    }

    const isActive = gameState.gameState && 
                     gameState.players[gameState.gameState.currentPlayerIndex]?.id === player.id;

    // Wir definieren die Blöcke als Variablen, damit wir sie unten leicht tauschen können
    const LegsBlock = (
        <div className="legs-section-bild1">
            <div className="legs-label-bild1">Legs</div>
            <div className="legs-count-bild1">{player.legs}</div>
        </div>
    );

    const DartsInfoBlock = (
        <div className="dart-info-bild1">
            <span className="dart-icon">🎯</span>
            <span className="additional-number">{player.lastScore || '0'}</span>
        </div>
    );

    return (
      <div className={`player-card-bild1 ${isActive ? 'active-turn' : ''}`}>
        {isActive && <div className="active-dot"></div>}
        
        <div className="player-name-bild1">
            {player.name} {user?.id === player.id ? '(Du)' : ''}
        </div>

        <div className="score-details-bild1">
          {/* LOGIK: Wenn es der rechte Spieler ist, kommt DartsInfo ZUERST (links) */}
          {isRightSide ? DartsInfoBlock : LegsBlock}

          {/* Der Score ist immer in der Mitte */}
          <div className="main-score-bild1">{player.score}</div>

          {/* LOGIK: Wenn es der rechte Spieler ist, kommt Legs ZULETZT (rechts) */}
          {isRightSide ? LegsBlock : DartsInfoBlock}
        </div>
      </div>
    );
  };

  return (
      <div className="player-scores-container">
        {/* Linker Spieler (Player 1) - Standard Layout */}
        <div className="player-score-section">
          {renderPlayerCard(player1, "Player 1", false)}
        </div>

        {/* Mitte: Tabelle */}
        <div className="player-history-section">
           <div className="history-wrapper" style={{ width: '100%', height: '100%', padding: 0, display: 'flex' }}>
              <DartsPerLegTable gameState={gameState} />
           </div>
        </div>

        {/* Rechter Spieler (Player 2) - isRightSide = true (Spiegelverkehrt) */}
        <div className="player-score-section">
          {renderPlayerCard(player2, "Player 2", true)}
        </div>
      </div>
    );
};

export default PlayerScores;