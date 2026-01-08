import CricketView from './CricketView';
import StandardView from './StandardView';
import GameDebugPanel from './GameDebugPanel';
import GameEndPopup from '../GameEndPopup';
import LegWinnerPopup from '../LegWinnerPopup';
import BullOffModal from '../BullOffModal';
import DoubleAttemptsPopup from '../DoubleAttemptsPopup';
import CheckoutPopup from '../CheckoutPopup';
import { useGameContext } from '../../contexts/GameContext';

const GameLayout = () => {
    const {
        roomId,
        socket,
        user,
        gameState,
        isSpectator,
        localGameStarted,
        turnEndTime,
        isStartingGame,
        showBullOffModal,
        showWinnerPopup,
        showLegWinnerPopup,
        legWinnerData,
        showGameEndButtons,
        doubleAttemptsQuery,
        showCheckoutPopup,
        checkoutPlayer,
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
        handleDeviceChange,
        handleScoreInput,
        handleUndo,
        handleStartGame,
        handleRematch,
        handleExit,
        handleBullOffComplete,
        handleBullOffCancel,
        handleDoubleAttemptsResponse,
        handleCheckoutSelect,
        handleClearLogs,
        handleRefreshState,
        bullOffModalShown,
        bullOffCompleted,
        setShowLegWinnerPopup
    } = useGameContext();

    if (!gameState || !gameState.players) {
        return (
            <div className="game-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', flexDirection: 'column' }}>
                <h2>Lade Spiel...</h2>
                <div style={{ marginTop: '20px' }}>
                    {!socket ? 'Verbinde mit Server...' : !socket.connected ? 'Verbinde mit Server...' : 'Hole Spieldaten...'}
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                    Socket: {socket ? (socket.connected ? 'Verbunden' : 'Nicht verbunden') : 'Nicht verfügbar'}
                </div>
                <div style={{ marginTop: '5px', fontSize: '12px', color: '#888' }}>
                    Raum-ID: {roomId}
                </div>
            </div>
        );
    }

    const startingScore = gameState?.gameOptions?.startingScore || 501;
    const pointsScored = gameState.players.some(p => p.score < startingScore);
    const isGameRunning = localGameStarted || gameState.gameStatus === 'active' || pointsScored;
    const currentIndex = gameState.gameState?.currentPlayerIndex || 0;
    const currentPlayer = gameState.players[currentIndex];
    const isHost = gameState.hostId === user.id || (gameState.players[0] && gameState.players[0].id === user.id);
    let starterIdFromState = gameState.activePlayer;

    if (!starterIdFromState) {
        if (gameState.whoStarts === 'me') {
            starterIdFromState = gameState.hostId;
        } else if (gameState.whoStarts === 'opponent') {
            const opponent = gameState.players?.find(p => p.id !== gameState.hostId);
            starterIdFromState = opponent?.id || 'waiting_for_opponent';
        } else {
            starterIdFromState = gameState.hostId;
        }
    }

    const isAuthorizedStarter = (starterIdFromState === 'bull-off' && gameState.whoStarts === 'random')
        ? (gameState.players.length >= 2 && !isSpectator)
        : (user.id === starterIdFromState);

    const isGameFinished = gameState.gameStatus === 'finished';
    const winner = gameState?.winner;
    const canInput = !numpadState.isLocked;
    const showCountdown = false;
    const countdown = 0;

    const renderGameView = gameState.mode === 'cricket'
        ? (
            <CricketView
                gameState={gameState}
                user={user}
                isGameRunning={isGameRunning}
                isGameFinished={isGameFinished}
                isAuthorizedStarter={isAuthorizedStarter}
                handleStartGame={handleStartGame}
                isStartingGame={isStartingGame}
                currentPlayer={currentPlayer}
                numpadState={numpadState}
                handleScoreInput={handleScoreInput}
                handleUndo={handleUndo}
                handleRematch={handleRematch}
                handleExit={handleExit}
                showGameEndButtons={showGameEndButtons}
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onDeviceChange={handleDeviceChange}
                isCameraEnabled={isCameraEnabled}
                startCamera={startCamera}
                stopCamera={stopCamera}
                autoConnectToOpponents={autoConnectToOpponents}
                videoLayout={videoLayout}
                localVideoRef={localVideoRef}
                localStream={localStream}
                remoteStreams={remoteStreams}
                socket={socket}
                roomId={roomId}
                dartsThrownInTurn={gameState.dartsThrownInTurn || 0}
                isRecording={isRecording}
                startRecording={startRecording}
                stopRecording={stopRecording}
                setManualVideoLayout={setManualVideoLayout}
                resetVideoLayout={resetVideoLayout}
            />
        ) : (
            <StandardView
                gameState={gameState}
                user={user}
                currentPlayer={currentPlayer}
                isGameRunning={isGameRunning}
                isGameFinished={isGameFinished}
                isAuthorizedStarter={isAuthorizedStarter}
                handleStartGame={handleStartGame}
                isStartingGame={isStartingGame}
                numpadState={numpadState}
                handleScoreInput={handleScoreInput}
                handleUndo={handleUndo}
                canInput={canInput}
                showCountdown={showCountdown}
                countdown={countdown}
                isSpectator={isSpectator}
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onDeviceChange={handleDeviceChange}
                isCameraEnabled={isCameraEnabled}
                startCamera={startCamera}
                stopCamera={stopCamera}
                autoConnectToOpponents={autoConnectToOpponents}
                videoLayout={videoLayout}
                localVideoRef={localVideoRef}
                localStream={localStream}
                remoteStreams={remoteStreams}
                isRecording={isRecording}
                startRecording={startRecording}
                stopRecording={stopRecording}
                socket={socket}
                roomId={roomId}
                setManualVideoLayout={setManualVideoLayout}
                resetVideoLayout={resetVideoLayout}
            />
        );

    return (
        <div className="game-container">
            {isSpectator && <div className="spectator-banner">Zuschauer</div>}
            <button
                onClick={() => setShowDebug(!showDebug)}
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 9999,
                    padding: '5px 10px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                }}
            >
                {showDebug ? '🐛 Debug aus' : '🐛 Debug an'}
            </button>
            {showDebug && (
                <div style={{
                    position: 'fixed',
                    top: '50px',
                    right: '10px',
                    width: '400px',
                    maxHeight: '80vh',
                    zIndex: 9998,
                    overflowY: 'auto'
                }}>
                    <GameDebugPanel
                        socket={socket}
                        roomId={roomId}
                        gameState={gameState}
                        user={user}
                        isHost={isHost}
                        isSpectator={isSpectator}
                        currentPlayer={currentPlayer}
                        isGameRunning={isGameRunning}
                        isGameFinished={isGameFinished}
                        isStartingGame={isStartingGame}
                        localGameStarted={localGameStarted}
                        showBullOffModal={showBullOffModal}
                        bullOffModalShown={bullOffModalShown}
                        bullOffCompleted={bullOffCompleted}
                        numpadState={numpadState}
                        turnEndTime={turnEndTime}
                        isCameraEnabled={isCameraEnabled}
                        localStream={localStream}
                        remoteStreams={remoteStreams}
                        videoLayout={videoLayout}
                        debugLogs={debugLogs}
                        onClearLogs={handleClearLogs}
                        onRefreshState={handleRefreshState}
                    />
                </div>
            )}
            {renderGameView}
            {showWinnerPopup && (
                <GameEndPopup winner={winner} onRematch={handleRematch} onExit={handleExit} />
            )}
            {showLegWinnerPopup && legWinnerData && (
                <LegWinnerPopup
                    legWinner={legWinnerData.winner}
                    nextPlayerName={legWinnerData.nextPlayer?.name || 'Spieler'}
                    isGameEnded={gameState?.gameStatus === 'finished'}
                    onContinue={() => setShowLegWinnerPopup(false)}
                />
            )}
            {showBullOffModal && (
                <BullOffModal
                    isOpen={showBullOffModal}
                    onClose={handleBullOffCancel}
                    players={gameState.players}
                    onBullOffComplete={handleBullOffComplete}
                    socket={socket}
                    roomId={roomId}
                    user={user}
                />
            )}
            {doubleAttemptsQuery && doubleAttemptsQuery.playerId === user.id && (
                <DoubleAttemptsPopup
                    query={doubleAttemptsQuery}
                    onSelect={handleDoubleAttemptsResponse}
                />
            )}
            <CheckoutPopup
                isActive={showCheckoutPopup}
                onSelect={handleCheckoutSelect}
                user={user}
                checkoutPlayer={checkoutPlayer}
            />
        </div>
    );
};

export default GameLayout;
