import React, { useState, useEffect, useRef, useCallback } from 'react';

function CameraArea({ gameState, user, roomId, socket }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [displayMode, setDisplayMode] = useState('split'); // 'split' or 'full'
  const [activePlayerStream, setActivePlayerStream] = useState(null);
  const [error, setError] = useState('');
  const [showDeviceSelection, setShowDeviceSelection] = useState(false);
  const [hasEnteredRoom, setHasEnteredRoom] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const fullVideoRef = useRef(null);

  // Get available camera devices
  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error('Error enumerating devices:', err);
      setError('Unable to access camera devices');
      return [];
    }
  };

  // Request camera permissions and get user media
  const requestCameraAccess = async (deviceId = '') => {
    try {
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setIsCameraEnabled(true);
      setError('');

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return stream;
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Camera access denied or unavailable');
      setIsCameraEnabled(false);
      return null;
    }
  };

  // Initialize WebRTC peer connection
  const createPeerConnection = () => {
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
          candidate: event.candidate,
          fromUserId: user.id
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return pc;
  };

  // Start WebRTC connection (initiator)
  const startWebRTC = async () => {
    const pc = createPeerConnection();
    setPeerConnection(pc);

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('camera-offer', {
        roomId,
        offer,
        fromUserId: user.id
      });
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to start camera connection');
    }
  };

  // Handle incoming offer
  const handleOffer = useCallback(async (data) => {
    if (data.fromUserId === user.id) return; // Ignore own offers

    const pc = createPeerConnection();
    setPeerConnection(pc);

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('camera-answer', {
        roomId,
        answer,
        fromUserId: user.id
      });
    } catch (err) {
      console.error('Error handling offer:', err);
      setError('Failed to establish camera connection');
    }
  }, [localStream, socket, roomId, user.id]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (data) => {
    if (data.fromUserId === user.id) return; // Ignore own answers

    try {
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }, [peerConnection, user.id]);

  // Handle ICE candidates
  const handleIceCandidate = async (data) => {
    if (data.fromUserId === user.id) return; // Ignore own candidates

    try {
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  };

  // Update display mode based on game state
  useEffect(() => {
    if (gameState.isGameStarted) {
      setDisplayMode('full');
      // Determine which stream to show based on current player
      const isActivePlayer = gameState.players[gameState.currentPlayer]?.id === user.id;
      setActivePlayerStream(isActivePlayer ? localStream : remoteStream);
    } else {
      setDisplayMode('split');
    }
  }, [gameState.isGameStarted, gameState.currentPlayer, localStream, remoteStream, user.id, gameState.players]);


  // Set up socket listeners
  useEffect(() => {
    socket.on('camera-offer', handleOffer);
    socket.on('camera-answer', handleAnswer);
    socket.on('camera-ice', handleIceCandidate);

    return () => {
      socket.off('camera-offer', handleOffer);
      socket.off('camera-answer', handleAnswer);
      socket.off('camera-ice', handleIceCandidate);
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  // Initialize camera on component mount and show device selection on room entry
  useEffect(() => {
    const initCamera = async () => {
      await getCameraDevices();
      if (!hasEnteredRoom && availableDevices.length > 0) {
        setShowDeviceSelection(true);
        setHasEnteredRoom(true);
      } else if (!showDeviceSelection) {
        await requestCameraAccess();
      }
      // Start WebRTC if there are 2 players
      if (gameState.players.length === 2) {
        startWebRTC();
      }
    };

    initCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [availableDevices.length, gameState.players.length, hasEnteredRoom, showDeviceSelection, localStream, peerConnection, startWebRTC]);

  // Update full screen video when active player changes
  useEffect(() => {
    if (fullVideoRef.current && activePlayerStream) {
      fullVideoRef.current.srcObject = activePlayerStream;
    }
  }, [activePlayerStream]);

  // Add listener for player turn changes to switch camera view
  useEffect(() => {
    socket.on('turn-changed', (data) => {
      const isActivePlayer = data.currentPlayerId === user.id;
      setDisplayMode('full');
      setActivePlayerStream(isActivePlayer ? localStream : remoteStream);
    });

    return () => {
      socket.off('turn-changed');
    };
  }, [socket, user.id, localStream, remoteStream]);

  const handleDeviceChange = async (deviceId) => {
    setSelectedDeviceId(deviceId);
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    await requestCameraAccess(deviceId);
    setShowDeviceSelection(false);
  };

  const skipDeviceSelection = async () => {
    await requestCameraAccess();
    setShowDeviceSelection(false);
  };

  return (
    <div className="camera-area">
      {error && <div className="camera-error">{error}</div>}

      {showDeviceSelection && (
        <div className="device-selection-popup">
          <h4>Select Camera</h4>
          <p>Choose your camera device for the game:</p>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            <option value="">Default Camera</option>
            {availableDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          <button onClick={() => handleDeviceChange(selectedDeviceId)}>Confirm</button>
          <button onClick={skipDeviceSelection}>Skip</button>
        </div>
      )}

      {!isCameraEnabled && !showDeviceSelection ? (
        <div className="camera-placeholder">
          <h4>Camera Feed</h4>
          <p>Enable camera to start video chat</p>
          <button onClick={() => requestCameraAccess(selectedDeviceId)}>
            Enable Camera
          </button>
          {availableDevices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
            >
              <option value="">Select Camera</option>
              {availableDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <>
          {displayMode === 'split' && (
            <div className="camera-split">
              <div className="camera-player">
                <h5>You</h5>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="camera-video"
                />
              </div>
              <div className="camera-player">
                <h5>Opponent</h5>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="camera-video"
                />
              </div>
            </div>
          )}

          {displayMode === 'full' && (
            <div className="camera-full">
              <h5>{gameState.players[gameState.currentPlayer]?.name || 'Active Player'}</h5>
              <video
                ref={fullVideoRef}
                autoPlay
                playsInline
                className="camera-video-full"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CameraArea;