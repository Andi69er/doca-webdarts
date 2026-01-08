import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import useCameraController from '../hooks/useCameraController';
import useRecordingManager from '../hooks/useRecordingManager';
import useGameConnection from '../hooks/useGameConnection';
import useGameFlow from '../hooks/useGameFlow';
import useNumpadLock from '../hooks/useNumpadLock';

const GameContext = createContext(null);

export const GameProvider = ({ roomId, socket, children }) => {
    const [user, setUser] = useState({ id: null, name: 'Gast' });
    const [isSpectator, setIsSpectator] = useState(false);
    const [gameState, setGameState] = useState(null);
    const [localGameStarted, setLocalGameStarted] = useState(false);
    const [turnEndTime, setTurnEndTime] = useState(null);
    const [isStartingGame, setIsStartingGame] = useState(false);
    const startGameTimeoutRef = useRef(null);
    const [startingPlayerId, setStartingPlayerId] = useState(null);
    const [showBullOffModal, setShowBullOffModal] = useState(false);
    const [bullOffModalShown, setBullOffModalShown] = useState(false);
    const [bullOffCompleted, setBullOffCompleted] = useState(false);
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);
    const [showLegWinnerPopup, setShowLegWinnerPopup] = useState(false);
    const [legWinnerData, setLegWinnerData] = useState(null);
    const [showGameEndButtons, setShowGameEndButtons] = useState(false);
    const [doubleAttemptsQuery, setDoubleAttemptsQuery] = useState(null);
    const [doubleAttemptsResponsePending, setDoubleAttemptsResponsePending] = useState(false);
    const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
    const [checkoutPlayer, setCheckoutPlayer] = useState(null);
    const [pendingLegWinner, setPendingLegWinner] = useState(null);
    const [showDebug, setShowDebug] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);
    const [videoLayout, setVideoLayout] = useState({ mode: 'splitscreen', currentPlayerId: null, manual: false });
    const ignoreServerUntil = useRef(0);
    const expectedLocalScore = useRef(null);
    const pollRef = useRef(null);

    const { numpadState, setNumpadState, lockForCricket, startUndoWindow, forceUnlock, clearLockTimer } = useNumpadLock();
    const {
        devices,
        selectedDeviceId,
        selectDevice,
        localVideoRef,
        localStream,
        remoteStreams,
        isCameraEnabled,
        startCamera,
        stopCamera,
        autoConnectToOpponents
    } = useCameraController({ socket, roomId, gameState, user });
    const { isRecording, startRecording, stopRecording } = useRecordingManager({ localStream, remoteStreams });

    const getDefaultStartingPlayerId = useCallback(() => {
        if (!gameState?.players || gameState.players.length < 2) {
            return null;
        }
        const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
        const opponentPlayer = gameState.players.find(p => p.id !== gameState.hostId);

        if (gameState.whoStarts === 'opponent') {
            return opponentPlayer?.id;
        }
        if (gameState.whoStarts === 'random') {
            return 'bull-off';
        }
        return hostPlayer?.id;
    }, [gameState]);

    const computeAutoVideoLayout = useCallback((state = null) => {
        const players = state?.players || [];
        if (!players.length) {
            return { mode: 'splitscreen', currentPlayerId: null };
        }

        if (state?.gameStatus === 'active') {
            const index = state.currentPlayerIndex ?? state.gameState?.currentPlayerIndex ?? 0;
            const activePlayer = players[index];
            if (activePlayer) {
                return {
                    mode: 'fullscreen',
                    currentPlayerId: activePlayer.id === user?.id ? 'local' : activePlayer.id
                };
            }
        }

        if (!state?.gameStatus || state.gameStatus === 'waiting' || state.gameStatus === 'finished') {
            return { mode: 'splitscreen', currentPlayerId: null };
        }

        return { mode: 'splitscreen', currentPlayerId: null };
    }, [user?.id]);

    const handleGameState = useCallback((newState) => {
        if (!newState) {
            return;
        }

        const myId = socket?.id || user?.id;
        const serverMe = newState.players?.find(p => p.id === myId);

        if (localGameStarted && expectedLocalScore.current !== null && serverMe) {
            if (serverMe.score > expectedLocalScore.current) {
                return;
            }
        }

        const startingScore = newState?.gameOptions?.startingScore || 501;
        if (newState.players?.some(p => p.score < startingScore) && !localGameStarted) {
            setLocalGameStarted(true);
        }

        setGameState(prev => {
            if (!prev) {
                setTurnEndTime(null);
            }

            if (newState.gameStatus === 'finished' && prev?.gameStatus !== 'finished') {
                setShowWinnerPopup(true);
                setShowLegWinnerPopup(false);
                setShowGameEndButtons(false);
            }

            if (newState.gameStatus === 'active' && prev?.gameStatus !== 'active') {
                setLocalGameStarted(true);
                setIsStartingGame(false);
                if (startGameTimeoutRef.current) {
                    clearTimeout(startGameTimeoutRef.current);
                    startGameTimeoutRef.current = null;
                }
            }

            const updatedPlayers = (newState.players || prev?.players || []).map(newPlayer => {
                const existingPlayer = (prev?.players || []).find(p => p.id === newPlayer.id) || {};
                return {
                    ...existingPlayer,
                    ...newPlayer,
                    dartsThrown: newPlayer.dartsThrown || existingPlayer.dartsThrown || 0,
                    avg: newPlayer.avg || existingPlayer.avg || '0.00'
                };
            });

            const currentPlayerIndex = newState.currentPlayerIndex !== undefined
                ? newState.currentPlayerIndex
                : (prev?.currentPlayerIndex || 0);
            const currentPlayer = updatedPlayers[currentPlayerIndex];
            const prevPlayerIndex = prev?.currentPlayerIndex;
            const releaseLock = () => {
                forceUnlock();
                setTurnEndTime(null);
            };

            if (currentPlayer && user.id) {
                const newIsMyTurn = currentPlayer.id === user.id;

                if (newIsMyTurn && prevPlayerIndex !== currentPlayerIndex) {
                    releaseLock();
                }

                if (newState.gameStatus === 'active' && newIsMyTurn) {
                    releaseLock();
                }

                if (newState.gameStatus === 'active' && prev?.gameStatus !== 'active' && newIsMyTurn) {
                    releaseLock();
                }

                if (newState.gameStatus === 'active' && newIsMyTurn && currentPlayerIndex !== prevPlayerIndex) {
                    releaseLock();
                }

                if (newState.mode === 'cricket' && newIsMyTurn) {
                    forceUnlock();
                }

                const desiredLayout = computeAutoVideoLayout({
                    ...newState,
                    players: updatedPlayers,
                    currentPlayerIndex
                });

                setVideoLayout(prev => {
                    if (prev.manual) {
                        return prev;
                    }
                    if (prev.mode === desiredLayout.mode && prev.currentPlayerId === desiredLayout.currentPlayerId && prev.manual === false) {
                        return prev;
                    }
                    return {
                        ...desiredLayout,
                        manual: false
                    };
                });
            }

            if (newState.doubleAttemptsQuery) {
                setDoubleAttemptsQuery(newState.doubleAttemptsQuery);
                setDoubleAttemptsResponsePending(false);
            }

            if (newState.checkoutQuery) {
                setCheckoutPlayer(newState.checkoutQuery.player);
                setShowCheckoutPopup(true);
            }

            return {
                ...(prev || {}),
                ...newState,
                players: updatedPlayers,
                gameStatus: newState.gameStatus || (prev?.gameStatus || 'waiting'),
                gameOptions: newState.gameOptions || prev?.gameOptions,
                gameState: {
                    ...(prev?.gameState || {}),
                    ...(newState.gameState || {}),
                    currentPlayerIndex
                },
                currentPlayerIndex,
                whoStarts: newState.whoStarts || prev?.whoStarts
            };
        });
    }, [socket, user?.id, localGameStarted, setLocalGameStarted, setTurnEndTime, setShowWinnerPopup, setShowLegWinnerPopup, setShowGameEndButtons, setIsStartingGame, startGameTimeoutRef, forceUnlock, setVideoLayout, setDoubleAttemptsQuery, setDoubleAttemptsResponsePending, setCheckoutPlayer, setShowCheckoutPopup, computeAutoVideoLayout]);

    useGameConnection({
        socket,
        roomId,
        handleGameState,
        showCheckoutPopup,
        setIsStartingGame,
        startGameTimeoutRef,
        setIsSpectator,
        setPendingLegWinner,
        setLegWinnerData,
        setShowLegWinnerPopup,
        pollRef,
        user,
        setUser
    });

    useEffect(() => {
        if (gameState?.gameStatus === 'finished' && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, [gameState?.gameStatus]);

    useEffect(() => {
        if (showWinnerPopup) {
            const timer = setTimeout(() => {
                setShowGameEndButtons(true);
            }, 10000);
            return () => clearTimeout(timer);
        }
        setShowGameEndButtons(false);
    }, [showWinnerPopup]);

    useEffect(() => {
        if (gameState && gameState.players && gameState.players.length >= 2 && !localGameStarted) {
            const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
            const opponentPlayer = gameState.players.find(p => p.id !== gameState.hostId);

            let initialStarterId = null;
            if (gameState.whoStarts === 'opponent' && opponentPlayer) {
                initialStarterId = opponentPlayer.id;
            } else if (gameState.whoStarts === 'me' && hostPlayer) {
                initialStarterId = hostPlayer.id;
            } else if (gameState.whoStarts === 'random') {
                initialStarterId = 'bull-off';
                if (!bullOffModalShown && !bullOffCompleted && gameState.players.length >= 2) {
                    setShowBullOffModal(true);
                    setBullOffModalShown(true);
                }
            } else {
                initialStarterId = hostPlayer?.id;
            }

            if (initialStarterId) {
                setStartingPlayerId(initialStarterId);
            }
        }
    }, [gameState?.whoStarts, gameState?.players, localGameStarted, gameState, bullOffModalShown, bullOffCompleted]);

    const flow = useGameFlow({
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
    });

    const setManualVideoLayout = useCallback((layout) => {
        if (!layout?.mode) {
            return;
        }
        setVideoLayout({
            mode: layout.mode,
            currentPlayerId: layout.currentPlayerId ?? null,
            manual: true
        });
    }, []);

    const resetVideoLayout = useCallback(() => {
        const fallbackIndex = gameState?.currentPlayerIndex ?? gameState?.gameState?.currentPlayerIndex ?? 0;
        const desiredLayout = computeAutoVideoLayout({
            ...gameState,
            currentPlayerIndex: fallbackIndex
        });
        setVideoLayout({
            ...desiredLayout,
            manual: false
        });
    }, [computeAutoVideoLayout, gameState]);

    const handleBullOffCancel = useCallback(() => {
        setShowBullOffModal(false);
        setBullOffModalShown(false);
        setBullOffCompleted(false);
        setLocalGameStarted(false);
        setIsStartingGame(false);
        if (startGameTimeoutRef.current) {
            clearTimeout(startGameTimeoutRef.current);
            startGameTimeoutRef.current = null;
        }
    }, [setShowBullOffModal, setBullOffModalShown, setBullOffCompleted, setLocalGameStarted, setIsStartingGame, startGameTimeoutRef]);

    const contextValue = {
        roomId,
        socket,
        user,
        gameState,
        isSpectator,
        localGameStarted,
        turnEndTime,
        isStartingGame,
        startingPlayerId,
        showBullOffModal,
        setShowBullOffModal,
        setBullOffModalShown,
        setBullOffCompleted,
        bullOffModalShown,
        bullOffCompleted,
        showWinnerPopup,
        showLegWinnerPopup,
        legWinnerData,
        showGameEndButtons,
        doubleAttemptsQuery,
        doubleAttemptsResponsePending,
        showCheckoutPopup,
        checkoutPlayer,
        pendingLegWinner,
        showDebug,
        setShowDebug,
        debugLogs,
        videoLayout,
        setManualVideoLayout,
        resetVideoLayout,
        numpadState,
        devices,
        selectedDeviceId,
        isCameraEnabled,
        startCamera,
        stopCamera,
        autoConnectToOpponents,
        localVideoRef,
        localStream,
        remoteStreams,
        isRecording,
        startRecording,
        stopRecording,
        setStartingPlayerId,
        setShowWinnerPopup,
        setShowLegWinnerPopup,
        setLegWinnerData,
        setShowGameEndButtons,
        setDoubleAttemptsQuery,
        setDoubleAttemptsResponsePending,
        setShowCheckoutPopup,
        setCheckoutPlayer,
        setPendingLegWinner,
        setDebugLogs,
        handleDeviceChange: flow.handleDeviceChange,
        handleScoreInput: flow.handleScoreInput,
        handleUndo: flow.handleUndo,
        handleStartGame: flow.handleStartGame,
        handleRematch: flow.handleRematch,
        handleExit: flow.handleExit,
        handleBullOffComplete: flow.handleBullOffComplete,
        handleBullOffCancel,
        handleDoubleAttemptsResponse: flow.handleDoubleAttemptsResponse,
        handleCheckoutSelect: flow.handleCheckoutSelect,
        handleClearLogs: flow.handleClearLogs,
        handleRefreshState: flow.handleRefreshState
    };

    return (
        <GameContext.Provider value={contextValue}>
            {children}
        </GameContext.Provider>
    );
};

export const useGameContext = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGameContext must be used within a GameProvider');
    }
    return context;
};
