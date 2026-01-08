import { useState, useEffect } from 'react';

const useGameConnection = ({
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
}) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!socket) {
            return;
        }

        const onConnect = () => {
            setUser(prev => ({ ...prev, id: socket.id }));
            setIsLoading(false);
        };

        const onConnectError = () => {
            setIsLoading(false);
        };

        socket.on('connect', onConnect);
        socket.on('connect_error', onConnectError);

        if (socket.connected) {
            onConnect();
        } else if (socket.disconnected && isLoading) {
            setIsLoading(true);
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onConnectError);
        };
    }, [socket, isLoading, setUser]);

    useEffect(() => {
        if (!socket || !socket.connected) {
            return;
        }

        const handleGameError = (error) => {
            alert('Spiel-Fehler: ' + error.error);
            setIsStartingGame(false);
            if (startGameTimeoutRef.current) {
                clearTimeout(startGameTimeoutRef.current);
                startGameTimeoutRef.current = null;
            }
        };

        const handleSpectator = () => {
            setIsSpectator(true);
        };

        const handleKicked = (data) => {
            alert(data.message || 'Du wurdest aus dem Raum entfernt.');
            window.location.href = '/';
        };

        const handleLegWon = (data) => {
            const payload = {
                winner: data.legWinnerPlayer,
                nextPlayer: data.nextPlayer
            };

            if (showCheckoutPopup) {
                setPendingLegWinner(payload);
            } else {
                setLegWinnerData(payload);
                setShowLegWinnerPopup(true);
                setTimeout(() => {
                    setShowLegWinnerPopup(false);
                }, 3000);
            }
        };

        socket.on('game-state-update', handleGameState);
        socket.on('game-started', handleGameState);
        socket.on('gameState', handleGameState);
        socket.on('statusUpdate', handleGameState);
        socket.on('gameError', handleGameError);
        socket.on('joinedAsSpectator', handleSpectator);
        socket.on('youHaveBeenKicked', handleKicked);
        socket.on('leg-won', handleLegWon);

        socket.emit('joinRoom', { roomId });
        socket.emit('getGameState', roomId);

        pollRef.current = setInterval(() => {
            socket.emit('getGameState', roomId);
        }, 2500);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            socket.off('game-state-update', handleGameState);
            socket.off('game-started', handleGameState);
            socket.off('gameState', handleGameState);
            socket.off('statusUpdate', handleGameState);
            socket.off('gameError', handleGameError);
            socket.off('joinedAsSpectator', handleSpectator);
            socket.off('youHaveBeenKicked', handleKicked);
            socket.off('leg-won', handleLegWon);
        };
    }, [socket, roomId, handleGameState, showCheckoutPopup, setIsStartingGame, startGameTimeoutRef, setIsSpectator, setPendingLegWinner, setLegWinnerData, setShowLegWinnerPopup, pollRef]);

    return { isLoading };
};

export default useGameConnection;
