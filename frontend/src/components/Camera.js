import React, { useState, useEffect, useRef, useCallback } from 'react';

function Camera({ gameState, user, roomId, socket }) {
  const [localStream, setLocalStream] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
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
        console.log("Stream empfangen!");
        setRemoteStreams(prev => ({ ...prev, [targetUserId]: event.streams[0] }));
    };
    peerConnections.current[targetUserId] = pc;
    return pc;
  };

  const connectToPlayer = (targetUserId) => {
      // Wir verbinden auch ohne eigenen Stream (Empfangsmodus)
      const pc = createPeerConnection(targetUserId);
      if (localStream && pc.getSenders().length === 0) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => socket.emit('camera-offer', { roomId, from: user.id, to: targetUserId, offer: pc.localDescription }))
        .catch(console.error);
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

  const opponent = gameState?.players?.find(player => player.id !== user?.id);

  return (
    <div>
        {/* LOKAL */}
        <div style={{ position: 'relative', background: '#050505' }}>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} srcObject={localStream} />
          {!isCameraEnabled && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '100%' }}>
              <button onClick={() => startCamera()} style={{ padding: '10px 20px', background: '#ffcc00', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', color: '#000' }}>KAMERA STARTEN</button>
            </div>
          )}
          <div style={{position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px', fontSize: '10px'}}>ICH</div>
        </div>

        {/* REMOTE */}
        {opponent && (
          <div style={{ position: 'relative', background: '#000' }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={true}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              srcObject={remoteStreams[opponent.id]}
            />
            <div style={{position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px', fontSize: '10px'}}>Gegner</div>
          </div>
        )}
    </div>
  );
}

export default Camera;
