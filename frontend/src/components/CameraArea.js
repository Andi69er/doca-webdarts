import React, { useState, useEffect, useRef } from 'react';

function CameraArea({ gameState, user, roomId, socket }) {

  const [localStream, setLocalStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);

  // WebRTC state
  const [peerConnections, setPeerConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [iceCandidatesQueue, setIceCandidatesQueue] = useState({});
  // eslint-disable-next-line no-unused-vars
  const [autoplayBlocked, setAutoplayBlocked] = useState({});

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
      console.log('📡 Received remote stream from:', targetUserId, 'Stream tracks:', remoteStream.getTracks().length);
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: remoteStream
      }));
      console.log('🖥️ Updated remoteStreams state');
    };

    return pc;
  };

  const startWebRTCConnection = (targetUserId, streamToUse) => {
    if (peerConnections[targetUserId]) return;

    console.log('Initiating WebRTC connection to', targetUserId);
    const pc = createPeerConnection(targetUserId);
    setPeerConnections(prev => ({ ...prev, [targetUserId]: pc }));

    if (streamToUse) {
      streamToUse.getTracks().forEach(track => pc.addTrack(track, streamToUse));
    }

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit('camera-offer', {
          roomId,
          from: user.id,
          to: targetUserId,
          offer: pc.localDescription
        });
      })
      .catch(error => console.error('Error creating offer:', error));
  };

  // Get available camera devices - only after permission granted
  const refreshDevices = async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        // Only set default device if we have devices and no device is selected yet
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      }
    } catch (error) {
      console.error('Error getting devices:', error);
      // On error, at least show basic camera button
      setDevices([{ deviceId: 'default', label: 'Kamera (Standard)' }]);
    }
  };

  // Initial device check - try once on mount
  useEffect(() => {
    // Initialize with empty device list - will be populated after permission
    refreshDevices();
  }, []);

  // Refresh devices after camera permission granted
  useEffect(() => {
    if (localStream) {
      refreshDevices();
    }
  }, [localStream]);

  // Request permission to populate device list when selector is shown
  const initializeDevicePermissions = async () => {
    try {
      // Request minimal camera permission to populate device list
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // Immediately stop the stream - we just wanted permission
      tempStream.getTracks().forEach(track => track.stop());
      // Now refresh devices with proper labels
      setTimeout(refreshDevices, 100);
    } catch (error) {
      console.error('Could not get device permissions:', error);
      // Fallback: show at least basic camera option
      setDevices([{ deviceId: 'default', label: 'Kamera (Standard)' }]);
    }
  };

  // Keep selected device consistent when device list updates
  useEffect(() => {
    // If device selector is shown but no devices, try to get permissions
    if (showDeviceSelector && devices.length === 0) {
      initializeDevicePermissions();
    }

    // If we have devices but no selection, select first device
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].deviceId);
    }
    // If current selection is not in device list anymore, select first available
    else if (devices.length > 0 && selectedDeviceId && !devices.some(d => d.deviceId === selectedDeviceId)) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId, showDeviceSelector]);

  // Start camera
  const startCamera = async () => {
    // Check if mediaDevices is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Kamera nicht unterstützt in diesem Browser');
      console.error('getUserMedia not supported');
      return;
    }

    try {
      const videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      // If user selected a specific device and it exists in our device list
      if (selectedDeviceId && devices.some(d => d.deviceId === selectedDeviceId)) {
        videoConstraints.deviceId = { exact: selectedDeviceId };
      }

      const constraints = {
        video: videoConstraints,
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained successfully');

      setLocalStream(stream);
      setIsCameraEnabled(true);
      setShowDeviceSelector(false);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('Camera stream assigned to video element');
      }
    } catch (error) {
      console.error('Camera error:', error);

      let errorMessage = 'Kamera-Fehler: ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Zugriff verweigert. Bitte erlaube Kamerazugriff in den Browsereinstellungen.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'Keine Kamera gefunden.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Kamera wird bereits von einer anderen Anwendung verwendet.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Gewählte Kamerakonfiguration nicht verfügbar.';
      } else if (error.name === 'SecurityError') {
        errorMessage += 'Zugriff blockiert. Überprüfe HTTPS oder lokale Entwicklung.';
      } else {
        errorMessage += error.message || 'Unbekannter Fehler';
      }

      alert(errorMessage);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsCameraEnabled(false);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (localStream) localStream.getTracks().forEach(track => track.stop());
    };
  }, [localStream]);

  // Connection triggers
  useEffect(() => {
    if (localStream && gameState.players?.length > 1) {
      gameState.players.forEach(player => {
        if (player.id !== user?.id && !peerConnections[player.id]) {
          startWebRTCConnection(player.id, localStream);
        }
      });
    }
  }, [localStream, gameState.players, user?.id, peerConnections]);

  // WebRTC Socket Listeners
  useEffect(() => {
    if (!socket) return;

    const handleOffer = (data) => {
      console.log('📨 Received camera-offer from:', data.from, 'to:', data.to);
      if (data.to !== user.id || !localStream) {
        console.log('❌ Ignoring camera-offer - wrong recipient or no localStream');
        return;
      }

      const pc = peerConnections[data.from] || createPeerConnection(data.from);
      setPeerConnections(prev => ({ ...prev, [data.from]: pc }));

      // Only add tracks if this PeerConnection doesn't have senders yet
      if (pc.getSenders().length === 0 && localStream) {
        console.log('📺 Adding tracks to PeerConnection for:', data.from);
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }

      pc.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => {
            const queued = iceCandidatesQueue[data.from] || [];
            queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
            setIceCandidatesQueue(prev => ({ ...prev, [data.from]: [] }));
            return pc.createAnswer();
        })
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
            console.log('📤 Sending camera-answer to:', data.from);
            socket.emit('camera-answer', { roomId, from: user.id, to: data.from, answer: pc.localDescription });
        })
        .catch(error => console.error('❌ Error handling camera-offer:', error));
    };

    const handleAnswer = (data) => {
      console.log('📨 Received camera-answer from:', data.from, 'to:', data.to);
      if (data.to !== user.id) return;
      const pc = peerConnections[data.from];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('✅ Applied camera-answer for:', data.from);
      } else {
        console.log('❌ No peerConnection found for camera-answer:', data.from);
      }
    };

    const handleIce = (data) => {
      console.log('📨 Received camera-ice from:', data.from, 'to:', data.to);
      if (data.to !== user.id) return;
      const pc = peerConnections[data.from];
      if (pc?.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('✅ Added ICE candidate for:', data.from);
      } else {
        console.log('⏳ Queuing ICE candidate for:', data.from);
        setIceCandidatesQueue(prev => ({
          ...prev,
          [data.from]: [...(prev[data.from] || []), data.candidate]
        }));
      }
    };

    socket.on('camera-offer', handleOffer);
    socket.on('camera-answer', handleAnswer);
    socket.on('camera-ice', handleIce);

    return () => {
      socket.off('camera-offer', handleOffer);
      socket.off('camera-answer', handleAnswer);
      socket.off('camera-ice', handleIce);
    };
  }, [socket, user.id, localStream, peerConnections, iceCandidatesQueue, roomId]);

  const userInRoom = gameState.players?.find(p => p.id === user?.id);

  // --- RENDER ---
  return (
    <div className="cam-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>
      
      {/* Header / Controls */}
      <div style={{ padding: '10px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <h4 style={{ margin: 0, color: '#fff' }}>DARTBOARD CAM</h4>

        {gameState.players && gameState.players.length > 0 && (
          <div>
            {!isCameraEnabled ? (
               showDeviceSelector && devices.length > 0 ? (
                <select
                  className='camera-select'
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  style={{ background: '#333', color: '#fff', padding: '5px' }}
                >
                  {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Kamera ' + d.deviceId.slice(0,5)}</option>)}
                </select>
               ) : (
                <button onClick={() => setShowDeviceSelector(true)} style={{ background: '#333', color: 'white', border: '1px solid #555' }}>Wähle Cam</button>
               )
            ) : null}
          </div>
        )}
      </div>

      {/* Video Area - Top: Own camera, Bottom: Other players */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>

        {/* LOCAL CAMERA - Top half */}
        <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '50%' }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isCameraEnabled ? 'block' : 'none'
            }}
          />
          {!isCameraEnabled && gameState.players && gameState.players.length > 0 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              <button
                onClick={startCamera}
                style={{ padding: '15px 30px', background: '#ffcc00', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px' }}
              >
                KAMERA STARTEN
              </button>
            </div>
          )}
          {isCameraEnabled && (
            <button
              onClick={stopCamera}
              style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,0,0,0.7)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}
            >
              Stopp
            </button>
          )}
          <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', color: 'white' }}>
            Ich ({user?.name || 'Spieler'})
          </div>
        </div>

        {/* REMOTE CAMERAS - Bottom area */}
        {gameState.players && gameState.players.filter(p => p.id !== user?.id).length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', gap: '5px', padding: '5px', minHeight: '50%' }}>
            {gameState.players.filter(p => p.id !== user?.id).map((player) => (
              <div key={player.id} style={{ flex: 1, position: 'relative', borderRadius: '4px', overflow: 'hidden' }}>
                {remoteStreams[player.id] ? (
                  <video
                    ref={el => {
                      if (el) {
                        el.srcObject = remoteStreams[player.id];
                        el.play().catch(e => console.log('Autoplay blocked', e));
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    Warte auf {player.name}...
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '3px', color: 'white', fontSize: '12px' }}>
                  {player.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fallback Text if no players */}
        {(!gameState.players || gameState.players.length === 0) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '18px' }}>
            Warte auf Spieler...
          </div>
        )}
      </div>
    </div>
  );
}

export default CameraArea;
