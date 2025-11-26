import React, { useState, useEffect, useRef } from 'react';

function CameraArea({ gameState, user, roomId, socket }) {
  console.log('CameraArea render:', { user, roomId, socket, players: gameState.players });

  const [localStream, setLocalStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  // WebRTC state
  const [peerConnections, setPeerConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});

  console.log('CameraArea state:', { localStream, remoteStreams, peerConnections });

  const localVideoRef = useRef(null);

  // WebRTC helper functions
  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate to', targetUserId);
      socket.emit('camera-ice', {
        roomId,
        from: user.id,
        to: targetUserId,
        candidate: event.candidate
      });
    }
  };

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0];
    console.log('Received remote stream from:', targetUserId, remoteStream);
    setRemoteStreams(prev => {
      console.log('Updating remoteStreams with:', { [targetUserId]: remoteStream });
      return {
        ...prev,
        [targetUserId]: remoteStream
      };
    });
  };

  pc.onconnectionstatechange = () => {
    console.log('WebRTC connection state for', targetUserId, ':', pc.connectionState);
  };

  return pc;
  };

  const startWebRTCConnection = (targetUserId, streamToUse) => {
    // Check if connection already exists
    if (peerConnections[targetUserId]) {
      console.log('Connection already exists for', targetUserId);
      return;
    }

    console.log('Initiating WebRTC connection to', targetUserId);

    const pc = createPeerConnection(targetUserId);
    setPeerConnections(prev => ({ ...prev, [targetUserId]: pc }));

    // Add local stream tracks to the connection
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => pc.addTrack(track, streamToUse));
    }

    // Create offer
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        console.log('Sending offer to', targetUserId);
        socket.emit('camera-offer', {
          roomId,
          from: user.id,
          to: targetUserId,
          offer: pc.localDescription
        });
      })
      .catch(error => console.error('Error creating offer:', error));
  };

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

  // Initiate WebRTC connections when localStream is ready or players change
  useEffect(() => {
    if (localStream && gameState.players) {
      console.log('Local stream available or players changed, initiating WebRTC connections');
      gameState.players.forEach(player => {
        if (player.id !== user?.id && !peerConnections[player.id]) {
          console.log('Initiating connection to:', player.name);
          startWebRTCConnection(player.id, localStream);
        }
      });
    }
  }, [localStream, gameState.players]);

  // Check if user is in current room
  const userInRoom = gameState.players?.find(p => p.id === user?.id);

  // Check if game has started
  const gameStarted = gameState.gameState && gameState.gameState.currentPlayerIndex !== undefined;

  // WebRTC socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleCameraOffer = (data) => {
      if (data.to !== user.id) return;

      console.log('Received offer from', data.from);

      const pc = createPeerConnection(data.from);

      // Add local stream tracks BEFORE setting remote description
      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }

      pc.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          // Now set the peer connection in state
          setPeerConnections(prev => ({ ...prev, [data.from]: pc }));

          console.log('Sending answer to', data.from);
          socket.emit('camera-answer', {
            roomId,
            from: user.id,
            to: data.from,
            answer: pc.localDescription
          });
        })
        .catch(error => console.error('Error handling offer:', error));
    };

    const handleCameraAnswer = (data) => {
      if (data.to !== user.id) return;

      const pc = peerConnections[data.from];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          .catch(error => console.error('Error setting remote description:', error));
      }
    };

    const handleCameraIce = (data) => {
      if (data.to !== user.id) return;

      const pc = peerConnections[data.from];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          .catch(error => console.error('Error adding ICE candidate:', error));
      }
    };

    socket.on('camera-offer', handleCameraOffer);
    socket.on('camera-answer', handleCameraAnswer);
    socket.on('camera-ice', handleCameraIce);

    return () => {
      socket.off('camera-offer', handleCameraOffer);
      socket.off('camera-answer', handleCameraAnswer);
      socket.off('camera-ice', handleCameraIce);
    };
  }, [socket, user.id, localStream, peerConnections]);

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

      {!gameStarted ? (
        // PRE-GAME: Vertical splitscreen for all players
        <div className="splitscreen-container">
          {gameState.players.map((player) => (
            <div key={player.id} className="splitscreen-player">
              {player.id === user?.id ? (
                // Local player camera
                <div className="video-placeholder">
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
                  <div className="video-label">
                    {player.name} (Du)
                  </div>
                </div>
                  ) : (
                    // Other players - placeholders or videos
                    <div className="video-placeholder">
                      <div className="remote-placeholder">
                        {remoteStreams[player.id] ? (
                          <video
                            ref={el => {
                              if (el) el.srcObject = remoteStreams[player.id];
                            }}
                            autoPlay
                            playsInline
                            className="video-element"
                          />
                        ) : (
                          <div className="video-overlay">
                            <span>Warten auf {player.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="video-label">{player.name}</div>
                    </div>
                  )}
            </div>
          ))}
        </div>
      ) : (
        // DURING-GAME: Show all players' cameras in splitscreen
        <div className="splitscreen-container">
          {gameState.players.map((player) => {
            const isCurrentPlayer = player.id === gameState.players[gameState.gameState.currentPlayerIndex]?.id;
            return (
              <div key={player.id} className="splitscreen-player">
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
                    // Remote player camera
                    <div className="remote-placeholder">
                      {remoteStreams[player.id] ? (
                        <video
                          ref={el => {
                            if (el) el.srcObject = remoteStreams[player.id];
                          }}
                          autoPlay
                          playsInline
                          className="video-element"
                        />
                      ) : (
                        <div className="video-overlay">
                          <span>Warten auf {player.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="video-label">
                    {player.name} {isCurrentPlayer ? '(wirft)' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CameraArea;
