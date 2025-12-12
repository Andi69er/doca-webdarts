import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import NumberPad from './NumberPad';
import GameChat from './GameChat';
import GameEndPopup from './GameEndPopup';
import './Game.css';
import LiveStatistics from "./LiveStatistics";
import PlayerScores from "./PlayerScores";

// --- AUDIO HELPERS ---
const playAlarmSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Penetranter Alarm-Sound (Sägezahn-Welle)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.5);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
        console.error("Audio konnte nicht abgespielt werden:", e);
    }
};

// --- SHOT CLOCK COMPONENT ---
const ShotClock = ({ isActive, onTimeout }) => {
    const [timeLeft, setTimeLeft] = useState(45);

    useEffect(() => {
        if (!isActive) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    onTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isActive, onTimeout]);

    const isCritical = timeLeft <= 10;

    return (
        <div style={{
            marginLeft: 'auto',
            padding: '5px 10px',
            borderRadius: '5px',
            fontWeight: 'bold',
            fontSize: '1.2em',
            color: isCritical ? '#fff' : '#ccc',
            backgroundColor: isCritical ? '#ff4444' : 'rgba(0,0,0,0.3)',
            border: isCritical ? '2px solid white' : '1px solid #444',
            animation: isCritical ? 'pulse 0.5s infinite' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            minWidth: '80px',
            justifyContent: 'center'
        }}>
            <span>⏱️</span>
            <span>{timeLeft}s</span>
        </div>
    );
};

// --- STATS CALCULATOR ---
const ensureStats = (player) => {
    if (!player) return player;
    const p = { ...player };
    if ((!p.dartsThrown || p.dartsThrown === 0) && p.score < 501) {
         p.dartsThrown = Math.ceil((501 - p.score) / 45) * 3;
    }
    if (!p.avg || p.avg === "0.00") {
        if (p.dartsThrown > 0) {
            p.avg = ((501 - p.score) / p.dartsThrown * 3).toFixed(2);
        } else {
            p.avg = "0.00";
        }
    }
    return p;
};

// --- HELPERS ---
// --- COMPONENTS ---
// Erweiterter Video Player (Startet Muted um Autoplay-Blockaden zu verhindern)
const RemoteVideoPlayer = ({ stream, name, playerId }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        console.log(`[RemoteVideoPlayer] ${name} (${playerId}) - Stream verfügbar:`, !!stream);
        console.log(`[RemoteVideoPlayer] ${name} - Stream Details:`, stream);
        console.log(`[RemoteVideoPlayer] ${name} - VideoRef:`, videoRef.current);
        
        if (videoRef.current && stream) {
            console.log(`[RemoteVideoPlayer] ${name} - Setze Stream auf Video Element`);
            
            // Stream setzen
            videoRef.current.srcObject = stream;
            
            // Video-Eigenschaften setzen
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            videoRef.current.autoplay = true;
            videoRef.current.controls = false;

            // Video-Event-Handler
            const handleLoadedMetadata = () => {
                console.log(`[RemoteVideoPlayer] ${name} - ✅ Video Metadata geladen`);
                console.log(`[RemoteVideoPlayer] ${name} - Video Dimensions:`, {
                    videoWidth: videoRef.current.videoWidth,
                    videoHeight: videoRef.current.videoHeight
                });
            };
            
            const handleCanPlay = () => {
                console.log(`[RemoteVideoPlayer] ${name} - ✅ Video kann abgespielt werden`);
            };
            
            const handlePlay = () => {
                console.log(`[RemoteVideoPlayer] ${name} - ✅ Video spielt ab`);
            };
            
            const handleError = (error) => {
                console.error(`[RemoteVideoPlayer] ${name} - ❌ Video Fehler:`, error);
            };

            videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoRef.current.addEventListener('canplay', handleCanPlay);
            videoRef.current.addEventListener('play', handlePlay);
            videoRef.current.addEventListener('error', handleError);

            // Video starten
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log(`[RemoteVideoPlayer] ${name} - ✅ Video erfolgreich gestartet`);
                }).catch(error => {
                    console.error(`[RemoteVideoPlayer] ${name} - ❌ Autoplay Fehler:`, error);
                });
            }
            
            // Cleanup
            return () => {
                if (videoRef.current) {
                    videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    videoRef.current.removeEventListener('canplay', handleCanPlay);
                    videoRef.current.removeEventListener('play', handlePlay);
                    videoRef.current.removeEventListener('error', handleError);
                }
            };
        } else if (!stream) {
            console.log(`[RemoteVideoPlayer] ${name} - ❌ Kein Stream verfügbar`);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }
    }, [stream, name, playerId]);

    // Debug: Zeige Stream Status
    if (!stream) {
        return (
            <div className="remote-video-wrapper" style={{
                position: 'relative', 
                width: '100%', 
                height: '100%',
                backgroundColor: '#333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ccc',
                fontSize: '14px'
            }}>
                <div className="video-label">{name} - Kein Stream</div>
                <div>Warte auf Videoverbindung...</div>
            </div>
        );
    }

    return (
        <div className="remote-video-wrapper" style={{position: 'relative', width: '100%', height: '100%'}}>
            <div className="video-label">{name}</div>
            <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                style={{width:'100%', height:'100%', objectFit: 'cover', backgroundColor: '#000'}}
            />
            {/* Unmute Button Overlay */}
            <button
                onClick={(e) => {
                    const v = e.target.parentElement.querySelector('video');
                    if(v) {
                        v.muted = !v.muted;
                        console.log(`[RemoteVideoPlayer] ${name} - Muted geändert zu:`, v.muted);
                    }
                }}
                style={{position:'absolute', bottom:5, right:5, fontSize:'0.8em', opacity:0.7, zIndex: 10}}
            >
                🔇/🔊
            </button>
        </div>
    );
};

