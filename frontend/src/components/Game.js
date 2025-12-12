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
const getCheckoutText = (score) => {
    if (score === undefined || score === null) return "";
    if (score > 170 || score < 2) return ""; // No checkout possible

    const checkouts = {
        170: "T20 T20 BULL",
        167: "T20 T19 BULL",
        164: "T20 T18 BULL",
        161: "T20 T17 BULL",
        160: "T20 T20 D20",
        158: "T20 T20 D19",
        157: "T19 T20 D20",
        156: "T20 T20 D18",
        155: "T20 T19 D20",
        154: "T20 T18 D20",
        153: "T20 T19 D18",
        152: "T20 T20 D16",
        151: "T20 T17 D20",
        150: "T20 T18 D18",
        149: "T20 T19 D16",
        148: "T20 T16 D20",
        147: "T19 T18 D18",
        146: "T20 T14 D20",
        145: "T20 T15 D20",
        144: "T20 T20 D12",
        143: "T20 T17 D16",
        142: "T20 T14 D20",
        141: "T20 T19 D12",
        140: "T20 T20 D10",
        139: "T19 T14 D20",
        138: "T20 T18 D12",
        137: "T19 T16 D16",
        136: "T20 T20 D8",
        135: "T20 T15 D15",
        134: "T20 T14 D16",
        133: "T20 T19 D8",
        132: "T20 T20 D6",
        131: "T20 T13 D16",
        130: "T20 T20 D5",
        129: "T19 T16 D12",
        128: "T20 T20 D4",
        127: "T20 T17 D8",
        126: "T19 T19 D6",
        125: "T20 T15 D10",
        124: "T20 T16 D8",
        123: "T19 T14 D12",
        122: "T18 T20 D4",
        121: "T20 T15 D8",
        120: "T20 20 D20",
        119: "T19 12 D20",
        118: "T20 18 D20",
        117: "T20 17 D20",
        116: "T20 16 D20",
        115: "T20 15 D20",
        114: "T20 14 D20",
        113: "T20 13 D20",
        112: "T20 12 D20",
        111: "T20 11 D20",
        110: "T20 10 D20",
        109: "T19 12 D20",
        108: "T20 8 D20",
        107: "T19 10 D20",
        106: "T20 6 D20",
        105: "T20 5 D20",
        104: "T18 10 D20",
        103: "T19 6 D20",
        102: "T20 2 D20",
        101: "T17 10 D20",
        100: "T20 D20",
        99: "T19 10 D16",
        98: "T20 D19",
        97: "T19 D20",
        96: "T20 D18",
        95: "T19 D19",
        94: "T18 D20",
        93: "T19 D18",
        92: "T20 D16",
        91: "T17 D20",
        90: "T18 D18",
        89: "T19 D16",
        88: "T16 D20",
        87: "T17 D18",
        86: "T18 D16",
        85: "T15 D20",
        84: "T20 D12",
        83: "T17 D16",
        82: "T14 D20",
        81: "T19 D12",
        80: "T20 D10",
        79: "T13 D20",
        78: "T18 D12",
        77: "T19 D10",
        76: "T20 D8",
        75: "T17 D12",
        74: "T14 D16",
        73: "T19 D8",
        72: "T12 D18",
        71: "T13 D16",
        70: "T10 D20",
        69: "T19 D6",
        68: "T20 D4",
        67: "T17 D8",
        66: "T10 D18",
        65: "T19 D4",
        64: "T16 D8",
        63: "T13 D12",
        62: "T10 D16",
        61: "T15 D8",
        60: "20 D20",
        59: "19 D20",
        58: "18 D20",
        57: "17 D20",
        56: "16 D20",
        55: "15 D20",
        54: "14 D20",
        53: "13 D20",
        52: "12 D20",
        51: "11 D20",
        50: "10 D20",
        49: "9 D20",
        48: "8 D20",
        47: "7 D20",
        46: "6 D20",
        45: "5 D20",
        44: "4 D20",
        43: "3 D20",
        42: "2 D20",
        41: "1 D20",
        40: "D20",
        39: "7 D16",
        38: "D19",
        37: "5 D16",
        36: "D18",
        35: "3 D16",
        34: "D17",
        33: "1 D16",
        32: "D16",
        31: "15 D8",
        30: "D15",
        29: "13 D8",
        28: "D14",
        27: "19 D4",
        26: "D13",
        25: "17 D4",
        24: "D12",
        23: "7 D8",
        22: "D11",
        21: "13 D4",
        20: "D10",
        19: "11 D4",
        18: "D9",
        17: "9 D4",
        16: "D8",
        15: "7 D4",
        14: "D7",
        13: "5 D4",
        12: "D6",
        11: "3 D4",
        10: "D5",
        9: "1 D4",
        8: "D4",
        7: "S3 D2",
        6: "D3",
        5: "S1 D2",
        4: "D2",
        3: "S1 D1",
        2: "D1"
    };

    return checkouts[score] || "";
};

