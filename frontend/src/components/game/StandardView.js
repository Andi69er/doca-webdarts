import React from 'react';
import PlayerScores from '../PlayerScores';
import NumberPad from '../NumberPad';
import LiveStatistics from '../LiveStatistics';
import GameChat from '../GameChat';
import GameInfoBar from './GameInfoBar';
import GameVideoPanel from './GameVideoPanel';
import TeamAssignmentPanel from './TeamAssignmentPanel';

const StandardView = ({
    gameState,
    user,
    currentPlayer,
    isGameRunning,
    isGameFinished,
    isAuthorizedStarter,
    handleStartGame,
    isStartingGame,
    numpadState,
    handleScoreInput,
    handleUndo,
    canInput,
    showCountdown,
    countdown,
    isSpectator,
    devices,
    selectedDeviceId,
    onDeviceChange,
    isCameraEnabled,
    startCamera,
    stopCamera,
    autoConnectToOpponents,
    videoLayout,
    localVideoRef,
    localStream,
    remoteStreams,
    isRecording,
    startRecording,
    stopRecording,
    socket,
    roomId,
    setManualVideoLayout,
    resetVideoLayout
}) => (
    <div className="game-layout">
        <div className="game-main-area">
            <PlayerScores gameState={gameState} user={user} />
            <GameInfoBar gameState={gameState} />
            {isGameRunning && (
                <div className={`game-status-bar ${currentPlayer?.id === user.id ? 'my-turn' : 'opponent-turn'}`}>
                    <div className="status-text">{currentPlayer?.id === user.id ? 'DU BIST DRAN' : `${currentPlayer?.name} IST DRAN`}</div>
                </div>
            )}
            {!isGameRunning && !isGameFinished && (
                <div className="ready-box">
                    <div className="ready-status">
                        {gameState.players.length < 2 ? 'Warte auf Gegner...' : 'Bereit zum Start'}
                    </div>
                    {gameState.players.length < 2 ? null : (
                        isAuthorizedStarter ? (
                            <button className="start-game-button" onClick={handleStartGame} disabled={isStartingGame}>
                                SPIEL STARTEN 🎯
                            </button>
                        ) : (
                            <div className="waiting-message">Warte auf Starter...</div>
                        )
                    )}
                    {gameState.teamMode === 'doubles' && (
                        <TeamAssignmentPanel
                            gameState={gameState}
                            user={user}
                            socket={socket}
                            roomId={roomId}
                        />
                    )}
                </div>
            )}
            <div className="game-bottom-section">
                <div className="game-column-left">
                    {!isSpectator && (
                        <div className="wurf-section">
                            <h3 className="wurf-title">{currentPlayer?.id === user.id ? 'DEIN WURF' : `${currentPlayer?.name.toUpperCase()} WIRFT`}</h3>
                            <div className="number-pad-container">
                                <div className="number-pad-wrapper">
                                    {showCountdown && (
                                        <div className="countdown-overlay">
                                            <div className="countdown-text">{countdown}s</div>
                                        </div>
                                    )}
                                    <NumberPad
                                        onScoreInput={handleScoreInput}
                                        onUndo={handleUndo}
                                        checkoutSuggestions={gameState.checkoutSuggestions}
                                        isActive={currentPlayer?.id === user.id && canInput}
                                        isLocked={!(currentPlayer?.id === user.id) || numpadState.isLocked}
                                        isOpponentLocked={!(currentPlayer?.id === user.id)}
                                        isMyTurn={currentPlayer?.id === user.id}
                                        canUseUndo={numpadState.canUndo}
                                        gameRunning={isGameRunning}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="game-column-center">
                    <div className="statistics-section">
                        <LiveStatistics gameState={gameState} />
                    </div>
                </div>
                <div className="game-column-right">
                    <div className="game-chat-container">
                        <GameChat socket={socket} roomId={roomId} user={user} messages={gameState.chatMessages || []} />
                    </div>
                </div>
            </div>
        </div>
        <GameVideoPanel
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            onDeviceChange={onDeviceChange}
            isCameraEnabled={isCameraEnabled}
            startCamera={startCamera}
            stopCamera={stopCamera}
            autoConnectToOpponents={autoConnectToOpponents}
            showConnectButton
            showRecordingButton
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            videoLayout={videoLayout}
            localVideoRef={localVideoRef}
            localStream={localStream}
            user={user}
            gameState={gameState}
            remoteStreams={remoteStreams}
            setManualVideoLayout={setManualVideoLayout}
            resetVideoLayout={resetVideoLayout}
        />
    </div>
);

export default StandardView;
