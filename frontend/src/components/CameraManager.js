import React, { useState, useEffect, useRef, useCallback } from 'react';

function CameraManager({ gameState, user, roomId, socket, selectedDeviceId, isCameraEnabled, onStreamChange }) {

  const [localStream, setLocalStream] = useState(null);
  const [devices, setDevices] = useState([]);
  
  const peerConnections = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const localVideoRef = useRef(null);

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
    } catch (error) { console.error(error); }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  const startCamera = useCallback(async () => {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (!isCameraEnabled || !selectedDeviceId) {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            onStreamChange(null);
        }
        return;
    }
    try {
      const constraints = { 
          video: { deviceId: { exact: selectedDeviceId } },
          audio: false 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      onStreamChange(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      Object.keys(peerConnections.current).forEach(targetId => {
          const pc = peerConnections.current[targetId];
          if (pc) {
              const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
              if (sender) sender.replaceTrack(stream.getVideoTracks()[0]).catch(console.error);
              else stream.getTracks().forEach(track => pc.addTrack(track, stream));
          }
      });
    } catch (error) { alert("Kamera Fehler: " + error.name); }
  }, [isCameraEnabled, selectedDeviceId, onStreamChange, localStream]);

  useEffect(() => {
    startCamera();
  }, [startCamera]);


  const createPeerConnection = (targetUserId) => {
    if (peerConnections.current[targetUserId]) return peerConnections.current[targetUserId];
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    
    pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit('camera-ice', { roomId, from: user.id, to: targetUserId, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
        setRemoteStreams(prev => ({ ...prev, [targetUserId]: event.streams[0] }));
    };
    peerConnections.current[targetUserId] = pc;

    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    return pc;
  };

  const connectToPlayer = (targetUserId) => {
      const pc = createPeerConnection(targetUserId);
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => socket.emit('camera-offer', { roomId, from: user.id, to: targetUserId, offer: pc.localDescription }))
        .catch(console.error);
  };

  useEffect(() => {
    const interval = setInterval(() => {
        if (gameState.players?.length > 1) {
            gameState.players.forEach(player => {
                if (player.id !== user?.id && !peerConnections.current[player.id]) {
                    connectToPlayer(player.id);
                }
            });
        }
    }, 5000); 
    return () => clearInterval(interval);
  }, [gameState.players, user?.id, localStream]); 

  useEffect(() => {
    if (!socket || !user?.id) return;
    const handleOffer = async (data) => {
        if (data.to !== user.id) return;
        const pc = createPeerConnection(data.from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('camera-answer', { roomId, from: user.id, to: data.from, answer });
    };
    const handleAnswer = async (data) => {
        if (data.to === user.id) {
            const pc = peerConnections.current[data.from];
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    };
    const handleIce = async (data) => {
        if (data.to === user.id) {
            const pc = peerConnections.current[data.from];
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
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
  }, [socket, user?.id, localStream, roomId]);


  const rawStatus = gameState.gameStatus || gameState.status || 'unknown';
  const isGameRunning = rawStatus === 'playing' || rawStatus === 'active';

  const currentPlayer = gameState.players && gameState.players[gameState.gameState?.currentPlayerIndex];
  const amIActive = currentPlayer && currentPlayer.id === user.id;

  // Default: Split screen
  let localContainerStyle = { flex: 1, order: 1 };
  let remoteContainerStyle = { flex: 1, order: 2 };

  if (isGameRunning) {
      if(amIActive) {
        localContainerStyle = { flex: '1 1 100%', order: 1, height: '100vh' };
        remoteContainerStyle = { flex: '0 1 0%', order: 2, height: '0' };
      } else {
        localContainerStyle = { flex: '0 1 0%', order: 2, height: '0' };
        remoteContainerStyle = { flex: '1 1 100%', order: 1, height: '100vh' };
      }
  }

  const opponents = gameState.players ? gameState.players.filter(p => p.id !== user?.id) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={localContainerStyle}>
        <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {opponents.map(opponent => (
        <div key={opponent.id} style={remoteContainerStyle}>
          {remoteStreams[opponent.id] && (
            <video 
              srcObject={remoteStreams[opponent.id]} 
              autoPlay 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default CameraManager;