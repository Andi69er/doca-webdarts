import React, { useCallback, useMemo, useState } from 'react';
import RemoteVideoPlayer from './RemoteVideoPlayer';
import VideoDebugPanel from '../video/VideoDebugPanel';
import '../video/VideoPanel.css';
import useAudioControls from '../../hooks/useAudioControls';
import useVideoLayoutManager from '../../hooks/useVideoLayoutManager';

const getTeamName = (player, fallbackIndex = 0) => {
    if (!player) {
        return fallbackIndex % 2 === 0 ? 'Team A' : 'Team B';
    }
    return player.teamName || player.team || (fallbackIndex % 2 === 0 ? 'Team A' : 'Team B');
};

const buildLabel = (player, fallbackIndex, { isLocal = false, isDoubles = false } = {}) => {
    const baseName = player?.name || (isLocal ? 'Du' : 'Spieler');
    if (!isDoubles) {
        return baseName;
    }
    return `${getTeamName(player, fallbackIndex)} – ${baseName}`;
};

const GameVideoPanel = ({
    devices,
    selectedDeviceId,
    onDeviceChange,
    isCameraEnabled,
    startCamera,
    stopCamera,
    autoConnectToOpponents,
    showConnectButton = true,
    showRecordingButton = true,
    isRecording,
    startRecording,
    stopRecording,
    videoLayout,
    localVideoRef,
    localStream,
    user,
    gameState,
    remoteStreams,
    setManualVideoLayout,
    resetVideoLayout
}) => {
    const [showDebug, setShowDebug] = useState(false);

    const opponents = useMemo(() => (gameState.players || []).filter(p => p.id !== user.id), [gameState.players, user.id]);
    const isDoubles = gameState?.teamMode === 'doubles';

    const participants = useMemo(() => {
        const entries = [];
        entries.push({
            id: 'local',
            playerId: user?.id,
            label: buildLabel(user, 0, { isLocal: true, isDoubles }),
            stream: localStream,
            type: 'local'
        });
        opponents.forEach((player, index) => {
            entries.push({
                id: player.id,
                playerId: player.id,
                label: buildLabel(player, index + 1, { isDoubles }),
                stream: remoteStreams[player.id],
                type: 'remote',
                name: player.name
            });
        });
        return entries;
    }, [isDoubles, opponents, remoteStreams, user, localStream]);

    const { mutedState, toggleMute } = useAudioControls({ participants });

    const {
        gridClass,
        tileClassName,
        pinParticipant,
        pinnedId,
        showSplitscreen,
        resetVideoLayout: layoutReset
    } = useVideoLayoutManager({
        videoLayout,
        participants,
        gameState,
        userId: user?.id,
        setManualVideoLayout,
        resetVideoLayout
    });

    const handlePin = useCallback((targetId) => {
        pinParticipant(targetId);
    }, [pinParticipant]);

    const handleMuteToggle = useCallback((targetId) => {
        toggleMute(targetId);
    }, [toggleMute]);

    const handleCameraToggle = () => {
        if (isCameraEnabled) {
            stopCamera();
        } else {
            startCamera(selectedDeviceId);
        }
    };

    return (
        <div className="video-shell" style={{ position: 'relative' }}>
            <div className="video-control-bar">
                <select value={selectedDeviceId} onChange={(e) => onDeviceChange(e.target.value)}>
                    {devices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || 'Kamera'}</option>
                    ))}
                </select>
                <button type="button" onClick={handleCameraToggle} className="primary">
                    {isCameraEnabled ? '📹 Stop' : '📹 Start'}
                </button>
                {showConnectButton && (
                    <button type="button" onClick={() => autoConnectToOpponents({ force: true })}>🔌 Verbinden</button>
                )}
                {showRecordingButton && (
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        style={{ backgroundColor: isRecording ? '#d9534f' : '#5cb85c', borderColor: isRecording ? '#d9534f' : '#5cb85c' }}
                    >
                        {isRecording ? '● Aufnahme stoppen' : '○ Aufnahme starten'}
                    </button>
                )}
                <button type="button" onClick={showSplitscreen}>
                    👥 Splitscreen
                </button>
                <button type="button" onClick={layoutReset}>↻ Auto-Fokus</button>
                <button type="button" onClick={() => setShowDebug(prev => !prev)}>
                    {showDebug ? '🐛 Debug aus' : '🐛 Debug an'}
                </button>
                <span style={{ color: '#ccc', fontSize: '12px' }}>
                    {isCameraEnabled ? 'Kamera aktiv' : 'Kamera gestoppt'}
                </span>
            </div>

            <div className={`video-grid ${gridClass}`}>
                {participants.map((participant) => {
                    if (participant.type === 'local') {
                        return (
                            <div key={participant.id} className={tileClassName('local')}>
                                <div className="video-label">
                                    <span>{participant.label}</span>
                                    <button type="button" className="video-pin" onClick={() => handlePin('local')}>
                                        {pinnedId === 'local' ? '📌' : '📍'}
                                    </button>
                                </div>
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' }}
                                />
                            </div>
                        );
                    }

                    const muted = mutedState[participant.id] ?? true;
                    return (
                        <div key={participant.id} className={tileClassName(participant.id)}>
                            <RemoteVideoPlayer
                                stream={participant.stream}
                                name={participant.name}
                                label={participant.label}
                                playerId={participant.playerId}
                                muted={muted}
                                onToggleMute={() => handleMuteToggle(participant.id)}
                                onPin={() => handlePin(participant.id)}
                                isPinned={pinnedId === participant.id}
                            />
                        </div>
                    );
                })}
            </div>

            <VideoDebugPanel
                isOpen={showDebug}
                onClose={() => setShowDebug(false)}
                localStream={localStream}
                remoteStreams={remoteStreams}
                videoLayout={videoLayout}
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                isRecording={isRecording}
                isCameraEnabled={isCameraEnabled}
            />
        </div>
    );
};

export default GameVideoPanel;
