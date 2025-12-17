import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import NumberPad from './NumberPad';
import GameChat from './GameChat';
import GameEndPopup from './GameEndPopup';
import BullOffModal from './BullOffModal';
import CheckoutPopup from './CheckoutPopup';
import DoubleAttemptsPopup from './DoubleAttemptsPopup'; // <--- NEU IMPORTIERT
import './Game.css';
import LiveStatistics from "./LiveStatistics";
import PlayerScores from "./PlayerScores";
import CricketBoard from "./CricketBoard";
import CricketHeader from "./CricketHeader";
import CricketInputPanel from "./CricketInputPanel";

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
// ROBUSTE Video Player für alle Browser
const RemoteVideoPlayer = ({ stream, name, playerId }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            try {
                videoRef.current.srcObject = stream;
            } catch (error) {
                try {
                    const mediaStream = new MediaStream();
                    stream.getTracks().forEach(track => {
                        mediaStream.addTrack(track);
                    });
                    videoRef.current.srcObject = mediaStream;
                } catch (fallbackError) {
                    console.error(`[RemoteVideoPlayer] Fallback Fehler:`, fallbackError);
                }
            }
            
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            videoRef.current.autoplay = true;
            videoRef.current.controls = false;
            videoRef.current.setAttribute('webkit-playsinline', 'true');
            videoRef.current.setAttribute('x-webkit-airplay', 'allow');

            const startVideo = () => {
                if (videoRef.current) {
                    const playPromise = videoRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            setTimeout(() => {
                                if (videoRef.current) {
                                    videoRef.current.play().catch(e => {});
                                }
                            }, 1000);
                        });
                    }
                }
            };

            setTimeout(startVideo, 100);
        } else if (!stream) {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }
    }, [stream, name, playerId]);

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
            <button
                onClick={(e) => {
                    const v = e.target.parentElement.querySelector('video');
                    if(v) v.muted = !v.muted;
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
    const [localGameStarted, setLocalGameStarted] = useState(false);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [turnEndTime, setTurnEndTime] = useState(null);
    const [isStartingGame, setIsStartingGame] = useState(false);
    const startGameTimeoutRef = useRef(null);

    const [startingPlayerId, setStartingPlayerId] = useState(null);
    const [showBullOffModal, setShowBullOffModal] = useState(false);
    const [bullOffModalShown, setBullOffModalShown] = useState(false);
    const [bullOffCompleted, setBullOffCompleted] = useState(false);
    
    const [localStream, setLocalStream] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);

    const [doubleAttemptsQuery, setDoubleAttemptsQuery] = useState(null);

    const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
    const [checkoutPlayer, setCheckoutPlayer] = useState(null);

    const [isSpectator, setIsSpectator] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const [showDebug, setShowDebug] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);
    const [videoLayout, setVideoLayout] = useState({
        mode: 'splitscreen',
        currentPlayerId: null
    });

    const [numpadState, setNumpadState] = useState({
        isLocked: false,
        canUndo: false,
        lockedPlayerId: null,
        lockTimer: null
    });
    
    const ignoreServerUntil = useRef(0);
    const expectedLocalScore = useRef(null);
    const localVideoRef = useRef(null);
    const peerConnections = useRef({});
    const iceCandidateQueue = useRef({});

    const refreshDevices = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const list = await navigator.mediaDevices.enumerateDevices();
            const v = list.filter(d => d.kind === 'videoinput');
            setDevices(v);
            stream.getTracks().forEach(track => track.stop());

            if (v.length > 0 && !selectedDeviceId) {
                setSelectedDeviceId(v[0].deviceId);
            }
        } catch(e) { 
            console.error("Geräte konnten nicht geladen werden:", e);
        }
    }, [selectedDeviceId]);

    useEffect(() => {
        if (!socket) return;
        const onConnect = () => {
            setUser(prev => ({ ...prev, id: socket.id }));
            setConnectionError(null);
            setIsLoading(false);
        };
        const onConnectError = (error) => {
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

    useEffect(() => {
        if (gameState && gameState.players && gameState.players.length >= 2 && !localGameStarted) {
            const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
            const opponentPlayer = gameState.players.find(p => p.id !== gameState.hostId);
            let initialStarterId = null;
            if (gameState.whoStarts === 'opponent' && opponentPlayer) {
                initialStarterId = opponentPlayer.id;
            } else if (gameState.whoStarts === 'me' && hostPlayer) {
                initialStarterId = hostPlayer.id;
            } else if (gameState.whoStarts === 'random') {
                initialStarterId = 'bull-off';
                if (!bullOffModalShown && !bullOffCompleted && gameState.players.length >= 2) {
                    setShowBullOffModal(true);
                    setBullOffModalShown(true);
                }
            } else {
                initialStarterId = hostPlayer?.id;
            }
            if (initialStarterId) {
                setStartingPlayerId(initialStarterId);
            }
        }
    }, [gameState?.whoStarts, gameState?.players, localGameStarted]);

    const getDefaultStartingPlayerId = useCallback(() => {
        if (!gameState?.players || gameState.players.length < 2) return null;
        const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
        const opponentPlayer = gameState.players.find(p => p.id !== gameState.hostId);
        if (gameState.whoStarts === 'opponent') return opponentPlayer?.id;
        else if (gameState.whoStarts === 'random') return 'bull-off';
        else return hostPlayer?.id;
    }, [gameState]);

    const handleGameState = useCallback((newState) => {
        if (!newState) return;
        
        setGameState(prev => {
            if (!prev) setTurnEndTime(null);

            if (newState.gameStatus === 'finished' && prev?.gameStatus !== 'finished') {
                setShowWinnerPopup(true);
            }

            if (newState.gameStatus === 'active' && prev?.gameStatus !== 'active') {
                setLocalGameStarted(true);
                setIsStartingGame(false);
                if (startGameTimeoutRef.current) {
                    clearTimeout(startGameTimeoutRef.current);
                    startGameTimeoutRef.current = null;
                }
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

            const currentPlayerIndex = newState.currentPlayerIndex !== undefined 
                ? newState.currentPlayerIndex 
                : (prev?.currentPlayerIndex || 0);
            
            const currentPlayer = updatedPlayers[currentPlayerIndex];
            const prevPlayerIndex = prev?.currentPlayerIndex;
            
            if (currentPlayer && user.id) {
                const newIsMyTurn = currentPlayer.id === user.id;
                setIsMyTurn(newIsMyTurn);

                if (newIsMyTurn && prevPlayerIndex !== currentPlayerIndex) {
                    setNumpadState(prev => ({
                        ...prev, isLocked: false, canUndo: false, lockedPlayerId: null
                    }));
                    setTurnEndTime(null);
                    if (numpadState.lockTimer) clearTimeout(numpadState.lockTimer);
                }

                if (newState.gameStatus === 'active' && prev?.gameStatus !== 'active' && newIsMyTurn) {
                    setNumpadState(prev => ({
                        ...prev, isLocked: false, canUndo: false, lockedPlayerId: null
                    }));
                    setTurnEndTime(null);
                    if (numpadState.lockTimer) clearTimeout(numpadState.lockTimer);
                }

                if (newState.mode === 'cricket' && newIsMyTurn) {
                    setNumpadState(prev => ({
                        ...prev, isLocked: false, canUndo: false, lockedPlayerId: null
                    }));
                }

                if (newState.gameStatus === 'active' && currentPlayer) {
                    setVideoLayout({
                        mode: 'fullscreen',
                        currentPlayerId: newIsMyTurn ? 'local' : currentPlayer.id
                    });
                } else if (newState.gameStatus === 'waiting' || !newState.gameStatus) {
                    setVideoLayout({ mode: 'splitscreen', currentPlayerId: null });
                }
            }

            if (newState.gameStatus === 'finished') {
                setVideoLayout({ mode: 'splitscreen', currentPlayerId: null });
            }

            // Hier wird das Abfrage-Objekt gesetzt
            if (newState.doubleAttemptsQuery) {
                setDoubleAttemptsQuery(newState.doubleAttemptsQuery);
            } else {
                setDoubleAttemptsQuery(null);
            }

            if (newState.checkoutQuery) {
                setCheckoutPlayer(newState.checkoutQuery.player);
                setShowCheckoutPopup(true);
            } else {
                setShowCheckoutPopup(false);
                setCheckoutPlayer(null);
            }

            return {
                ...(prev || {}),
                ...newState,
                players: updatedPlayers,
                gameStatus: newState.gameStatus || (prev?.gameStatus || 'waiting'),
                gameState: {
                    ...(prev?.gameState || {}),
                    ...(newState.gameState || {}),
                    currentPlayerIndex: currentPlayerIndex,
                    whoStarts: newState.whoStarts || prev?.whoStarts
                },
                currentPlayerIndex: currentPlayerIndex,
                whoStarts: newState.whoStarts || prev?.whoStarts
            };
        });
    }, [user.id]);

    const handleScoreInput = (scoreInput) => {
        if (!isMyTurn || numpadState.isLocked) return;
        const currentIndex = gameState?.currentPlayerIndex || 0;
        const currentPlayer = gameState?.players?.[currentIndex];
        if (!currentPlayer || !socket || !user?.id) return;

        let scorePayload;
        if (gameState.mode === 'cricket') {
            if (typeof scoreInput !== 'object' || scoreInput === null) return;
            scorePayload = scoreInput;
        } else {
            const points = parseInt(scoreInput, 10);
            if (isNaN(points)) return;
            scorePayload = points;
        }

        setLocalGameStarted(true);

        if (gameState.mode === 'cricket') {
            setNumpadState(prev => ({
                ...prev, isLocked: true, canUndo: true, lockedPlayerId: user.id
            }));
        } else {
            setNumpadState(prev => ({
                ...prev, isLocked: false, canUndo: true, lockedPlayerId: user.id
            }));
            if (numpadState.lockTimer) clearTimeout(numpadState.lockTimer);
            const lockTimer = setTimeout(() => {
                setNumpadState(prev => ({
                    ...prev, isLocked: false, canUndo: false, lockedPlayerId: null, lockTimer: null
                }));
            }, 5000);
            setNumpadState(prev => ({ ...prev, lockTimer }));
        }

        const payload = { roomId, userId: currentPlayer.id, score: scorePayload };
        socket.emit('score-input', payload);
    };

    const handleUndo = () => {
        if (socket && user.id && numpadState.canUndo && window.confirm("Undo?")) {
            ignoreServerUntil.current = 0;
            expectedLocalScore.current = null;
            socket.emit('undo', { roomId, userId: user.id });
            setNumpadState(prev => ({ ...prev, isLocked: true, canUndo: false, lockedPlayerId: null }));
            if (numpadState.lockTimer) clearTimeout(numpadState.lockTimer);
        }
    };

    const handleDoubleAttemptsResponse = (responseIndex) => {
        if (socket && doubleAttemptsQuery) {
            socket.emit('double-attempts-response', {
                roomId,
                userId: user.id,
                response: responseIndex,
                queryType: doubleAttemptsQuery.type,
                score: doubleAttemptsQuery.score,
                startScore: doubleAttemptsQuery.startScore
            });
            setDoubleAttemptsQuery(null);
        }
    };

    const handleCheckoutSelect = (dartCount) => {
        if (socket && checkoutPlayer) {
            socket.emit('checkout-selection', { roomId, dartCount });
            setShowCheckoutPopup(false);
            setCheckoutPlayer(null);
        }
    };

    useEffect(() => {
        if (!socket || !socket.connected) return;
        socket.on('game-state-update', handleGameState);
        socket.on('game-started', handleGameState);
        socket.on('gameState', handleGameState);
        socket.on('statusUpdate', handleGameState);
        socket.on('gameError', (error) => {
            alert('Spiel-Fehler: ' + error.error);
            setIsStartingGame(false);
            if (startGameTimeoutRef.current) clearTimeout(startGameTimeoutRef.current);
        });
        socket.on('joinedAsSpectator', () => setIsSpectator(true));
        socket.on('youHaveBeenKicked', (data) => {
            alert(data.message || 'Du wurdest aus dem Raum entfernt.');
            window.location.href = '/';
        });

        socket.emit('joinRoom', { roomId });
        socket.emit('getGameState', roomId);
        const poll = setInterval(() => { socket.emit('getGameState', roomId); }, 2500);

        return () => {
            clearInterval(poll);
            socket.off('game-state-update', handleGameState);
            socket.off('game-started', handleGameState);
            socket.off('gameState', handleGameState);
            socket.off('statusUpdate', handleGameState);
            socket.off('joinedAsSpectator');
            socket.off('youHaveBeenKicked');
        };
    }, [socket, roomId, handleGameState]);

    const startCamera = async (targetDeviceId) => {
        const idToUse = targetDeviceId || selectedDeviceId;
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: idToUse ? { deviceId: { exact: idToUse } } : true,
                audio: true
            });
        } catch (error) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: idToUse ? { deviceId: { exact: idToUse } } : true,
                    audio: false
                });
            } catch (videoError) {
                alert("Kamera konnte nicht gestartet werden.");
                return;
            }
        }
        if (stream) {
            setLocalStream(stream);
            setIsCameraEnabled(true);
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            await refreshDevices();
            Object.values(peerConnections.current).forEach(pc => {
                const senders = pc.getSenders();
                stream.getTracks().forEach(track => {
                    const sender = senders.find(s => s.track && s.track.kind === track.kind);
                    if (sender) sender.replaceTrack(track);
                    else pc.addTrack(track, stream);
                });
            });
            setTimeout(() => { autoConnectToOpponents(); }, 1000);
        }
    };

    const stopCamera = () => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            setIsCameraEnabled(false);
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
        }
    };

    const autoConnectToOpponents = useCallback(() => {
        if (!isCameraEnabled || !localStream || !gameState?.players) return;
        const opponents = gameState.players.filter(p => p.id !== user.id);
        if (opponents.length === 0) return;
        opponents.forEach((opponent, index) => {
            if (!peerConnections.current[opponent.id]) {
                setTimeout(() => { initiateCall(opponent.id); }, (index + 1) * 1000);
            }
        });
    }, [gameState?.players, user.id, isCameraEnabled, localStream]);

    useEffect(() => {
        if (gameState?.players && isCameraEnabled) {
            setTimeout(() => autoConnectToOpponents(), 2000);
        }
    }, [gameState?.players, isCameraEnabled, autoConnectToOpponents]);

    const processIceQueue = async (socketId, pc) => {
        if (iceCandidateQueue.current[socketId]) {
            for (const candidate of iceCandidateQueue.current[socketId]) {
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
            }
            delete iceCandidateQueue.current[socketId];
        }
    };

    const createPeerConnection = (targetSocketId) => {
        const rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        const pc = new RTCPeerConnection(rtcConfig);

        try {
            if (pc.addTransceiver) {
                pc.addTransceiver('video', { direction: 'sendrecv' });
                pc.addTransceiver('audio', { direction: 'sendrecv' });
            }
        } catch (error) {}

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('camera-ice', { candidate: event.candidate, to: targetSocketId, from: socket.id, roomId });
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams.length > 0) {
                setRemoteStreams(prev => ({ ...prev, [targetSocketId]: event.streams[0] }));
            } else if (event.track) {
                setRemoteStreams(prev => {
                    const existingStream = prev[targetSocketId];
                    if (existingStream) {
                        existingStream.addTrack(event.track);
                        return { ...prev, [targetSocketId]: existingStream };
                    } else {
                        return { ...prev, [targetSocketId]: new MediaStream([event.track]) };
                    }
                });
            }
        };

        const addLocalTracks = () => {
            if (localStream) {
                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            }
        };
        addLocalTracks();
        peerConnections.current[targetSocketId] = pc;
        return pc;
    };

    const initiateCall = async (targetUserId) => {
        if (!localStream) { alert("Bitte zuerst Kamera starten!"); return; }
        const pc = createPeerConnection(targetUserId);
        try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);
            if (socket) socket.emit('camera-offer', { offer, to: targetUserId, from: socket.id, roomId });
        } catch (e) { if (pc) pc.close(); }
    };

    useEffect(() => {
        if (!socket) return;
        socket.on('camera-offer', async (data) => {
            try {
                const pc = createPeerConnection(data.from);
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                await processIceQueue(data.from, pc);
                const answer = await pc.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(answer);
                socket.emit('camera-answer', { answer, to: data.from, from: socket.id, roomId });
            } catch (error) {}
        });
        socket.on('camera-answer', async (data) => {
            const pc = peerConnections.current[data.from];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                await processIceQueue(data.from, pc);
            }
        });
        socket.on('camera-ice', async (data) => {
            const pc = peerConnections.current[data.from];
            if (pc && pc.remoteDescription) {
                try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
            } else {
                if (!iceCandidateQueue.current[data.from]) iceCandidateQueue.current[data.from] = [];
                iceCandidateQueue.current[data.from].push(data.candidate);
            }
        });
        return () => { socket.off('camera-offer'); socket.off('camera-answer'); socket.off('camera-ice'); };
    }, [socket, localStream, roomId]);

    const handleStartGame = () => {
        if (!socket) return;
        setIsStartingGame(true);
        setNumpadState({ isLocked: false, canUndo: false, lockedPlayerId: null, lockTimer: null });
        setTurnEndTime(null);
        startGameTimeoutRef.current = setTimeout(() => { setIsStartingGame(false); }, 10000);

        const defaultStarter = getDefaultStartingPlayerId();
        let finalStartingPlayerId = startingPlayerId || defaultStarter;
        if (finalStartingPlayerId === 'bull-off') setShowBullOffModal(true);

        const payload = { roomId, userId: user.id, resetScores: true, startingPlayerId: finalStartingPlayerId };
        socket.emit('start-game', payload);

        if (user.id === finalStartingPlayerId) setVideoLayout({ mode: 'fullscreen', currentPlayerId: 'local' });
        else if (finalStartingPlayerId !== 'bull-off') setVideoLayout({ mode: 'fullscreen', currentPlayerId: finalStartingPlayerId });
    };

    const startRecording = async () => {
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { mediaSource: "screen" }, audio: true });
            mediaRecorderRef.current = new MediaRecorder(displayStream, { mimeType: 'video/webm' });
            recordedChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `Darts-Recording.webm`; a.click();
                displayStream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) { alert("Aufnahme fehlgeschlagen."); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); setIsRecording(false); }
    };

    if (!gameState || !gameState.players) {
        return <div className="game-container"><h2>Lade Spiel...</h2></div>;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isGameRunning = gameState.gameStatus === 'active';
    const isGameFinished = gameState.gameStatus === 'finished';
    const winner = gameState?.winner;
    const isHost = gameState.hostId === user.id;
    const canInput = !numpadState.isLocked;

    const handleRematch = () => {
        setShowWinnerPopup(false);
        setStartingPlayerId(null);
        if (socket) socket.emit('rematch', { roomId, userId: user.id });
    };

    const handleBullOffComplete = (winnerId) => {
        setShowBullOffModal(false); setBullOffModalShown(false); setIsStartingGame(false);
        if (startGameTimeoutRef.current) clearTimeout(startGameTimeoutRef.current);
        if (socket) socket.emit('start-game', { roomId, userId: user.id, resetScores: true, startingPlayerId: winnerId });
    };

    if (gameState.mode === 'cricket') {
        const opponents = gameState.players.filter(p => p.id !== user.id);
        const hasOpponent = opponents.length > 0;
        return (
            <div className="game-container">
                <div className="game-layout">
                    <div className="game-main-area">
                        <div style={{padding: '10px 20px', backgroundColor: '#111', borderBottom: '1px solid #222'}}>
                            <CricketHeader gameState={gameState} user={user} />
                        </div>
                        {isGameRunning && (
                            <div className={`game-status-bar ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
                                {isMyTurn ? 'DU BIST DRAN' : `${currentPlayer?.name} IST DRAN`}
                            </div>
                        )}
                        {(!isGameRunning && !isGameFinished) && (
                            <div className="ready-box" style={{backgroundColor: '#111'}}>
                                {gameState.players.length < 2 ? <h3 style={{color: '#888'}}>Warte auf Gegner...</h3> : (isHost ? <button onClick={handleStartGame} disabled={isStartingGame} className="start-game-button">SPIEL STARTEN 🎯</button> : <div className="waiting-message">Warte auf Host...</div>)}
                            </div>
                        )}
                        <div style={{ flex: 1, display: 'flex', padding: '15px', gap: '15px', overflowY: 'auto', minHeight: 0, backgroundColor: '#0f0f1a' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <CricketInputPanel onScoreInput={handleScoreInput} isActive={isMyTurn && !numpadState.isLocked} isLocked={!isMyTurn || numpadState.isLocked} canUseUndo={numpadState.canUndo} onUndo={handleUndo} dartsThrownInTurn={gameState.dartsThrownInTurn || 0} />
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                                <CricketBoard gameState={gameState} user={user} />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <GameChat socket={socket} roomId={roomId} user={user} messages={gameState.chatMessages || []} />
                            </div>
                        </div>
                    </div>
                    <div className="camera-column">
                        <div className="camera-controls">
                            <select value={selectedDeviceId} onChange={e => { setSelectedDeviceId(e.target.value); if(isCameraEnabled) startCamera(e.target.value); }}>
                                {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Kamera"}</option>)}
                            </select>
                            <button onClick={() => isCameraEnabled ? stopCamera() : startCamera(selectedDeviceId)}>{isCameraEnabled ? "📹 Stop" : "📹 Start"}</button>
                        </div>
                        <div className="video-container">
                            {isCameraEnabled && <div className="video-player local"><div className="video-label">DU</div><video ref={localVideoRef} autoPlay muted playsInline style={{width: '100%', height: '100%', objectFit: 'cover'}} /></div>}
                            {hasOpponent ? <div className="video-player remote"><RemoteVideoPlayer stream={remoteStreams[opponents[0].id]} name={opponents[0].name} playerId={opponents[0].id} /></div> : <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', flexDirection: 'column', background: '#000', flex: 1}}><div>📷</div><div>Warte auf Gegner Video...</div></div>}
                        </div>
                    </div>
                </div>
                {showWinnerPopup && <GameEndPopup winner={winner} countdown={10} onRematch={handleRematch} />}
                {showBullOffModal && <BullOffModal isOpen={showBullOffModal} onClose={() => setShowBullOffModal(false)} players={gameState.players} onBullOffComplete={handleBullOffComplete} socket={socket} roomId={roomId} user={user} />}
            </div>
        );
    }

    return (
        <div className="game-container">
            {isSpectator && <div className="spectator-banner">Zuschauer</div>}
            <div className="game-layout">
                <div className="game-main-area">
                    <PlayerScores gameState={gameState} user={user} />
                    {isGameRunning && (
                        <div className={`game-status-bar ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
                            <div className="status-text">{isMyTurn ? 'DU BIST DRAN' : `${currentPlayer?.name} IST DRAN`}</div>
                        </div>
                    )}
                    {(!isGameRunning && !isGameFinished) && (
                        <div className="ready-box">
                            <div className="ready-status">{gameState.players.length < 2 ? "Warte auf Gegner..." : "Bereit zum Start"}</div>
                            {isHost && !isSpectator ? <button className="start-game-button" onClick={handleStartGame} disabled={isStartingGame}>SPIEL STARTEN 🎯</button> : <div className="waiting-message">Warte auf Host...</div>}
                        </div>
                    )}
                    <div className="game-bottom-section">
                        <div className="game-column-left">
                            {!isSpectator && (
                                <div className="wurf-section">
                                    <h3 className="wurf-title">{isMyTurn ? 'DEIN WURF' : `${currentPlayer?.name.toUpperCase()} WIRFT`}</h3>
                                    <div className="number-pad-container">
                                        <div className="number-pad-wrapper">
                                            <NumberPad onScoreInput={handleScoreInput} onUndo={handleUndo} checkoutSuggestions={gameState.checkoutSuggestions} isActive={isMyTurn && canInput} isLocked={!isMyTurn || numpadState.isLocked} isOpponentLocked={!isMyTurn} isMyTurn={isMyTurn} canUseUndo={numpadState.canUndo} gameRunning={isGameRunning} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="game-column-center"><div className="statistics-section"><LiveStatistics gameState={gameState} /></div></div>
                        <div className="game-column-right"><div className="game-chat-container"><GameChat socket={socket} roomId={roomId} user={user} messages={gameState.chatMessages || []} /></div></div>
                    </div>
                </div>
                <div className="camera-column">
                    <div className="camera-controls">
                        <select value={selectedDeviceId} onChange={e => { setSelectedDeviceId(e.target.value); if(isCameraEnabled) startCamera(e.target.value); }}>
                            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Kamera"}</option>)}
                        </select>
                        <button onClick={() => isCameraEnabled ? stopCamera() : startCamera(selectedDeviceId)}>{isCameraEnabled ? "📹 Stop" : "📹 Start"}</button>
                        <button onClick={() => autoConnectToOpponents()} style={{marginLeft: '10px', padding: '5px 10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px'}}>🔌 Verbinden</button>
                    </div>
                    <div className="video-container" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                        <div className="video-player local" style={{
                            height: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === 'local' ? '100%' : '200px',
                            flex: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === 'local' ? 'none' : '1',
                            display: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId !== 'local' ? 'none' : 'flex',
                            border: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === 'local' ? '3px solid #4CAF50' : '1px solid #555'
                        }}>
                            <div className="video-label">Du</div>
                            <video ref={localVideoRef} autoPlay muted playsInline style={{width:'100%', height:'100%', objectFit: 'cover', backgroundColor: '#000'}} />
                        </div>
                        {gameState.players.filter(p => p.id !== user.id).map(p => (
                            <div key={p.id} className="video-player remote" style={{
                                height: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === p.id ? '100%' : '200px',
                                flex: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === p.id ? 'none' : '1',
                                display: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId !== p.id ? 'none' : 'flex',
                                border: videoLayout.mode === 'fullscreen' && videoLayout.currentPlayerId === p.id ? '3px solid #4CAF50' : '1px solid #555'
                            }}>
                                <div className="video-label">{p.name}</div>
                                <RemoteVideoPlayer stream={remoteStreams[p.id]} name={p.name} playerId={p.id} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- HIER SIND DIE POPUPS --- */}
            
            {/* 1. Double Attempts Popup (Neu) */}
            {doubleAttemptsQuery && doubleAttemptsQuery.playerId === user.id && (
                <DoubleAttemptsPopup 
                    query={doubleAttemptsQuery} 
                    onSelect={handleDoubleAttemptsResponse} 
                />
            )}

            {/* 2. Checkout Popup */}
            <CheckoutPopup
                isActive={showCheckoutPopup}
                onSelect={handleCheckoutSelect}
                user={user}
                checkoutPlayer={checkoutPlayer}
            />

            {/* 3. Game End / Bull Off */}
            {showWinnerPopup && <GameEndPopup winner={winner} countdown={10} onRematch={handleRematch} />}
            {showBullOffModal && <BullOffModal isOpen={showBullOffModal} onClose={() => setShowBullOffModal(false)} players={gameState.players} onBullOffComplete={handleBullOffComplete} socket={socket} roomId={roomId} user={user} />}
        </div>
    );
}

export default Game;