import React, { useMemo } from 'react';

const sectionStyle = {
    marginBottom: '12px',
    padding: '8px 10px',
    backgroundColor: '#151515',
    borderRadius: '6px',
    border: '1px solid #2c2c2c'
};

const labelStyle = {
    display: 'block',
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '4px'
};

const valueStyle = {
    fontSize: '13px',
    color: '#fff'
};

const VideoDebugPanel = ({
    isOpen,
    onClose,
    localStream,
    remoteStreams,
    videoLayout,
    devices,
    selectedDeviceId,
    isRecording,
    isCameraEnabled
}) => {
    const remoteEntries = useMemo(() => Object.entries(remoteStreams || {}), [remoteStreams]);
    const localTracks = useMemo(() => (localStream ? localStream.getTracks() : []), [localStream]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="video-debug-panel">
            <div className="video-debug-header">
                <strong>Video Debug</strong>
                <button type="button" onClick={onClose}>Schließen</button>
            </div>

            <div style={sectionStyle}>
                <span style={labelStyle}>Layout</span>
                <div style={valueStyle}>Modus: {videoLayout?.mode || 'unbekannt'}</div>
                <div style={valueStyle}>Manual: {videoLayout?.manual ? 'Ja' : 'Nein'}</div>
                <div style={valueStyle}>Fokus: {videoLayout?.currentPlayerId || 'keiner'}</div>
            </div>

            <div style={sectionStyle}>
                <span style={labelStyle}>Lokaler Stream</span>
                <div style={valueStyle}>{localStream ? `${localTracks.length} Tracks` : 'Kein Stream'}</div>
                {localTracks.map((track) => (
                    <div key={track.id} style={valueStyle}>
                        {track.kind} – {track.readyState}
                    </div>
                ))}
            </div>

            <div style={sectionStyle}>
                <span style={labelStyle}>Remote Streams</span>
                {remoteEntries.length === 0 && <div style={valueStyle}>Keine Einträge</div>}
                {remoteEntries.map(([playerId, stream]) => (
                    <div key={playerId} style={{ marginBottom: '6px' }}>
                        <div style={{ ...valueStyle, fontWeight: 'bold' }}>{playerId}</div>
                        {stream ? stream.getTracks().map(track => (
                            <div key={track.id} style={valueStyle}>
                                {track.kind} – {track.readyState}
                            </div>
                        )) : <div style={valueStyle}>Kein Stream</div>}
                    </div>
                ))}
            </div>

            <div style={sectionStyle}>
                <span style={labelStyle}>Geräte</span>
                <div style={valueStyle}>Aktive Kamera: {selectedDeviceId || 'n/a'}</div>
                <div style={{ ...valueStyle, marginTop: '4px' }}>Gefundene Kameras:</div>
                <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                    {(devices || []).map(device => (
                        <li key={device.deviceId} style={{ color: '#ddd', fontSize: '12px' }}>
                            {device.label || 'Unbekannte Kamera'} ({device.deviceId})
                        </li>
                    ))}
                </ul>
            </div>

            <div style={sectionStyle}>
                <span style={labelStyle}>Status</span>
                <div style={valueStyle}>Kamera aktiv: {isCameraEnabled ? 'Ja' : 'Nein'}</div>
                <div style={valueStyle}>Aufnahme: {isRecording ? 'läuft' : 'aus'}</div>
            </div>
        </div>
    );
};

export default VideoDebugPanel;
