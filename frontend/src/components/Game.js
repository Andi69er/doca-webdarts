import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import CameraArea from './CameraArea';
import PlayerScores from './PlayerScores';
import LiveStatistics from './LiveStatistics';
import NumberPad from './NumberPad';
import ThrowHistory from './ThrowHistory';
import GameChat from './GameChat';
import GameEndPopup from './GameEndPopup';
import './Game.css';

function Game() {
  const { roomId } = useParams();
  // FIX: Destructure the socket from the object returned by useSocket()
  const { socket } = useSocket();

  // HINWEIS: Der Benutzer sollte idealerweise aus einem Authentifizierungs-Kontext kommen.
  // Temporäre Lösung für einen einzigartigen User pro Session.
  const [user, setUser] = useState({ id: `user_${Date.now()}`, name: 'Guest Player' });
  
  // Debugging-Logs an der richtigen Stelle platziert
  useEffect(() => {
    console.log('DEBUG Game: Component mounted. roomId:', roomId);
    console.log('DEBUG Game: Socket instance:', socket);
    console.log('DEBUG Game: User state:', user);
  }, [roomId, socket, user]);


  const [gameState, setGameState] = useState({
    players: [],
    currentPlayer: null,
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
    waitingTimer: 0,
    checkoutSuggestions: [],
    chatMessages: []
  });

  const waitingTimerRef = useRef(null);

  useEffect(() => {
    if (!socket) return; // Warten, bis der Socket verfügbar ist

    socket.on('game-state-update', (newGameState) => {
      setGameState(newGameState);
    });

    socket.on('checkout-suggestions', (suggestions) => {
      setGameState(prev => ({ ...prev, checkoutSuggestions: suggestions }));
    });
    
    socket.on('waiting-timer-start', (seconds) => {
        if (waitingTimerRef.current) {
            clearInterval(waitingTimerRef.current);
        }

        let timeLeft = seconds;
        setGameState(prev => ({ ...prev, waitingTimer: timeLeft }));

        waitingTimerRef.current = setInterval(() => {
            timeLeft--;
            setGameState(prev => ({ ...prev, waitingTimer: timeLeft }));
            if (timeLeft <= 0) {
                clearInterval(waitingTimerRef.current);
            }
        }, 1000);
    });

    socket.on('receiveMessage', (data) => {
      setGameState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, data]
      }));
    });

    return () => {
      socket.off('game-state-update');
      socket.off('checkout-suggestions');
      socket.off('waiting-timer-start');
      socket.off('receiveMessage');
      if (waitingTimerRef.current) {
        clearInterval(waitingTimerRef.current);
      }
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    if (user && roomId) {
        socket.emit('join-room', { roomId, user });
    }
  }, [socket, roomId, user]);

  const handleScoreInput = (score) => {
    if (socket) socket.emit('score-input', { roomId, score, userId: user.id });
  };

  const handleCheckoutSelection = (dartCount) => {
    if (socket) socket.emit('checkout-selection', { roomId, dartCount, userId: user.id });
    setGameState(prev => ({ ...prev, checkoutQuery: false }));
  };

  const handleBullOffThrow = (score) => {
    if (socket) socket.emit('bull-off-throw', { roomId, score, userId: user.id });
  };

  const handleStartGame = () => {
    if (socket) socket.emit('start-game', { roomId, userId: user.id });
  };

  const handleStartActualGame = (bullOffWinner) => {
    if (socket) socket.emit('startActualGame', { roomId, bullOffWinner, userId: user.id });
  };

  const handleRematch = () => {
    if (socket) socket.emit('rematch', { roomId, userId: user.id });
  };
  
  const canStartGame = () => {
    return user && (user.id === gameState.roomCreator || user.id === gameState.bullOffWinner);
  };
  
  const isCurrentUserActive = () => {
    if (!user || gameState.currentPlayer === null || !gameState.players[gameState.currentPlayer]) {
      return false;
    }
    return gameState.players[gameState.currentPlayer].id === user.id;
  };

  if (!socket) return <div>Loading...</div>;

  return (
    <div className="game-container">
      <div className="camera-area">
        <CameraArea gameState={gameState} user={user} roomId={roomId} socket={socket} />
      </div>

      <div className="right-panel">
        <PlayerScores gameState={gameState} user={user} />
        <LiveStatistics statistics={gameState.statistics} />
        <NumberPad
          onScoreInput={handleScoreInput}
          checkoutSuggestions={gameState.checkoutSuggestions}
          waitingTimer={gameState.waitingTimer}
          isActive={isCurrentUserActive()}
          gameState={gameState}
        />
        <ThrowHistory throws={gameState.throws} />
        <GameChat
          socket={socket}
          roomId={roomId}
          user={user}
          messages={gameState.chatMessages}
        />
      </div>

      {gameState.isBullOffActive && (
        <div className="bull-off-overlay">
          {/* Bull-Off UI hier */}
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
          {/* Checkout UI hier */}
        </div>
      )}

      <Link to="/" className="back-to-lobby">Back to Lobby</Link>
    </div>
  );
}

export default Game;