// --- MAIN GAME ---
function Game() {
    const { roomId } = useParams();
    const { socket } = useSocket();
    
    // State
    const [isLoading, setIsLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(null);
    const [user, setUser] = useState({ id: null, name: 'Gast' });
    const [gameState, setGameState] = useState(null);
    const [inputLockout, setInputLockout] = useState(true);
    const [localGameStarted, setLocalGameStarted] = useState(false);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [turnEndTime, setTurnEndTime] = useState(null);
    
// Video / Camera State - Vereinfacht
    const [opponentLocked, setOpponentLocked] = useState(false);
    const [canUseUndo, setCanUseUndo] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({});
    
    // Debug remoteStreams changes
    useEffect(() => {
        console.log(`[Game] Remote Streams State geändert:`, remoteStreams);
        console.log(`[Game] Remote Streams Keys:`, Object.keys(remoteStreams));
        Object.entries(remoteStreams).forEach(([playerId, stream]) => {
            console.log(`[Game] Player ${playerId} Stream:`, {
                exists: !!stream,
                active: stream?.active,
                tracks: stream?.getTracks()?.length || 0
            });
        });
    }, [remoteStreams]);
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);
    
    // Video Layout State
    const [videoLayout, setVideoLayout] = useState({
        mode: 'splitscreen', // 'splitscreen' oder 'fullscreen'
        currentPlayerId: null
    });
    
    // Refs
    const ignoreServerUntil = useRef(0);
    const expectedLocalScore = useRef(null);
    const localVideoRef = useRef(null);
    const peerConnections = useRef({});
    const iceCandidateQueue = useRef({}); // WICHTIG: Puffer für zu frühe Candidates
    const lockoutTimerRef = useRef(null);

    // Callbacks - Device Enumeration
    const refreshDevices = useCallback(async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                .then(s => s.getTracks().forEach(t => t.stop()))
                .catch(() => {});
                
            const list = await navigator.mediaDevices.enumerateDevices();
            const v = list.filter(d => d.kind === 'videoinput');
            setDevices(v);
            if (v.length > 0 && !selectedDeviceId) setSelectedDeviceId(v[0].deviceId);
        } catch(e) { console.error("Geräte konnten nicht geladen werden:", e); }
    }, [selectedDeviceId]);

    // Socket Connection Setup
    useEffect(() => {
        if (!socket) {
            console.log('Warte auf Socket...');
            return;
        }

        const onConnect = () => {
            console.log('Verbunden:', socket.id);
            setUser(prev => ({ ...prev, id: socket.id }));
            setConnectionError(null);
            setIsLoading(false);
        };

        const onConnectError = (error) => {
            console.error('Verbindungsfehler:', error);
            setConnectionError('Verbindung unterbrochen.');
            setIsLoading(false);
        };

        socket.on('connect', onConnect);
        socket.on('connect_error', onConnectError);

        if (socket.connected) onConnect();
        else if (socket.disconnected && isLoading) setIsLoading(true);

        return () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onConnectError);
        };
    }, [socket, isLoading]);

    useEffect(() => { refreshDevices(); }, [refreshDevices]);




    // Game State Handling
    const handleGameState = useCallback((newState) => {
        if (!newState) return;
        
        const currentIndex = newState.currentPlayerIndex !== undefined 
            ? newState.currentPlayerIndex 
            : (newState.gameState?.currentPlayerIndex || 0);
        
        setGameState(prev => {
            if (!prev) {
                setInputLockout(false);
                setTurnEndTime(null);
            }

            if (newState.gameStatus === 'finished' && prev?.gameStatus !== 'finished') {
                setShowWinnerPopup(true);
            }
            
            const updatedPlayers = (newState.players || prev?.players || []).map(newPlayer => {
                const existingPlayer = (prev?.players || []).find(p => p.id === newPlayer.id) || {};
                return {
                    ...existingPlayer,
                    ...newPlayer,
                    dartsThrown: newPlayer.dartsThrown || existingPlayer.dartsThrown || 0,
                    avg: newPlayer.avg || existingPlayer.avg || "0.00"
                };
            });

            const gameStarted = newState.gameStatus === 'active' || 
                              (prev && prev.gameStatus === 'active') ||
                              updatedPlayers.some(p => p.score < 501);

            if (gameStarted) {
                setLocalGameStarted(true);
            }

            const currentPlayerIndex = newState.currentPlayerIndex !== undefined 
                ? newState.currentPlayerIndex 
                : (newState.gameState?.currentPlayerIndex !== undefined 
                    ? newState.gameState.currentPlayerIndex 
                    : (prev?.gameState?.currentPlayerIndex || 0));
            
            const currentPlayer = updatedPlayers[currentPlayerIndex];
            const prevPlayerIndex = prev?.currentPlayerIndex;
            
            // WICHTIG: Lockout nur aufheben wenn Spielerwechsel stattgefunden hat
            if (currentPlayer && user.id) {
                const newIsMyTurn = currentPlayer.id === user.id;
                setIsMyTurn(newIsMyTurn);

                // Wenn ich jetzt dran bin und vorher nicht, dann Lockout aufheben
                if (newIsMyTurn && prevPlayerIndex !== currentPlayerIndex) {
                    setInputLockout(false);
                    setTurnEndTime(null);
                    if (lockoutTimerRef.current) {
                        clearTimeout(lockoutTimerRef.current);
                        lockoutTimerRef.current = null;
                    }
                }

// Video Layout setzen basierend auf Spielphase
                if (gameStarted && currentPlayer) {
                    // Spiel läuft: Aktueller Spieler in Vollbild
                    setVideoLayout({
                        mode: 'fullscreen',
                        currentPlayerId: newIsMyTurn ? 'local' : currentPlayer.id
                    });
                } else if (!gameStarted && newState.gameStatus !== 'finished') {
                    // Vor Spielstart: Splitscreen
                    setVideoLayout({
                        mode: 'splitscreen',
                        currentPlayerId: null
                    });
                }
            }

// Wenn Spiel endet, zurück zu Splitscreen
            if (newState.gameStatus === 'finished') {
                setVideoLayout({
                    mode: 'splitscreen',
                    currentPlayerId: null
                });
            }

            return {
                ...(prev || {}),
                ...newState,
                players: updatedPlayers,
                gameStatus: newState.gameStatus || (gameStarted ? 'active' : (prev?.gameStatus || 'waiting')),
                gameState: {
                    ...(prev?.gameState || {}),
                    ...(newState.gameState || {}),
                    currentPlayerIndex: currentPlayerIndex
                },
                currentPlayerIndex: currentPlayerIndex
            };
        });
    }, [socket?.id, user?.id]);

    const handleReceiveMessage = useCallback((data) => {
        setGameState(prev => {
            if(!prev) return prev;
            return { ...prev, chatMessages: [...(prev.chatMessages || []), data] };
        });
    }, []);

    // Handler für Score-Lock Event
    const handleScoreLocked = useCallback((data) => {
        const { lockedPlayerId, duration } = data;
        console.log(`Score-Lock Event empfangen: Spieler ${lockedPlayerId} gesperrt für ${duration}ms`);

        // Wenn der Gegner gesperrt ist, kann ich (der aktive Spieler) Undo verwenden
        if (lockedPlayerId !== user.id) {
            setOpponentLocked(true);
            setCanUseUndo(true); // Ich kann Undo verwenden, da Gegner gesperrt

            // Timer für 5 Sekunden starten
            if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
            lockoutTimerRef.current = setTimeout(() => {
                setOpponentLocked(false);
                setCanUseUndo(false);
                console.log('Score-Lock und Undo-Möglichkeit aufgehoben');
            }, duration);
        } else {
            // Ich bin der gesperrte Spieler - kann nicht Undo verwenden
            setCanUseUndo(false);
            setOpponentLocked(false); // Ich bin gesperrt, Gegner nicht

            // Timer für 5 Sekunden starten
            if (lockoutTimerRef.current) clearTimeout(lockoutTimerRef.current);
            lockoutTimerRef.current = setTimeout(() => {
                console.log('Score-Lock aufgehoben');
            }, duration);
        }
    }, [user.id]);

    const winner = gameState?.players?.find(p => p.score <= 0);


    useEffect(() => {
        if (!socket) return;
        socket.on('game-state-update', handleGameState);
        socket.on('game-started', handleGameState);
        socket.on('gameState', handleGameState);
        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('statusUpdate', handleGameState);
        socket.on('score-locked', handleScoreLocked);

        socket.emit('joinRoom', { roomId });
        socket.emit('getGameState', roomId);

        const poll = setInterval(() => socket.emit('getGameState', roomId), 2500);
        return () => {
            clearInterval(poll);
            socket.off('game-state-update', handleGameState);
            socket.off('game-started', handleGameState);
            socket.off('gameState', handleGameState);
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('statusUpdate', handleGameState);
            socket.off('score-locked', handleScoreLocked);
        };
    }, [socket, roomId, handleGameState, handleReceiveMessage, handleScoreLocked]);

    // --- KAMERA & WEBRTC LOGIK ---

