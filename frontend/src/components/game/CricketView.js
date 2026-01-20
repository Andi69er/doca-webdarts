import React from 'react';
import CricketHeader from '../CricketHeader';
import CricketBoard from '../CricketBoard';
import CricketInputPanel from '../CricketInputPanel';
import GameChat from '../GameChat';
import GameInfoBar from './GameInfoBar';
import GameVideoPanel from './GameVideoPanel';

const CricketView = ({
    gameState,
    user,
    isGameRunning,
    isGameFinished,
    isAuthorizedStarter,
    handleStartGame,
    isStartingGame,
    currentPlayer,
    numpadState,
    handleScoreInput,
    handleUndo,
    handleRematch,
    handleExit,
    showGameEndButtons,
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
    socket,
    roomId,
    dartsThrownInTurn,
    isRecording,
    startRecording,
    stopRecording,
    setManualVideoLayout,
    resetVideoLayout,
    isHost
}) => {
    return (
        <div className="game-container">
            <div className="game-layout">
                <div className="game-main-area">
                    <div style={{ padding: '10px 20px', backgroundColor: '#111', borderBottom: '1px solid #222' }}>
                        <CricketHeader gameState={gameState} user={user} />
                    </div>
                    <GameInfoBar gameState={gameState} />
                    {isGameRunning && (
                        <div className={`game-status-bar ${currentPlayer?.id === user.id ? 'my-turn' : 'opponent-turn'}`}>
                            {currentPlayer?.id === user.id ? 'DU BIST DRAN' : `${currentPlayer?.name} IST DRAN`}
                        </div>
                    )}
                    {!isGameRunning && !isGameFinished && (
                        <div className="ready-box" style={{ backgroundColor: '#111' }}>
                            {gameState.players.length < 2 ? (
                                <h3 style={{ color: '#888' }}>Warte auf Gegner...</h3>
                            ) : (
                                isAuthorizedStarter ? (
                                    <button onClick={handleStartGame} disabled={isStartingGame} className="start-game-button">SPIEL STARTEN 🎯</button>
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
                                    isHost={isHost}
                                />
                            )}
                        </div>
                    )}
                    <div style={{ flex: 1, display: 'flex', padding: '15px', gap: '15px', overflowY: 'auto', minHeight: 0, backgroundColor: '#0f0f1a', position: 'relative' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <CricketInputPanel
                                onScoreInput={handleScoreInput}
                                isActive={currentPlayer?.id === user.id && !numpadState.isLocked}
                                isLocked={!(currentPlayer?.id === user.id) || numpadState.isLocked}
                                canUseUndo={numpadState.canUndo}
                                onUndo={handleUndo}
                                dartsThrownInTurn={dartsThrownInTurn || 0}
                            />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, position: 'relative' }}>
                            <CricketBoard gameState={gameState} user={user} />
                            {showGameEndButtons && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '20px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    display: 'flex',
                                    gap: '15px',
                                    zIndex: 100
                                }}>
                                    <button
                                        onClick={handleRematch}
                                        style={{
                                            padding: '12px 25px',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            color: 'white',
                                            backgroundColor: '#ff6b6b',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => e.target.style.backgroundColor = '#ff5252'}
                                        onMouseLeave={e => e.target.style.backgroundColor = '#ff6b6b'}
                                    >
                                        🔄 Revanche
                                    </button>
                                    <button
                                        onClick={handleExit}
                                        style={{
                                            padding: '12px 25px',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            color: 'white',
                                            backgroundColor: '#4CAF50',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => e.target.style.backgroundColor = '#45a049'}
                                        onMouseLeave={e => e.target.style.backgroundColor = '#4CAF50'}
                                    >
                                        🏠 Zur Lobby
                                    </button>
                                </div>
                            )}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <GameChat socket={socket} roomId={roomId} user={user} messages={gameState.chatMessages || []} />
                        </div>
                    </div>
                </div>
                <div className="camera-column">
                    <GameVideoPanel
                        devices={devices}
                        selectedDeviceId={selectedDeviceId}
                        onDeviceChange={onDeviceChange}
                        isCameraEnabled={isCameraEnabled}
                        startCamera={startCamera}
                        stopCamera={stopCamera}
                        autoConnectToOpponents={autoConnectToOpponents}
                        videoLayout={videoLayout}
                        localVideoRef={localVideoRef}
                        localStream={localStream}
                        user={user}
                        gameState={gameState}
                        remoteStreams={remoteStreams}
                        showConnectButton={false}
                        showRecordingButton={false}
                        isRecording={isRecording}
                        startRecording={startRecording}
                        stopRecording={stopRecording}
                        setManualVideoLayout={setManualVideoLayout}
                        resetVideoLayout={resetVideoLayout}
                    />
                </div>
            </div>
        </div>
    );
};

export default CricketView;
