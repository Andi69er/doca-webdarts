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
    const [user, setUser] = useState({ id: `user_${Date.now()}`, name: 'Guest Player' });

    const [gameState, setGameState] = useState(null); // Initialer State ist null

    const waitingTimerRef = useRef(null);

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

    // HINWEIS: Die 'user' Logik ist hier vereinfacht, da sie aus dem Context kommt.
    // Die folgenden Funktionen bleiben für die Interaktion mit dem Backend.

    const handleScoreInput = (score) => {
        if (socket) socket.emit('score-input', { roomId, score, userId: user.id });
    };

    const handleCheckoutSelection = (dartCount) => {
        if (socket) socket.emit('checkout-selection', { roomId, dartCount, userId: user.id });
    };
    
    // ... weitere handler (handleBullOffThrow, handleStartGame, etc.) bleiben unverändert ...
    const handleBullOffThrow = (score) => {
        if (socket) socket.emit('bull-off-throw', { roomId, score, userId: user.id });
    };
    const handleStartGame = () => {
        if (socket) socket.emit('start-game', { roomId, userId: user.id });
    };
    const handleRematch = () => {
        if (socket) socket.emit('rematch', { roomId, userId: user.id });
    };

    const isCurrentUserActive = () => {
        const { players = [], currentPlayer, gameMode = {} } = gameState || {};
        if (!gameState || !user || currentPlayer === null || !players[currentPlayer]) {
            return false;
        }
        return players[currentPlayer].id === user.id;
    };
    
    // Verbesserte Ladeanzeige
    if (!gameState) {
        return <div className="loading-screen">Lade Spielzustand... Warten auf Daten vom Server...</div>;
    }

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

            {/* Die restliche JSX-Logik bleibt gleich */}
            {gameState.winner && (
                <GameEndPopup
                    winner={gameState.players.find(p => p.id === gameState.winner)}
                    onRematch={handleRematch}
                />
            )}

            <Link to="/" className="back-to-lobby">Back to Lobby</Link>
        </div>
    );
}

export default Game;