const startCamera = async (targetDeviceId) => {
        const idToUse = targetDeviceId || selectedDeviceId;
        console.log("Starte Kamera mit ID:", idToUse);
        
        let stream = null;

        try {
            // Standard: Video + Audio
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: idToUse ? { deviceId: { exact: idToUse } } : true, 
                audio: true 
            });
        } catch (err) {
            console.warn("Mit Audio fehlgeschlagen, versuche ohne Audio...", err);
            try {
                // Fallback: Nur Video (für USB Cams wichtig!)
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: idToUse ? { deviceId: { exact: idToUse } } : true, 
                    audio: false 
                });
            } catch (err2) {
                console.error("Kamera komplett fehlgeschlagen:", err2);
                alert("Kamera konnte nicht gestartet werden. Bitte Berechtigungen prüfen.");
                return;
            }
        }

        if (stream) {
            setLocalStream(stream);
            setIsCameraEnabled(true);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            // Bestehende Verbindungen aktualisieren
            Object.values(peerConnections.current).forEach(pc => {
                const senders = pc.getSenders();
                stream.getTracks().forEach(track => {
                    const sender = senders.find(s => s.track && s.track.kind === track.kind);
                    if (sender) {
                        sender.replaceTrack(track);
                    } else {
                        pc.addTrack(track, stream);
                    }
                });
            });
            
            // Automatisch mit allen Gegnern verbinden wenn Kamera gestartet wird
            setTimeout(() => {
                autoConnectToOpponents();
            }, 1000);
        }
    };

