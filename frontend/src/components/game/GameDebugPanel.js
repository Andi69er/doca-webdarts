import React from 'react';

const GameDebugPanel = ({
    socket,
    roomId,
    gameState,
    user,
    isHost,
    isSpectator,
    currentPlayer,
    isGameRunning,
    isGameFinished,
    isStartingGame,
    localGameStarted,
    showBullOffModal,
    bullOffModalShown,
    bullOffCompleted,
    numpadState,
    turnEndTime,
    isCameraEnabled,
    localStream,
    remoteStreams,
    videoLayout,
    debugLogs,
    onClearLogs,
    onRefreshState
}) => {
    const lockTimeLeft = (() => {
        const now = Date.now();
        const timeLeft = turnEndTime ? Math.max(0, Math.ceil((turnEndTime - now) / 1000)) : 0;
        return timeLeft > 0 ? `✅ Ja (${timeLeft}s verbleibend)` : '❌ Nein';
    })();

    return (
        <div style={{
            backgroundColor: '#0d0d16',
            padding: '20px',
            borderBottom: '1px solid #222',
            color: '#ccc'
        }}>
            <h3 style={{ marginTop: 0, color: '#ffd700' }}>🐛 Debug Information</h3>
            <div style={{ marginBottom: '15px' }}>
                <strong>Socket Status:</strong><br />
                Connected: {socket?.connected ? '✅ Ja' : '❌ Nein'}<br />
                ID: {socket?.id || 'N/A'}<br />
                Room: {roomId}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>Game State:</strong><br />
                Status: {gameState?.gameStatus ?? 'N/A'}<br />
                Mode: {gameState?.mode ?? 'N/A'}<br />
                Players: {gameState?.players?.length ?? 0}<br />
                Current Player Index: {gameState?.currentPlayerIndex ?? 'N/A'}<br />
                Host ID: {gameState?.hostId ?? 'N/A'}<br />
                Who Starts: {gameState?.whoStarts ?? 'N/A'}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>User Info:</strong><br />
                User ID: {user?.id || 'N/A'}<br />
                User Name: {user?.name || 'N/A'}<br />
                Is Host: {isHost ? '✅ Ja' : '❌ Nein'}<br />
                Is Spectator: {isSpectator ? '✅ Ja' : '❌ Nein'}<br />
                Is My Turn: {currentPlayer?.id === user.id ? '✅ Ja' : '❌ Nein'}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>UI State:</strong><br />
                Is Game Running: {isGameRunning ? '✅ Ja' : '❌ Nein'}<br />
                Is Game Finished: {isGameFinished ? '✅ Ja' : '❌ Nein'}<br />
                Is Starting Game: {isStartingGame ? '✅ Ja' : '❌ Nein'}<br />
                Local Game Started: {localGameStarted ? '✅ Ja' : '❌ Nein'}<br />
                Show BullOff Modal: {showBullOffModal ? '✅ Ja' : '❌ Nein'}<br />
                BullOff Modal Shown: {bullOffModalShown ? '✅ Ja' : '❌ Nein'}<br />
                BullOff Completed: {bullOffCompleted ? '✅ Ja' : '❌ Nein'}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>NumberPad State:</strong><br />
                Is Locked: {numpadState.isLocked ? '✅ Ja' : '❌ Nein'}<br />
                Can Undo: {numpadState.canUndo ? '✅ Ja' : '❌ Nein'}<br />
                Locked Player ID: {numpadState.lockedPlayerId || 'N/A'}<br />
                Lock Timer: {numpadState.lockTimer ? 'Aktiv' : 'Inaktiv'}<br />
                5s Lock Active: {lockTimeLeft}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>Video State:</strong><br />
                Camera Enabled: {isCameraEnabled ? '✅ Ja' : '❌ Nein'}<br />
                Local Stream: {localStream ? '✅ Ja' : '❌ Nein'}<br />
                Remote Streams: {Object.keys(remoteStreams).length}<br />
                Video Layout: {videoLayout?.mode || 'N/A'}<br />
                Current Player ID: {videoLayout?.currentPlayerId || 'N/A'}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>Remote Stream Details:</strong>
                {Object.keys(remoteStreams).length === 0 ? (
                    <div style={{ marginLeft: '10px' }}>Keine Streams</div>
                ) : (
                    Object.entries(remoteStreams).map(([streamId, stream]) => (
                        <div key={streamId} style={{ marginLeft: '10px', marginBottom: '5px' }}>
                            {streamId}: {stream ? `${stream.getTracks().length} Tracks` : 'Kein Stream'}
                            {stream && stream.getTracks().map((track) => (
                                <div key={track.id} style={{ marginLeft: '10px' }}>
                                    {track.kind} ({track.readyState})
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>Players:</strong>
                {(gameState?.players || []).map((player, index) => (
                    <div key={player.id} style={{ marginLeft: '10px', marginBottom: '5px' }}>
                        {index}: {player.name} (ID: {player.id}) - Score: {player.score || player.points || 'N/A'}
                        {player.id === user?.id ? ' ← DU' : ''}
                        {player.id === gameState?.hostId ? ' ← HOST' : ''}
                    </div>
                ))}
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>Debug Logs:</strong>
                <div style={{ maxHeight: '100px', overflowY: 'auto', backgroundColor: '#111', padding: '5px', borderRadius: '4px' }}>
                    {debugLogs.length > 0 ? debugLogs.map((log, index) => (
                        <div key={index} style={{ marginBottom: '2px' }}>{log}</div>
                    )) : 'Keine Logs'}
                </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
                <strong>Actions:</strong><br />
                <button onClick={onClearLogs} style={{ marginRight: '5px', padding: '2px 5px', fontSize: '11px' }}>Clear Logs</button>
                <button onClick={onRefreshState} style={{ padding: '2px 5px', fontSize: '11px' }}>Refresh State</button>
            </div>
        </div>
    );
};

export default GameDebugPanel;
