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
    const { socket } = useSocket();
    const [user, setUser] = useState({ id: null, name: 'Guest Player' });

    const [gameState, setGameState] = useState(null); // Initialer State ist null

    const [inputLockout, setInputLockout] = useState(false); // 5-sec lockout after score input
    const [lockoutTimer, setLockoutTimer] = useState(0);

    const waitingTimerRef = useRef(null);
    const lockoutTimerRef = useRef(null);

    useEffect(() => {

        if (!socket) {
            console.error("Socket not available on mount.");
            return;
        }

        // Event Listeners aufsetzen
        const handleGameStateUpdate = (newGameState) => {
            console.log('Debug: Received game-state-update event:', newGameState);
            setGameState(newGameState);
        };

        const handleGameState = (receivedGameState) => {
            setGameState(receivedGameState);
        };

        const handleCheckoutSuggestions = (suggestions) => {
            setGameState(prev => ({ ...prev, checkoutSuggestions: suggestions }));
        };

        const handleWaitingTimerStart = (seconds) => {
            if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
            let timeLeft = seconds;
            setGameState(prev => ({ ...prev, waitingTimer: timeLeft }));
            waitingTimerRef.current = setInterval(() => {
                timeLeft--;
                setGameState(prev => ({ ...prev, waitingTimer: timeLeft }));
                if (timeLeft <= 0) clearInterval(waitingTimerRef.current);
            }, 1000);
        };

        const handleReceiveMessage = (data) => {
            setGameState(prev => ({
                ...prev,
                chatMessages: [...(prev.chatMessages || []), data]
            }));
        };

        socket.on('game-state-update', handleGameStateUpdate);
        socket.on('gameState', handleGameState);
        socket.on('checkout-suggestions', handleCheckoutSuggestions);
        socket.on('waiting-timer-start', handleWaitingTimerStart);
        socket.on('receiveMessage', handleReceiveMessage);

        // KORREKTUR: aktiv den GameState anfordern, sobald die Komponente geladen wird.
        socket.emit('getGameState', roomId);

        // Cleanup-Funktion
        return () => {
            socket.off('game-state-update', handleGameStateUpdate);
            socket.off('gameState', handleGameState);
            socket.off('checkout-suggestions', handleCheckoutSuggestions);
            socket.off('waiting-timer-start', handleWaitingTimerStart);
            socket.off('receiveMessage', handleReceiveMessage);
            if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
        };
    }, [socket, roomId]); // Abhängigkeiten korrigiert

    // Set user ID to socket ID when available
    useEffect(() => {
        if (socket && socket.id) {
            setUser(prev => ({ ...prev, id: socket.id }));
        }
    }, [socket]);

    // HINWEIS: Die 'user' Logik ist hier vereinfacht, da sie aus dem Context kommt.
    // Die folgenden Funktionen bleiben für die Interaktion mit dem Backend.

    const handleScoreInput = (score) => {
        if (socket && user.id && !inputLockout) {
            socket.emit('score-input', { roomId, score, userId: user.id });

            // Start 5-second lockout
            setInputLockout(true);
            setLockoutTimer(5);

            // Clear any existing lockout timer
            if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);

            // Start countdown
            lockoutTimerRef.current = setInterval(() => {
                setLockoutTimer(prev => {
                    if (prev <= 1) {
                        setInputLockout(false);
                        clearInterval(lockoutTimerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    const handleCheckoutSelection = (dartCount) => {
        if (socket && user.id) socket.emit('checkout-selection', { roomId, dartCount, userId: user.id });
    };

    // ... weitere handler (handleBullOffThrow, handleStartGame, etc.) bleiben unverändert ...
    const handleBullOffThrow = (score) => {
        if (socket && user.id) socket.emit('bull-off-throw', { roomId, score, userId: user.id });
    };
    const handleStartGame = () => {
        if (socket && user.id) socket.emit('start-game', { roomId, userId: user.id });
    };
    const handleRematch = () => {
        if (socket && user.id) socket.emit('rematch', { roomId, userId: user.id });
    };

    const isCurrentUserActive = () => {
        if (!gameState || !gameState.gameState || !user) {
            return false;
        }
        const { players } = gameState;
        const { currentPlayerIndex } = gameState.gameState;
        const currentPlayer = players[currentPlayerIndex];

        if (!currentPlayer) {
            return false;
        }
        return currentPlayer.id === user.id;
    };
    
    // Verbesserte Ladeanzeige
    if (!gameState) {
        return <div className="loading-screen">Lade Spielzustand... Warten auf Daten vom Server...</div>;
    }

    // Check if user is the host
    const isHost = user && user.id && gameState.hostId === user.id;
    // Check if game has started
    const gameStarted = gameState.gameState && gameState.gameState.currentPlayerIndex !== undefined;

    return (
        <div className="game-container">
            <div className="game-info">
                <h2>Room: {gameState.name}</h2>
                <p>Game Mode: {gameModeMap[gameState.gameMode] || gameState.gameMode}</p>
                {!gameStarted && (
                    <div className="waiting-for-players">
                        <p>Warten auf Spieler...</p>
                        <p>Spieler: {gameState.players?.map(p => p.name).join(', ')}</p>
                        {isHost && (
                            <button onClick={handleStartGame} className="start-game-button">
                                Spiel starten
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="camera-area">
                <CameraArea gameState={gameState} user={user} roomId={roomId} socket={socket} />
            </div>

            <div className="right-panel">
                <PlayerScores gameState={gameState} user={user} />
                <LiveStatistics gameState={gameState} />
                {gameStarted && (
                    <NumberPad
                        onScoreInput={handleScoreInput}
                        checkoutSuggestions={gameState.checkoutSuggestions}
                        waitingTimer={gameState.waitingTimer}
                        isActive={isCurrentUserActive()}
                        isLocked={inputLockout}
                        lockoutTimer={lockoutTimer}
                        gameState={gameState}
                    />
                )}
                <ThrowHistory gameState={gameState} />
                <GameChat
                    socket={socket}
                    roomId={roomId}
                    user={user}
                    messages={gameState.chatMessages || []}
                />
            </div>

            {/* Die restliche JSX-Logik bleibt gleich */}
            {gameState.gameState && gameState.gameState.gameWinner && (
                <GameEndPopup
                    winner={gameState.players.find(p => p.id === gameState.gameState.gameWinner)}
                    onRematch={handleRematch}
                />
            )}

            <Link to="/" className="back-to-lobby">Back to Lobby</Link>
        </div>
    );
}

// Add game mode mapping
const gameModeMap = {
    'X01Game': 'X01',
    'CricketGame': 'Cricket',
    'BullOffGame': 'Bull Off'
};

export default Game;
