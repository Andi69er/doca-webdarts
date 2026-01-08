import { useCallback } from 'react';

const useGameFlow = ({
    socket,
    roomId,
    user,
    gameState,
    numpadState,
    setNumpadState,
    lockForCricket,
    startUndoWindow,
    forceUnlock,
    clearLockTimer,
    setLocalGameStarted,
    getDefaultStartingPlayerId,
    startingPlayerId,
    setStartingPlayerId,
    setShowBullOffModal,
    setBullOffModalShown,
    setIsStartingGame,
    startGameTimeoutRef,
    setTurnEndTime,
    setVideoLayout,
    setShowWinnerPopup,
    setShowGameEndButtons,
    doubleAttemptsQuery,
    setDoubleAttemptsQuery,
    doubleAttemptsResponsePending,
    setDoubleAttemptsResponsePending,
    pendingLegWinner,
    setPendingLegWinner,
    setLegWinnerData,
    setShowLegWinnerPopup,
    setShowCheckoutPopup,
    setCheckoutPlayer,
    checkoutPlayer,
    selectDevice,
    isCameraEnabled,
    startCamera,
    setDebugLogs,
    ignoreServerUntil,
    expectedLocalScore
}) => {
    const handleDeviceChange = useCallback((deviceId) => {
        selectDevice(deviceId);
        if (isCameraEnabled) {
            startCamera(deviceId);
        }
    }, [selectDevice, isCameraEnabled, startCamera]);

    const handleScoreInput = useCallback((scoreInput) => {
        const currentIndex = gameState?.currentPlayerIndex || 0;
        const currentPlayer = gameState?.players?.[currentIndex];
        const isMyTurn = currentPlayer?.id === user.id;

        if (!isMyTurn || numpadState.isLocked) {
            return;
        }
        if (!currentPlayer || !socket || !user?.id) {
            return;
        }

        let scorePayload;
        if (gameState.mode === 'cricket') {
            scorePayload = scoreInput;
        } else {
            const points = parseInt(scoreInput, 10);
            if (isNaN(points)) {
                return;
            }
            scorePayload = points;
        }

        setLocalGameStarted(true);

        if (gameState.mode === 'cricket') {
            lockForCricket(user.id);
        } else {
            startUndoWindow(user.id);
        }

        const payload = {
            roomId,
            userId: currentPlayer.id,
            score: scorePayload
        };

        socket.emit('score-input', payload);
    }, [gameState, user?.id, numpadState.isLocked, socket, setLocalGameStarted, lockForCricket, startUndoWindow, roomId]);

    const handleUndo = useCallback(() => {
        if (socket && user.id && numpadState.canUndo && window.confirm('Undo?')) {
            ignoreServerUntil.current = 0;
            expectedLocalScore.current = null;
            socket.emit('undo', { roomId, userId: user.id });
            setNumpadState(prev => ({
                ...prev,
                isLocked: true,
                canUndo: false,
                lockedPlayerId: null
            }));
            clearLockTimer();
        }
    }, [socket, user.id, numpadState.canUndo, roomId, setNumpadState, clearLockTimer, ignoreServerUntil, expectedLocalScore]);

    const handleStartGame = useCallback(() => {
        if (!socket) {
            return;
        }

        setIsStartingGame(true);
        forceUnlock();
        clearLockTimer();
        setTurnEndTime(null);

        startGameTimeoutRef.current = setTimeout(() => {
            setIsStartingGame(false);
        }, 10000);

        const defaultStarter = getDefaultStartingPlayerId();
        let finalStartingPlayerId = startingPlayerId || defaultStarter;

        if (finalStartingPlayerId === 'bull-off') {
            setShowBullOffModal(true);
            setBullOffModalShown(true);
        }

        const payload = {
            roomId,
            userId: user.id,
            resetScores: true,
            startingPlayerId: finalStartingPlayerId
        };
        socket.emit('start-game', payload);

        if (user.id === finalStartingPlayerId) {
            setVideoLayout(prev => prev.manual ? prev : ({
                mode: 'fullscreen',
                currentPlayerId: 'local',
                manual: false
            }));
        } else if (finalStartingPlayerId && finalStartingPlayerId !== 'bull-off') {
            setVideoLayout(prev => prev.manual ? prev : ({
                mode: 'fullscreen',
                currentPlayerId: finalStartingPlayerId,
                manual: false
            }));
        }
    }, [socket, setIsStartingGame, forceUnlock, clearLockTimer, setTurnEndTime, startGameTimeoutRef, getDefaultStartingPlayerId, startingPlayerId, roomId, user.id, setShowBullOffModal, setBullOffModalShown, setVideoLayout]);

    const handleRematch = useCallback(() => {
        setShowWinnerPopup(false);
        setShowGameEndButtons(false);
        setStartingPlayerId(null);
        if (socket) {
            socket.emit('rematch', { roomId, userId: user.id });
        }
    }, [setShowWinnerPopup, setShowGameEndButtons, setStartingPlayerId, socket, roomId, user.id]);

    const handleExit = useCallback(() => {
        setShowWinnerPopup(false);
        setShowGameEndButtons(false);
        if (socket) {
            socket.emit('leave-game', { roomId, userId: user.id });
        }
        if (window.history?.back) {
            setTimeout(() => window.history.back(), 300);
        }
    }, [setShowWinnerPopup, setShowGameEndButtons, socket, roomId, user.id]);

    const handleBullOffComplete = useCallback((winnerId) => {
        setShowBullOffModal(false);
        setBullOffModalShown(false);
        setIsStartingGame(false);
        if (startGameTimeoutRef.current) {
            clearTimeout(startGameTimeoutRef.current);
            startGameTimeoutRef.current = null;
        }

        if (socket) {
            const payload = {
                roomId,
                userId: user.id,
                resetScores: true,
                startingPlayerId: winnerId
            };
            socket.emit('start-game', payload);
        }
    }, [setShowBullOffModal, setBullOffModalShown, setIsStartingGame, startGameTimeoutRef, socket, roomId, user.id]);

    const handleDoubleAttemptsResponse = useCallback((responseIndex) => {
        if (socket && doubleAttemptsQuery && !doubleAttemptsResponsePending) {
            setDoubleAttemptsResponsePending(true);
            socket.emit('double-attempts-response', {
                roomId,
                userId: user.id,
                response: responseIndex,
                queryType: doubleAttemptsQuery.type,
                score: doubleAttemptsQuery.score,
                startScore: doubleAttemptsQuery.startScore
            });
            setDoubleAttemptsQuery(null);
        }
    }, [socket, doubleAttemptsQuery, doubleAttemptsResponsePending, roomId, user.id, setDoubleAttemptsResponsePending, setDoubleAttemptsQuery]);

    const handleCheckoutSelect = useCallback((dartCount) => {
        if (socket && checkoutPlayer) {
            socket.emit('checkout-selection', {
                roomId,
                dartCount
            });
            setShowCheckoutPopup(false);
            setCheckoutPlayer(null);

            if (pendingLegWinner) {
                setTimeout(() => {
                    setLegWinnerData(pendingLegWinner);
                    setShowLegWinnerPopup(true);
                    setPendingLegWinner(null);

                    setTimeout(() => {
                        setShowLegWinnerPopup(false);
                    }, 3000);
                }, 100);
            }
        }
    }, [socket, checkoutPlayer, roomId, setShowCheckoutPopup, setCheckoutPlayer, pendingLegWinner, setLegWinnerData, setShowLegWinnerPopup, setPendingLegWinner]);

    const handleClearLogs = useCallback(() => {
        const timestamp = `[${new Date().toLocaleTimeString()}] Debug logs cleared`;
        setDebugLogs([timestamp]);
    }, [setDebugLogs]);

    const handleRefreshState = useCallback(() => {
        if (socket) {
            socket.emit('getGameState', roomId);
            setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Manual getGameState sent`]);
        }
    }, [socket, roomId, setDebugLogs]);

    return {
        handleDeviceChange,
        handleScoreInput,
        handleUndo,
        handleStartGame,
        handleRematch,
        handleExit,
        handleBullOffComplete,
        handleDoubleAttemptsResponse,
        handleCheckoutSelect,
        handleClearLogs,
        handleRefreshState
    };
};

export default useGameFlow;
