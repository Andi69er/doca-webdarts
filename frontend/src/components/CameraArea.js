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
      console.log('Received remote stream from:', targetUserId);
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: remoteStream
      }));
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

  // Get available camera devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting devices:', error);
      }
    };
    if (navigator.mediaDevices?.enumerateDevices) getDevices();
  }, [selectedDeviceId]);

  // Start camera
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 1280 }, // Höhere Auflösung versuchen
          height: { ideal: 720 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCameraEnabled(true);
      setShowDeviceSelector(false);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (error) {
      alert('Kamera-Fehler: ' + error.message);
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
      if (data.to !== user.id || !localStream) return;
      
      const pc = peerConnections[data.from] || createPeerConnection(data.from);
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      pc.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => {
            const queued = iceCandidatesQueue[data.from] || [];
            queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
            setIceCandidatesQueue(prev => ({ ...prev, [data.from]: [] }));
            return pc.createAnswer();
        })
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
            setPeerConnections(prev => ({ ...prev, [data.from]: pc }));
            socket.emit('camera-answer', { roomId, from: user.id, to: data.from, answer: pc.localDescription });
        });
    };

    const handleAnswer = (data) => {
      if (data.to !== user.id) return;
      const pc = peerConnections[data.from];
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    };

    const handleIce = (data) => {
      if (data.to !== user.id) return;
      const pc = peerConnections[data.from];
      if (pc?.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
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
        
        {devices.length > 0 && userInRoom && (
          <div>
            {!isCameraEnabled ? (
               showDeviceSelector ? (
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

      {/* Video Area - Filling the space */}
      <div className="splitscreen-container" style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        {gameState.players && gameState.players.map((player) => (
          <div key={player.id} className="splitscreen-player" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
            
            {/* Logic: Show Local OR Remote Stream */}
            {player.id === user?.id ? (
              // LOCAL PLAYER
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', // WICHTIG: Macht das Bild randlos
                    display: isCameraEnabled ? 'block' : 'none' 
                  }}
                />
                {!isCameraEnabled && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <button 
                      onClick={startCamera}
                      style={{ padding: '15px 30px', background: '#ffcc00', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      KAMERA STARTEN
                    </button>
                  </div>
                )}
                {isCameraEnabled && (
                  <button 
                    onClick={stopCamera} 
                    style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,0,0,0.7)', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}
                  >
                    Stopp
                  </button>
                )}
                <div className="video-label" style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' }}>
                  {player.name} (Du)
                </div>
              </div>
            ) : (
              // REMOTE PLAYER
              remoteStreams[player.id] && (
                <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 5 }}>
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
                  <div className="video-label" style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px' }}>
                    {player.name}
                  </div>
                </div>
              )
            )}
          </div>
        ))}
        
        {/* Fallback Text if no players */}
        {(!gameState.players || gameState.players.length === 0) && (
            <div style={{ color: '#666', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                Warte auf Spieler...
            </div>
        )}
      </div>
    </div>
  );
}

export default CameraArea;