const stopCamera = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            setIsCameraEnabled(false);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
        }
    };

    // Automatische Verbindung mit allen Gegnern
    const autoConnectToOpponents = useCallback(() => {
        if (!localStream || !gameState?.players) {
            console.log("AutoConnect übersprungen - localStream:", !!localStream, "gameState.players:", !!gameState?.players);
            return;
        }
        
        const opponents = gameState.players.filter(p => p.id !== user.id);
        console.log("Automatisch verbinden mit:", opponents.map(p => p.name));
        
        opponents.forEach(opponent => {
            if (!peerConnections.current[opponent.id]) {
                console.log("Initiating call to:", opponent.name, opponent.id);
                setTimeout(() => initiateCall(opponent.id), 500);
            } else {
                console.log("Bereits verbunden mit:", opponent.name);
            }
        });
    }, [localStream, gameState?.players, user.id]);

    // Hilfsfunktion zum Verarbeiten der Queue (Race Condition Fix)
    const processIceQueue = async (socketId, pc) => {
        if (iceCandidateQueue.current[socketId]) {
            console.log(`Verarbeite ${iceCandidateQueue.current[socketId].length} gepufferte ICE Candidates für ${socketId}`);
            for (const candidate of iceCandidateQueue.current[socketId]) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) { console.error("Queue ICE Error:", e); }
            }
            delete iceCandidateQueue.current[socketId];
        }
    };