// --- COMPONENTS ---
const GameInfoBar = ({ currentPlayer, isMyTurn }) => {
    if (!currentPlayer) return <div style={{padding:'20px', textAlign:'center', color:'#666'}}>Lade...</div>;
    const styles = {
        container: {
            width: '100%', padding: '15px 25px', background: 'linear-gradient(90deg, #1f1f2e, #252535)',
            borderBottom: '1px solid #444', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderLeft: `5px solid ${isMyTurn ? '#4CAF50' : '#d9534f'}`,
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)', marginBottom: '10px', minHeight: '80px'
        },
        left: { display: 'flex', flexDirection: 'column' },
        label: { fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' },
        player: { fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' },
        right: { textAlign: 'right' },
        finishLabel: { fontSize: '0.8rem', color: '#ffd700', fontWeight: 'bold', textTransform: 'uppercase' },
        checkout: { fontSize: '1.3rem', color: '#ccc', fontFamily: 'monospace', fontWeight: 'bold' }
    };
    const checkoutText = getCheckoutText(currentPlayer.score);
    return (
        <div style={styles.container}>
            <div style={styles.left}><span style={styles.label}>Am Wurf</span><span style={styles.player}>{currentPlayer.name}</span></div>
            {checkoutText && (
                <div style={styles.right}>
                    <span style={styles.finishLabel}>Finish Weg</span>
                    <div style={styles.checkout}>{checkoutText}</div>
                </div>
            )}
        </div>
    );
};


// Erweiterter Video Player (Startet Muted um Autoplay-Blockaden zu verhindern)
const RemoteVideoPlayer = ({ stream, name }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            // WICHTIG: Muted setzen, sonst blockiert Chrome Autoplay!
            videoRef.current.muted = true;

            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error(`[VIDEO] Autoplay Fehler bei ${name}:`, error);
                });
            }
        }
    }, [stream, name]);

    return (
        <div className="remote-video-wrapper" style={{position: 'relative', width: '100%', height: '100%'}}>
            <div className="video-label">{name}</div>
            <video
                ref={videoRef}
                playsInline
                autoPlay
                muted // Standardmäßig stumm
                style={{width:'100%', height:'100%', objectFit: 'contain', backgroundColor: '#222'}}
            />
            {/* Unmute Button Overlay */}
            <button
                onClick={(e) => {
                    const v = e.target.parentElement.querySelector('video');
                    if(v) v.muted = !v.muted;
                }}
                style={{position:'absolute', bottom:5, right:5, fontSize:'0.8em', opacity:0.7}}
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
    
    // Video / Camera State
    const [videoLayout, setVideoLayout] = useState({
        flexDirection: 'column',
        localHeight: '50%',
        remoteHeight: '50%',
        localVisible: true,
        remoteVisible: true
    });
    // Immer remoteVisible true setzen
    useEffect(() => {
        setVideoLayout(prev => ({ ...prev, remoteVisible: true }));
    }, []);
    const [opponentLocked, setOpponentLocked] = useState(false);
    const [canUseUndo, setCanUseUndo] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [fullscreenVideoId, setFullscreenVideoId] = useState(null);
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);
    
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

                // Vollbild setzen basierend auf aktuellem Spieler
                if (gameStarted && currentPlayer) {
                    // Setze Vollbild für den aktuellen Spieler, egal ob lokal oder Gegner
                    setFullscreenVideoId(newIsMyTurn ? 'local' : currentPlayer.id);
                } else if (!gameStarted) {
                    setFullscreenVideoId(null);
                }
            }

            // Wenn Spiel endet, Vollbild verlassen
            if (newState.gameStatus === 'finished') {
                setFullscreenVideoId(null);
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
        console.log("Erstelle PeerConnection zu:", targetSocketId);
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        // WICHTIG: Transceiver erzwingen (Video empfangen, auch wenn wir keins senden)
        pc.addTransceiver('video', { direction: 'sendrecv' });
        pc.addTransceiver('audio', { direction: 'sendrecv' });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('camera-ice', {
                    candidate: event.candidate,
                    to: targetSocketId,
                    from: socket.id,
                    roomId
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`Stream von ${targetSocketId} empfangen:`, event.streams[0]);
            setRemoteStreams(prev => ({
                ...prev,
                [targetSocketId]: event.streams[0]
            }));
        };

        if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        peerConnections.current[targetSocketId] = pc;
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
        // Wenn Host startet, seine Cam in Vollbild
        if (user.id === gameState?.hostId) {
            setFullscreenVideoId('local');
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

    let playerForInfoBar = currentPlayer;
    // When the game is finished, the "current player" is the winner. 
    // For the info bar, we want to show the checkout of the other player (the loser).
    if (isGameFinished) {
        playerForInfoBar = winner && gameState.players.find(p => p.id !== winner.id);
    }
    
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
                    {(!isGameRunning && !isGameFinished) ? (
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
                    ) : (
                        // Show info bar if game is running OR finished
                        <GameInfoBar currentPlayer={playerForInfoBar} isMyTurn={isMyTurn} />
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
                        <button onClick={() => isCameraEnabled ? stopCamera() : startCamera(selectedDeviceId)}>{isCameraEnabled ? "Stop" : "Start"}</button>
                        <button onClick={() => gameState.players.forEach(p => { if(p.id !== user.id) initiateCall(p.id); })} style={{ marginLeft: '10px', padding: '5px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>🔌 Verbinden</button>
                    </div>
                    <div className="video-container" style={{ flexDirection: videoLayout.flexDirection }}>
                        <div className="video-player local" style={{
                            height: fullscreenVideoId === 'local' ? '100%' : videoLayout.localHeight,
                            flex: fullscreenVideoId === 'local' ? 'none' : '1',
                            display: (fullscreenVideoId === 'local' || videoLayout.localVisible) ? 'flex' : 'none'
                        }}>
                            <div className="video-label">Du</div>
                            <video ref={localVideoRef} autoPlay muted playsInline style={{width:'100%', height:'100%', objectFit: 'cover'}} />
                        </div>
                        {gameState.players.filter(p => p.id !== user.id).map(p => (
                            <div key={p.id} className="video-player remote" style={{
                                height: fullscreenVideoId === p.id ? '100%' : videoLayout.remoteHeight,
                                flex: fullscreenVideoId === p.id ? 'none' : '1',
                                display: (fullscreenVideoId === p.id || videoLayout.remoteVisible) ? 'flex' : 'none'
                            }}>
                                <RemoteVideoPlayer stream={remoteStreams[p.id]} name={p.name} />
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