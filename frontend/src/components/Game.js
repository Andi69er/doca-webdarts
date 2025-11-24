import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SocketContext } from '../contexts/SocketContext'; // Pfad ist korrekt, wenn Game.js in /components liegt
import CameraArea from './CameraArea';
import PlayerScores from './PlayerScores';
import LiveStatistics from './LiveStatistics';
import NumberPad from './NumberPad';
import ThrowHistory from './ThrowHistory';
import GameChat from './GameChat';
import GameEndPopup from './GameEndPopup';
import './Game.css';

console.log('DEBUG Game: Game component rendering, roomId:', roomId);
console.log('DEBUG Game: socket:', socket);
console.log('DEBUG Game: user:', user);
function Game() {
  const { roomId } = useParams();
  const socket = useContext(SocketContext);
  
  // HINWEIS: Der Benutzer sollte idealerweise aus einem Authentifizierungs-Kontext kommen.
  // Für Testzwecke könnten wir ihn hier vorübergehend setzen, aber er darf nicht für alle gleich sein.
  // Beispiel: const { user } = useContext(AuthContext);
  // eslint-disable-next-line no-unused-vars
  const [user, setUser] = useState({ id: `user_${Date.now()}`, name: 'Guest Player' }); // Temporäre Lösung für einen einzigartigen User

  const [gameState, setGameState] = useState({
    players: [],
    currentPlayer: null, // Besser mit null initialisieren
    isGameStarted: false,
    scores: [],
    throws: [],
    statistics: {},
    winner: null,
    isBullOffActive: false,
    bullOffWinner: null,
    roomCreator: null,
    checkoutQuery: false,
    checkoutPlayer: null,
    rematchCountdown: 0,
    waitingTimer: 0, // Integriert in den gameState
    checkoutSuggestions: [], // Integriert in den gameState
    chatMessages: [] // Initialisieren, um Fehler zu vermeiden
  });

  // useRef, um die ID des Timers zu speichern und ihn korrekt löschen zu können
  const waitingTimerRef = useRef(null);

  // Effekt für die Socket-Events
  useEffect(() => {
    // --- WICHTIG: Benutzer-Management ---
    // In einer echten App würde man hier den eingeloggten Benutzer aus einem Context laden.
    // Die temporäre Lösung oben mit Date.now() sorgt zumindest für einzigartige IDs pro Session.

    // Listener für das gesamte Spiel-Update
    socket.on('game-state-update', (newGameState) => {
      setGameState(newGameState);
    });

    // Listener für den Checkout-Vorschlag
    socket.on('checkout-suggestions', (suggestions) => {
      setGameState(prev => ({ ...prev, checkoutSuggestions: suggestions }));
    });
    
    // Listener für den Countdown des Warteraums
    socket.on('waiting-timer-start', (seconds) => {
        // KORREKTUR: Bestehenden Timer löschen, bevor ein neuer gestartet wird
        if (waitingTimerRef.current) {
            clearInterval(waitingTimerRef.current);
        }

        let timeLeft = seconds;
        setGameState(prev => ({ ...prev, waitingTimer: timeLeft }));

        // Neuen Timer starten und seine ID im Ref speichern
        waitingTimerRef.current = setInterval(() => {
            timeLeft--;
            setGameState(prev => ({ ...prev, waitingTimer: timeLeft }));
            if (timeLeft <= 0) {
                clearInterval(waitingTimerRef.current);
            }
        }, 1000);
    });

    // Listener für Chat-Nachrichten
    socket.on('receiveMessage', (data) => {
      console.log('DEBUG Game: Received receiveMessage event:', data);
      console.log('DEBUG Game: Before updating chatMessages:', gameState.chatMessages);
      setGameState(prev => {
        const newMessages = { ...prev, chatMessages: [...prev.chatMessages, data] };
        console.log('DEBUG Game: After updating chatMessages:', newMessages.chatMessages);
        return newMessages;
      });
    });

    // Cleanup-Funktion: Alle Listener entfernen und Timer stoppen, wenn die Komponente verlassen wird
    return () => {
      socket.off('game-state-update');
      socket.off('checkout-suggestions');
      socket.off('waiting-timer-start');
      socket.off('receiveMessage');
      socket.off('bull-off-won');
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
      }
    };
  }, [socket]); // Abhängigkeit nur vom Socket, da dieser stabil sein sollte

  // Effekt, um dem Raum beizutreten, sobald die Komponente geladen ist
  useEffect(() => {
    if (user && roomId) {
        socket.emit('join-room', { roomId, user });
    }
  }, [socket, roomId, user]);

  // --- Handler-Funktionen (bleiben größtenteils gleich) ---
  const handleScoreInput = (score) => {
    socket.emit('score-input', { roomId, score, userId: user.id });
  };

  // eslint-disable-next-line no-unused-vars
  const handleCheckoutSelection = (dartCount) => {
    socket.emit('checkout-selection', { roomId, dartCount, userId: user.id });
    setGameState(prev => ({ ...prev, checkoutQuery: false }));
  };

  // eslint-disable-next-line no-unused-vars
  const handleBullOffThrow = (score) => {
    socket.emit('bull-off-throw', { roomId, score, userId: user.id });
  };

  const handleStartGame = () => {
    socket.emit('start-game', { roomId, userId: user.id });
  };

  // eslint-disable-next-line no-unused-vars
  const handleStartActualGame = (bullOffWinner) => {
    socket.emit('startActualGame', { roomId, bullOffWinner, userId: user.id });
  };

  const handleRematch = () => {
    socket.emit('rematch', { roomId, userId: user.id });
  };
  
  // --- Hilfsfunktionen für die Render-Logik ---
  const canStartGame = () => {
    // Sicherstellen, dass user und gameState.roomCreator existieren
    return user && (user.id === gameState.roomCreator || user.id === gameState.bullOffWinner);
  };
  
  // VERBESSERUNG: Direktere und sicherere Überprüfung, ob der Spieler an der Reihe ist
  const isCurrentUserActive = () => {
    if (!user || gameState.currentPlayer === null || !gameState.players[gameState.currentPlayer]) {
      return false;
    }
    return gameState.players[gameState.currentPlayer].id === user.id;
  };

  return (
    <div className="game-container">
      {/* Linker Bereich: Kamera */}
      <div className="camera-area">
        <CameraArea gameState={gameState} user={user} roomId={roomId} socket={socket} />
      </div>

      {/* Rechter Bereich: Spiel-Interface */}
      <div className="right-panel">
        <PlayerScores gameState={gameState} user={user} />
        <LiveStatistics statistics={gameState.statistics} />
        <NumberPad
          onScoreInput={handleScoreInput}
          checkoutSuggestions={gameState.checkoutSuggestions}
          waitingTimer={gameState.waitingTimer}
          isActive={isCurrentUserActive()} // Verwendet die verbesserte Logik
          gameState={gameState}
        />
        <ThrowHistory throws={gameState.throws} />
        <GameChat
          socket={socket}
          roomId={roomId}
          user={user}
          messages={gameState.chatMessages} // "|| []" nicht mehr nötig
        />
      </div>

      {/* Overlays für verschiedene Spiel-Zustände */}
      {gameState.isBullOffActive && (
        <div className="bull-off-overlay">
          {/* ... Bull-Off UI ... */}
        </div>
      )}

      {!gameState.isGameStarted && gameState.players.length >= 2 && canStartGame() && (
        <div className="game-start-overlay">
          <button className="start-game-btn" onClick={handleStartGame}>
            Start Game
          </button>
        </div>
      )}

      {gameState.winner && (
        <GameEndPopup
          winner={gameState.players.find(p => p.id === gameState.winner)}
          onRematch={handleRematch}
        />
      )}

      {gameState.checkoutQuery && (
        <div className="checkout-query-overlay">
          {/* ... Checkout UI ... */}
        </div>
      )}

      <Link to="/" className="back-to-lobby">Back to Lobby</Link>
    </div>
  );
}

export default Game;