import React, { useState, useEffect, useRef, useCallback } from 'react';

function CameraArea({ gameState, user, roomId, socket, forceGameStarted }) {

  const [localStream, setLocalStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  
  // Verbindungsspeicher
  const peerConnections = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const localVideoRef = useRef(null);

  // 1. GERÄTE
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) setSelectedDeviceId(videoDevices[0].deviceId);
    } catch (error) { console.error(error); }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  // 2. KAMERA START
  const startCamera = async (deviceIdToUse = selectedDeviceId) => {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    try {
      const constraints = { 
          video: deviceIdToUse ? { deviceId: { exact: deviceIdToUse } } : true,
          audio: false 
      };
      
      // FIX: Doppelte Deklaration entfernt
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setLocalStream(stream);
      setIsCameraEnabled(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      refreshDevices();
      
      // Update Connections
      Object.keys(peerConnections.current).forEach(targetId => {
          const pc = peerConnections.current[targetId];
          if (pc) {
              const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
              if (sender) sender.replaceTrack(stream.getVideoTracks()[0]).catch(console.error);
              else stream.getTracks().forEach(track => pc.addTrack(track, stream));
          }
      });
    } catch (error) { alert("Kamera Fehler: " + error.name); }
  };

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsCameraEnabled(false);
  };

  // 3. WEBRTC
  const createPeerConnection = (targetUserId) => {
    if (peerConnections.current[targetUserId]) return peerConnections.current[targetUserId];
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    
    pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit('camera-ice', { roomId, from: user.id, to: targetUserId, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
    console.log("Stream empfangen!", event);
    if (event.streams && event.streams[0]) {
        console.log(`✅ Stream vorhanden für ${targetUserId}:`, event.streams[0]);
        setRemoteStreams(prev => {
            const updatedStreams = { ...prev, [targetUserId]: event.streams[0] };
            console.log("🔄 Aktualisierte Remote-Streams:", updatedStreams);
            return updatedStreams;
        });
        console.log(`✅ Remote-Stream für ${targetUserId} gespeichert.`);
    } else if (event.track) {
        // Fallback für Edge: Erstelle Stream aus Track
        const stream = new MediaStream([event.track]);
        setRemoteStreams(prev => {
            const updatedStreams = { ...prev, [targetUserId]: stream };
            console.log("🔄 Aktualisierte Remote-Streams (Fallback):", updatedStreams);
            return updatedStreams;
        });
        console.log(`✅ Remote-Stream (Fallback) für ${targetUserId} gespeichert.`);
    } else {
        console.error(`❌ Kein Stream empfangen für ${targetUserId}.`);
    }
};
    peerConnections.current[targetUserId] = pc;
    return pc;
  };

  const connectToPlayer = (targetUserId) => {
    return new Promise(async (resolve, reject) => {
        const pc = createPeerConnection(targetUserId);
        try {
            if (localStream) {
                localStream.getTracks().forEach(track => {
                    if (!pc.getSenders().some(sender => sender.track === track)) {
                        pc.addTrack(track, localStream);
                    }
                });
            }
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('camera-offer', { roomId, from: user.id, to: targetUserId, offer: pc.localDescription });
            resolve(`Offer erfolgreich gesendet an ${targetUserId}`);
        } catch (error) {
            console.error(`Fehler bei connectToPlayer für ${targetUserId}:`, error);
            reject(error);
        }
    }); // FIX: Hier fehlte });
  };

  // Auto-Connect (Herzschlag)
  useEffect(() => {
    const interval = setInterval(() => {
        if (gameState.players?.length > 1) {
            gameState.players.forEach(player => {
                if (player.id !== user?.id && !remoteStreams[player.id]) connectToPlayer(player.id);
            });
        }
    }, 3000); 
    return () => clearInterval(interval);
  }, [localStream, gameState.players, remoteStreams]); 

  // Sockets
  useEffect(() => {
    if (!socket) return;
    const handleOffer = async (data) => {
        if (data.to !== user.id) return;
        const pc = createPeerConnection(data.from);
        if (localStream && pc.getSenders().length === 0) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('camera-answer', { roomId, from: user.id, to: data.from, answer });
        } catch (e) { console.error(e); }
    };
    const handleAnswer = async (data) => {
        if (data.to === user.id) {
            const pc = peerConnections.current[data.from];
            if (pc) try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); } catch (e) {}
        }
    };
    const handleIce = async (data) => {
        if (data.to === user.id) {
            const pc = peerConnections.current[data.from];
            if (pc) try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e) {}
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
  }, [socket, user.id, localStream, roomId]);


  // --- 5. LAYOUT LOGIK (VOLLBILD + SCHWARZ FIX) ---
  const rawStatus = gameState.gameStatus || gameState.status || 'unknown';
  const isGameRunning = forceGameStarted || rawStatus === 'playing' || rawStatus === 'active';

  const currentPlayerIndex = gameState.gameState?.currentPlayerIndex;
  const currentPlayer = (gameState.players && currentPlayerIndex !== undefined) ? gameState.players[currentPlayerIndex] : null;
  const amIActive = currentPlayer && currentPlayer.id === user.id;

  // Standard: Split Screen
  let localStyle = { flex: 1, height: '50%', overflow: 'hidden', transition: 'all 0.5s' };
  let remoteStyle = { flex: 1, height: '50%', overflow: 'hidden', transition: 'all 0.5s' };

  // Vollbild-Logik
  if (isGameRunning) {
      localStyle = amIActive ? { flex: 1, height: '100%' } : { flex: 0, height: '0px', overflow: 'hidden' };
      remoteStyle = amIActive ? { flex: 0, height: '0px', overflow: 'hidden' } : { flex: 1, height: '100%' };
  }

  return (
    <div className="cam-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ padding: '5px 10px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '35px' }}>
        <h4 style={{ margin: 0, color: '#fff', fontSize: '13px' }}>KAMERA</h4>
        <div style={{display: 'flex', gap: '5px'}}>
            <select 
                value={selectedDeviceId} 
                onChange={(e) => { setSelectedDeviceId(e.target.value); if(isCameraEnabled) startCamera(e.target.value); }}
                style={{background: '#333', color: '#fff', border: '1px solid #555', fontSize: '11px', maxWidth: '120px'}}
            >
                {devices.length === 0 && <option value="">Suche...</option>}
                {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Cam ${i+1}`}</option>)}
            </select>
            <button onClick={refreshDevices} style={{fontSize: '12px', background: 'transparent', border: 'none', cursor: 'pointer'}}>🔄</button>
            {isCameraEnabled && <button onClick={stopCamera} style={{background: '#d9534f', color: '#fff', border: 'none', padding: '2px 6px', fontSize: '11px', borderRadius: '3px'}}>Stop</button>}
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        
        {/* LOKAL */}
        <div style={{ ...localStyle, position: 'relative', background: '#050505' }}>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          {!isCameraEnabled && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '100%' }}>
              <button onClick={() => startCamera()} style={{ padding: '10px 20px', background: '#ffcc00', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', color: '#000' }}>KAMERA STARTEN</button>
            </div>
          )}
          <div style={{position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px', fontSize: '10px'}}>ICH</div>
        </div>

        {/* REMOTE */}
        {gameState.players && gameState.players.filter(p => p.id !== user?.id).map(player => (
            <div key={player.id} style={{ ...remoteStyle, position: 'relative', background: '#000' }}>
                {remoteStreams[player.id] && (
                    <video 
                        ref={el => { 
                            if (el) { 
                                el.srcObject = remoteStreams[player.id]; 
                                const playPromise = el.play();
                                if (playPromise !== undefined) {
                                    playPromise.catch(error => {
                                        console.log("Auto-play prevented, forcing muted.");
                                        el.muted = true;
                                        el.play();
                                    });
                                }
                            } 
                        }} 
                        autoPlay 
                        playsInline 
                        muted={true}
                        style={{ width: '100%', height: '300px', objectFit: 'cover' }}
                    />
                )}
                <div style={{position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px', fontSize: '10px'}}>{player.name}</div>
            </div>
        ))}
      </div>
    </div>
  );
}

export default CameraArea;