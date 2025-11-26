import React, { useState, useEffect, useRef } from 'react';

function CameraArea({ gameState, user, roomId, socket }) {
  const [localStream, setLocalStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  const localVideoRef = useRef(null);

  // Get available camera devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);

        // Set default device if available
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting devices:', error);
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      getDevices();
    }
  }, [selectedDeviceId]);

  // Start camera
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCameraEnabled(true);
      setShowDeviceSelector(false);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      console.log('Camera started successfully');
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Fehler beim Zugriff auf die Kamera: ' + error.message);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsCameraEnabled(false);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  // Check if user is in current room
  const userInRoom = gameState.players?.find(p => p.id === user?.id);

  return (
    <div className="camera-area">
      <h4>Live Kameras</h4>

      {/* Device selector */}
      {devices.length > 1 && userInRoom && (
        <div className="camera-controls">
          <label>Kamera auswählen:</label>
          {showDeviceSelector ? (
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="camera-select"
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Kamera ${device.deviceId.slice(0, 8)}...`}
                </option>
              ))}
            </select>
          ) : (
            <button onClick={() => setShowDeviceSelector(true)} className="select-camera-btn">
              Kamera auswählen
            </button>
          )}
        </div>
      )}

      <div className="video-container">
        {gameState.players.map((player) => (
          <div key={player.id} className="video-wrapper">
            <div className="video-placeholder">
              {player.id === user?.id ? (
                // Local camera
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="video-element"
                  />
                  {!isCameraEnabled && (
                    <div className="video-overlay">
                      <button onClick={startCamera}>
                        Kamera einschalten
                      </button>
                    </div>
                  )}
                  {isCameraEnabled && (
                    <div className="video-controls">
                      <button onClick={stopCamera} className="stop-camera-btn">
                        Kamerastopp
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // Remote player camera (placeholder for future WebRTC)
                <div className="remote-placeholder">
                  <video
                    autoPlay
                    playsInline
                    className="video-element"
                  />
                  <div className="video-overlay">
                    <span>Warten auf {player.name}'s Kamera</span>
                  </div>
                </div>
              )}
              <div className="video-label">
                {player.name} {player.id === user?.id && isCameraEnabled && '(Du)'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CameraArea;
