import React, { useState, useEffect, useRef } from 'react';

function CameraArea({ gameState, user, roomId, socket }) {
  console.log('🎥 CameraArea loaded for user:', user?.id, 'Room:', roomId);

  const [localStream, setLocalStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  // WebRTC state
  const [peerConnections, setPeerConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState({});
  const [autoplayBlocked, setAutoplayBlocked] = useState({});

  const localVideoRef = useRef(null);

  // Track connection status
  // const [isConnected, setIsConnected] = useState(true);

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

    // Both players will try to initiate - WebRTC handles the collision
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

  // Initiate WebRTC connections when players change (separate from localStream setup)
  useEffect(() => {
    if (localStream && gameState.players && gameState.players.length > 1) {
      console.log('Players list changed, checking for missing WebRTC connections');
      gameState.players.forEach(player => {
        if (player.id !== user?.id && !peerConnections[player.id]) {
          console.log('Initiating MISSING connection to:', player.name, '(ID:', player.id, ')');
          startWebRTCConnection(player.id, localStream);
        }
      });
    }
  }, [localStream, gameState.players]); // This should trigger when players array changes

  // Also try to connect when local stream becomes available
  useEffect(() => {
    console.log('🔄 DEPENDENCY CHECK: localStream:', !!localStream, 'players:', gameState.players?.length, 'user.id:', user?.id);
    if (localStream && gameState.players && gameState.players.length > 1) {
      console.log('✅ Local stream became available, initiating connections to other players');
      gameState.players.forEach(player => {
        console.log('🧐 Checking player:', player.name, '(ID:', player.id, ') vs user:', user?.id);
        if (player.id !== user?.id && !peerConnections[player.id]) {
          console.log('🎯 INITIATING connection to:', player.name);
          startWebRTCConnection(player.id, localStream);
        }
      });
    }
  }, [localStream, gameState.players, user?.id]);

  // Check if user is in current room
  const userInRoom = gameState.players?.find(p => p.id === user?.id);

  // Check if game has started
  const gameStarted = gameState.gameState && gameState.gameState.currentPlayerIndex !== undefined;

  // WebRTC socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleCameraOffer = (data) => {
      if (data.to !== user.id) return;

      console.log('Received offer from', data.from, 'current user:', user.id);

      // CRITICAL: Only accept WebRTC offers if we have a local stream ready!
      if (!localStream) {
        console.warn('❌ REJECTING WebRTC offer - no local stream available yet!');
        console.warn('Waiting for local camera to be enabled before accepting offers...');
        return; // Don't create peer connection without local stream
      }

      // If we already have a stable connection, ignore this offer
      const existingPc = peerConnections[data.from];
      if (existingPc && (existingPc.connectionState === 'connected' || existingPc.connectionState === 'completed' || existingPc.connectionState === 'stable')) {
        console.log('Ignoring offer from', data.from, '- connection already stable');
        return;
      }

      console.log('✅ ACCEPTING WebRTC offer - local stream ready!');
      const pc = existingPc || createPeerConnection(data.from);
      console.log('Created/Using peer connection for', data.from);

      // Add local stream tracks BEFORE setting remote description
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      console.log('✅ Added', localStream.getTracks().length, 'tracks to peer connection');

      pc.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => {
          console.log('Set remote description successfully');

          // Process any queued ICE candidates now that remote description is set
          const queuedCandidates = iceCandidatesQueue[data.from] || [];
          if (queuedCandidates.length > 0) {
            console.log(`🚀 Processing ${queuedCandidates.length} queued ICE candidates for ${data.from}`);
            queuedCandidates.forEach(candidate => {
              pc.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(error => console.error('Error adding queued ICE candidate:', error));
            });
            // Clear the queue for this player
            setIceCandidatesQueue(prev => ({
              ...prev,
              [data.from]: []
            }));
          }

          return pc.createAnswer();
        })
        .then(answer => {
          console.log('Created answer successfully');
          return pc.setLocalDescription(answer);
        })
        .then(() => {
          // Now set the peer connection in state
          setPeerConnections(prev => {
            console.log('Setting peer connection for', data.from, 'in state');
            return { ...prev, [data.from]: pc };
          });

          console.log('Sending answer to', data.from);
          socket.emit('camera-answer', {
            roomId,
            from: user.id,
            to: data.from,
            answer: pc.localDescription
          });
        })
        .catch(error => {
          console.error('Error handling offer:', error);
          console.error('Stack:', error.stack);
        });
    };

    const handleCameraAnswer = (data) => {
      if (data.to !== user.id) return;

      const pc = peerConnections[data.from];
      if (pc) {
        // If we already have a stable connection, ignore this answer
        if (pc.connectionState === 'connected' || pc.connectionState === 'completed' || pc.connectionState === 'stable') {
          console.log('Ignoring answer from', data.from, '- connection already stable');
          return;
        }

        pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          .then(() => {
            console.log('Set remote description (answer) successfully');

            // Process any queued ICE candidates now that remote description is set
            const queuedCandidates = iceCandidatesQueue[data.from] || [];
            if (queuedCandidates.length > 0) {
              console.log(`🚀 Processing ${queuedCandidates.length} queued ICE candidates for ${data.from} (after answer)`);
              queuedCandidates.forEach(candidate => {
                pc.addIceCandidate(new RTCIceCandidate(candidate))
                  .catch(error => console.error('Error adding queued ICE candidate after answer:', error));
              });
              // Clear the queue for this player
              setIceCandidatesQueue(prev => ({
                ...prev,
                [data.from]: []
              }));
            }
          })
          .catch(error => console.error('Error setting remote description (answer):', error));
      }
    };

    const handleCameraIce = (data) => {
      if (data.to !== user.id) return;

      const pc = peerConnections[data.from];
      if (pc) {
        // Check if remote description is set, otherwise queue the candidate
        if (pc.remoteDescription) {
          console.log('✅ Adding ICE candidate immediately (remote description set)');
          pc.addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(error => console.error('Error adding ICE candidate:', error));
        } else {
          console.log('⏸️ Queuing ICE candidate (remote description not set yet)');
          setIceCandidatesQueue(prev => ({
            ...prev,
            [data.from]: [...(prev[data.from] || []), data.candidate]
          }));
        }
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
    <div className="right-panel">
      <h4>DARTBOARD CAM</h4>

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
                      <video
                        ref={el => {
                          if (remoteStreams[player.id] && el) {
                            console.log('Setting video srcObject for player', player.name, ':', remoteStreams[player.id]);
                            el.srcObject = remoteStreams[player.id];
                            console.log('Video element srcObject set for', player.name);
                            // Force play to override autoplay restrictions
                            const playPromise = el.play();
                            if (playPromise !== undefined) {
                              playPromise.then(() => {
                                console.log('✅ Remote video started automatically for', player.name);
                                setAutoplayBlocked(prev => ({ ...prev, [player.id]: false }));
                              }).catch(error => {
                                console.warn('🚫 Autoplay blocked for remote video:', player.name, error);
                                setAutoplayBlocked(prev => ({ ...prev, [player.id]: true }));
                              });
                            }
                          }
                        }}
                        autoPlay
                        playsInline
                        muted // Add muted attribute to help autoplay
                        className="video-element"
                        style={{
                          opacity: remoteStreams[player.id] ? 1 : 0,
                          width: remoteStreams[player.id] ? '100%' : '0',
                          height: remoteStreams[player.id] ? '100%' : '0'
                        }}
                        onError={(e) => console.error('Remote video error:', e)}
                        onLoadedData={() => console.log('Remote video loaded for', player.name)}
                        onCanPlay={() => console.log('Remote video can play for', player.name)}
                        onPlay={() => console.log('Remote video started playing for', player.name)}
                        onPause={() => console.log('Remote video paused for', player.name)}
                      />
                    {(autoplayBlocked[player.id] && remoteStreams[player.id]) && (
                      <div className="video-overlay">
                        <button
                          className="play-remote-video-btn"
                          onClick={() => {
                            const videoEl = document.querySelector(`video[style*="opacity: 0"]`);
                            if (videoEl) {
                              videoEl.play()
                                .then(() => {
                                  console.log('✅ Remote video manually started for', player.name);
                                  setAutoplayBlocked(prev => ({ ...prev, [player.id]: false }));
                                })
                                .catch(e => console.error('Manual play failed:', e));
                            }
                          }}
                        >
                          🎥 {player.name} - Video starten
                        </button>
                      </div>
                    )}
                    {!remoteStreams[player.id] && (
                      <div className="video-overlay">
                        <span>Warten auf {player.name} (ID: {player.id})</span>
                        <small>Remote streams: {Object.keys(remoteStreams).join(', ')}</small>
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
                      <video
                        ref={el => {
                          if (remoteStreams[player.id] && el) {
                            el.srcObject = remoteStreams[player.id];
                            // Force play to override autoplay restrictions
                            el.play().catch(e => {
                              console.warn('Autoplay blocked for remote video during game,', player.name, 'user interaction required:', e);
                            });
                          }
                        }}
                        autoPlay
                        playsInline
                        muted // Add muted attribute to help autoplay
                        className="video-element"
                        style={{
                          opacity: remoteStreams[player.id] ? 1 : 0,
                          width: remoteStreams[player.id] ? '100%' : '0',
                          height: remoteStreams[player.id] ? '100%' : '0'
                        }}
                        onError={(e) => console.error('Remote video error during game:', e)}
                        onLoadedData={() => console.log('Remote video loaded during game for', player.name)}
                        onCanPlay={() => console.log('Remote video can play during game for', player.name)}
                        onPlay={() => console.log('Remote video started playing during game for', player.name)}
                        onPause={() => console.log('Remote video paused during game for', player.name)}
                      />
                      {!remoteStreams[player.id] && (
                        <div className="video-overlay">
                          <span>Warten auf {player.name}</span>
                        </div>
                      )}
                    </div>
                  )}
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