const createPeerConnection = (targetSocketId) => {
        console.log(`[WebRTC] Erstelle PeerConnection zu: ${targetSocketId}, localStream verfügbar:`, !!localStream);
        
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        });

        // WICHTIG: Transceiver erzwingen (Video empfangen, auch wenn wir keins senden)
        pc.addTransceiver('video', { direction: 'sendrecv' });
        pc.addTransceiver('audio', { direction: 'sendrecv' });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                console.log(`[WebRTC] ICE Candidate gesendet an ${targetSocketId}`);
                socket.emit('camera-ice', {
                    candidate: event.candidate,
                    to: targetSocketId,
                    from: socket.id,
                    roomId
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[WebRTC] 🔥 ontrack Event von ${targetSocketId}!`);
            console.log(`[WebRTC] Event Details:`, {
                track: event.track,
                streams: event.streams,
                receiver: event.receiver,
                transceiver: event.transceiver
            });
            
            console.log(`[WebRTC] Track Details:`, {
                kind: event.track.kind,
                label: event.track.label,
                readyState: event.track.readyState,
                id: event.track.id
            });
            
            const stream = event.streams[0];
            console.log(`[WebRTC] Stream aus event.streams[0]:`, stream);
            
            if (stream) {
                console.log(`[WebRTC] ✅ Gültiger Stream empfangen von ${targetSocketId}`);
                console.log(`[WebRTC] Stream Properties:`, {
                    id: stream.id,
                    active: stream.active,
                    tracks: stream.getTracks().length,
                    videoTracks: stream.getVideoTracks().length,
                    audioTracks: stream.getAudioTracks().length
                });
                
                setRemoteStreams(prev => {
                    console.log(`[WebRTC] Aktuelle Remote Streams:`, Object.keys(prev));
                    const newStreams = {
                        ...prev,
                        [targetSocketId]: stream
                    };
                    console.log(`[WebRTC] ✅ Remote Streams aktualisiert für ${targetSocketId}:`, Object.keys(newStreams));
                    console.log(`[WebRTC] Stream für ${targetSocketId}:`, newStreams[targetSocketId]);
                    return newStreams;
                });
            } else {
                console.error(`[WebRTC] ❌ KEIN STREAM in ontrack event von ${targetSocketId}!`);
                console.error(`[WebRTC] event.streams:`, event.streams);
                console.error(`[WebRTC] event.track:`, event.track);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection State zu ${targetSocketId}:`, pc.connectionState);
        };

        // ROBUSTE localStream Behandlung
        const addLocalTracks = () => {
            if (localStream && localStream.getTracks().length > 0) {
                console.log(`[WebRTC] Füge ${localStream.getTracks().length} Tracks zu PeerConnection hinzu`);
                localStream.getTracks().forEach(track => {
                    try {
                        pc.addTrack(track, localStream);
                        console.log(`[WebRTC] ✅ Track hinzugefügt:`, track.kind, track.label);
                    } catch (error) {
                        console.error(`[WebRTC] ❌ Fehler beim Hinzufügen von Track:`, error);
                    }
                });
            } else {
                console.log(`[WebRTC] ⚠️ Keine localStream Tracks verfügbar für ${targetSocketId}`);
            }
        };

        // Tracks sofort hinzufügen wenn localStream verfügbar
        addLocalTracks();

        // Falls localStream noch nicht verfügbar, warte darauf
        if (!localStream) {
            console.log(`[WebRTC] Warte auf localStream für ${targetSocketId}...`);
            const checkLocalStream = setInterval(() => {
                if (localStream) {
                    console.log(`[WebRTC] localStream jetzt verfügbar für ${targetSocketId}`);
                    addLocalTracks();
                    clearInterval(checkLocalStream);
                }
            }, 100);
            
            // Timeout nach 5 Sekunden
            setTimeout(() => {
                clearInterval(checkLocalStream);
                console.log(`[WebRTC] Timeout beim Warten auf localStream für ${targetSocketId}`);
            }, 5000);
        }

        peerConnections.current[targetSocketId] = pc;
        console.log(`[WebRTC] PeerConnection erstellt für ${targetSocketId}`);
        return pc;
    };

    const initiateCall = async (targetUserId) => {
        if (!localStream) {
            alert("Bitte zuerst Kamera starten!");
            return;
        }
        
        console.log("Initiiere Anruf an:", targetUserId);
        const pc = createPeerConnection(targetUserId);
        
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            if (socket) {
                socket.emit('camera-offer', {
                    offer,
                    to: targetUserId,
                    from: socket.id,
                    roomId
                });
            }
        } catch (e) {
            console.error("Fehler beim Anrufen:", e);
        }
    };

    // WebRTC Socket Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('camera-offer', async (data) => {
            try {
                console.log("Kamera-Anruf erhalten von:", data.from);
                const pc = createPeerConnection(data.from);
                
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                
                // JETZT Queue abarbeiten, da RemoteDescription gesetzt ist
                await processIceQueue(data.from, pc);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('camera-answer', {
                    answer,
                    to: data.from,
                    from: socket.id,
                    roomId
                });
            } catch (error) {
                console.error("WebRTC Error (Answer):", error);
            }
        });

        socket.on('camera-answer', async (data) => {
            console.log("Kamera-Antwort erhalten von:", data.from);
            const pc = peerConnections.current[data.from];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                // Auch hier Queue abarbeiten
                await processIceQueue(data.from, pc);
            }
        });

        socket.on('camera-ice', async (data) => {
            const pc = peerConnections.current[data.from];
            
            // Wenn PC existiert UND RemoteDescription gesetzt ist -> direkt hinzufügen
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) { console.error("ICE Error:", e); }
            } else {
                // Sonst: In Queue speichern (WICHTIG für das schwarze Bild Problem)
                console.log(`Puffere ICE Candidate für ${data.from} (Verbindung noch nicht bereit)`);
                if (!iceCandidateQueue.current[data.from]) {
                    iceCandidateQueue.current[data.from] = [];
                }
                iceCandidateQueue.current[data.from].push(data.candidate);
            }
        });

        return () => {
            socket.off('camera-offer');
            socket.off('camera-answer');
            socket.off('camera-ice');
        };
    }, [socket, localStream, roomId]);

    // Actions
    const handleStartGame = () => {
        if (!socket) return;
        setLocalGameStarted(true);
        const payload = {
            roomId,
            userId: user.id,
            resetScores: true
        };
socket.emit('start-game', payload);
        // Wenn Host startet, setze automatisch Vollbild für Host
        if (user.id === gameState?.hostId) {
            setVideoLayout({
                mode: 'fullscreen',
                currentPlayerId: 'local'
            });
        }
    };

    const handleScoreInput = (scoreInput) => {
        if (!isMyTurn || inputLockout) return;
        const currentIndex = gameState?.currentPlayerIndex;
        const currentPlayer = gameState?.players?.[currentIndex];
        
        if (!currentPlayer) return;

        const isHost = gameState?.hostId === user.id;

        if (!socket || !user?.id || inputLockout) return;
        if (!isMyTurn && !isHost) return;

        const points = parseInt(scoreInput, 10);
        if (isNaN(points)) return;

        setLocalGameStarted(true);
        // Entsperre das Nummernpad für den aktiven Spieler
        // Entsperre das Nummernpad für Undo
        setInputLockout(false);
        
        const payload = {
            roomId,
            userId: currentPlayer.id,
            score: points
        };
        
        socket.emit('score-input', payload);

        // Score-Eingabe gesendet - Sperr-Logik läuft jetzt über Socket-Event
    };

    const handleUndo = () => {
        if (socket && user.id && canUseUndo && window.confirm("Undo?")) {
            ignoreServerUntil.current = 0;
            expectedLocalScore.current = null;
            socket.emit('undo', { roomId, userId: user.id });
            
            // Nach Undo: Undo-Möglichkeit zurücksetzen
            setCanUseUndo(false);
            if (lockoutTimerRef.current) {
                clearTimeout(lockoutTimerRef.current);
                lockoutTimerRef.current = null;
            }
        }
    };

    // --- WHITESCREEN FIX ---
    if (!gameState || !gameState.players) {
        return (
            <div className="game-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', color:'white', flexDirection: 'column'}}>
                <h2>Lade Spiel...</h2>
                <div style={{marginTop: '20px'}}>
                    {!socket ? "Verbinde mit Server..." : "Hole Spieldaten..."}
                </div>
            </div>
        );
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isGameRunning = gameState.gameStatus === 'active' || localGameStarted;
    const isGameFinished = gameState.gameStatus === 'finished';


    const isHost = gameState.hostId === user.id;
    const canInput = !inputLockout;
    const showCountdown = false;
    const countdown = 0;
    const handleRematch = () => {
        setShowWinnerPopup(false);
        if (socket) {
            socket.emit('rematch', { roomId, userId: user.id });
        }
    };

    return (
        <div className="game-container">
            <div className="debug-info">
                <h4>Debug-Info:</h4>
                <div>Spieler: {gameState?.players?.map(p => `${p.name}: ${p.score}`).join(' | ')}</div>
                <div>Aktueller Spieler: {gameState?.players?.[gameState.currentPlayerIndex]?.name}</div>
                <div>Mein Zug: {isMyTurn ? 'Ja' : 'Nein'}</div>
                <div>Gesperrt: {inputLockout ? 'Ja' : 'Nein'}</div>
            </div>
            
            {!gameState.players.some(p => p.id === user.id) && <div className="spectator-banner">Zuschauer</div>}
            <div className="game-layout">
                <div className="game-main-area">
                    <PlayerScores gameState={gameState} user={user} />
                    {isGameRunning ? (
                        <div className={`game-status-bar ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
                            <div className="status-text">{isMyTurn ? 'DU BIST DRAN' : `${currentPlayer?.name} IST DRAN`}</div>
                        </div>
                    ) : null}
                    
                    {/* Show ready box only if game is not running AND not finished */}
                    {(!isGameRunning && !isGameFinished) && (
                        <div className="ready-box">
                            <div className="ready-status">
                                {gameState.players.length < 2 ? "Warte auf Gegner..." : "Bereit zum Start"}
                            </div>
                            {isHost ? (
                                <button className="start-game-button" onClick={handleStartGame}>
                                    SPIEL STARTEN 🎯
                                </button>
                            ) : (
                                <div className="waiting-message">Warte auf Host...</div>
                            )}
                        </div>
                    )}

                    <div className="game-bottom-section">
                        <div className="game-column-left">
                            <div className="wurf-section">
                                <h3 className="wurf-title">DEIN WURF</h3>
                                <div className="number-pad-container">
                                    <div className="number-pad-wrapper">
                                        {showCountdown && (
                                            <div className="countdown-overlay">
                                                <div className="countdown-text">{countdown}s</div>
                                            </div>
                                        )}
                                         <NumberPad
                                             onScoreInput={handleScoreInput}
                                             onUndo={handleUndo}
                                             checkoutSuggestions={gameState.checkoutSuggestions}
                                             isActive={canInput && isMyTurn && !inputLockout}
                                             isLocked={!isMyTurn || inputLockout}
                                             isOpponentLocked={opponentLocked}
                                             isMyTurn={isMyTurn}
                                             canUseUndo={canUseUndo}
                                         />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="game-column-center"><div className="statistics-section"><LiveStatistics gameState={gameState} /></div></div>
                        <div className="game-column-right"><div className="game-chat-container"><GameChat socket={socket} roomId={roomId} user={user} messages={gameState.chatMessages || []} /></div></div>
                    </div>
                </div>
                <div className="camera-column">
                    <div className="camera-controls">
                        <select value={selectedDeviceId} onChange={e => { 
                            setSelectedDeviceId(e.target.value); 
                            if(isCameraEnabled) startCamera(e.target.value); 
                        }}>
                            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Kamera"}</option>)}
                        </select>
<button onClick={() => isCameraEnabled ? stopCamera() : startCamera(selectedDeviceId)}>
                            {isCameraEnabled ? "📹 Stop" : "📹 Start"}
                        </button>
                        <button 
                            onClick={() => autoConnectToOpponents()} 
                            style={{ 
                                marginLeft: '10px', 
                                padding: '5px 10px', 
                                backgroundColor: '#4CAF50', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px',
                                fontSize: '12px'
                            }}
                        >
                            🔌 Verbinden
                        </button>
                        <span style={{ marginLeft: '10px', fontSize: '12px', color: '#ccc' }}>
                            {isCameraEnabled ? "Automatisch verbunden" : "Kamera starten für Video"}
                        </span>
                    </div>
{/* Video Container mit korrekter Logik */}
                    <div className="video-container" style={{ 
                        display: 'flex', 
                        flexDirection: videoLayout.mode === 'splitscreen' ? 'column' : 'column',
                        height: '100%',
                        gap: '10px'
                    }}>
                        {/* Lokaler Spieler */}
                        <div className="video-player local" style={{
                            height: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === 'local' ? '100%' : '200px',
                            flex: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === 'local' ? 'none' : '1',
                            display: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId !== 'local' ? 'none' : 'flex',
                            border: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === 'local' ? '3px solid #4CAF50' : '1px solid #555',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <div className="video-label" style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                background: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                fontSize: '14px',
                                zIndex: '10'
                            }}>
                                Du {videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === 'local' ? ' (DU BIST DRAN)' : ''}
                            </div>
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                muted 
                                playsInline 
                                style={{
                                    width:'100%', 
                                    height:'100%', 
                                    objectFit: 'cover',
                                    backgroundColor: '#000'
                                }} 
                            />
                        </div>
                        
                        {/* Remote Spieler */}
                        {gameState.players.filter(p => p.id !== user.id).map(p => (
                            <div key={p.id} className="video-player remote" style={{
                                height: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === p.id ? '100%' : '200px',
                                flex: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === p.id ? 'none' : '1',
                                display: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId !== p.id ? 'none' : 'flex',
                                border: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === p.id ? '3px solid #4CAF50' : '1px solid #555',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div className="video-label" style={{
                                    position: 'absolute',
                                    top: '10px',
                                    left: '10px',
                                    background: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    zIndex: '10'
                                }}>
                                    {p.name} {videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === p.id ? ' (IST DRAN)' : ''}
                                </div>
                                <RemoteVideoPlayer stream={remoteStreams[p.id]} name={p.name} playerId={p.id} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {showWinnerPopup && <GameEndPopup winner={winner} countdown={10} onRematch={handleRematch} />}
            <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
        </div>
    );
}

// Export der Game-Komponente
export default Game;