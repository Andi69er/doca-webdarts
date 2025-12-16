import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import NumberPad from './NumberPad';
import GameChat from './GameChat';
import GameEndPopup from './GameEndPopup';
import BullOffModal from './BullOffModal';
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
        console.log(`[RemoteVideoPlayer] ${name} (${playerId}) - Stream verfügbar:`, !!stream);
        console.log(`[RemoteVideoPlayer] ${name} - Stream Details:`, stream);
        console.log(`[RemoteVideoPlayer] ${name} - VideoRef:`, videoRef.current);
        
        if (videoRef.current && stream) {
            console.log(`[RemoteVideoPlayer] ${name} - Setze Stream auf Video Element`);
            
            // ROBUSTE Stream-Behandlung
            try {
                // Methode 1: Standard srcObject
                videoRef.current.srcObject = stream;
                console.log(`[RemoteVideoPlayer] ${name} - ✅ srcObject gesetzt`);
            } catch (error) {
                console.error(`[RemoteVideoPlayer] ${name} - ❌ srcObject Fehler:`, error);
                
                // Methode 2: Fallback - Tracks einzeln hinzufügen
                try {
                    const mediaStream = new MediaStream();
                    stream.getTracks().forEach(track => {
                        mediaStream.addTrack(track);
                    });
                    videoRef.current.srcObject = mediaStream;
                    console.log(`[RemoteVideoPlayer] ${name} - ✅ Fallback Stream erstellt`);
                } catch (fallbackError) {
                    console.error(`[RemoteVideoPlayer] ${name} - ❌ Fallback Fehler:`, fallbackError);
                }
            }
            
            // ROBUSTE Video-Eigenschaften
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            videoRef.current.autoplay = true;
            videoRef.current.controls = false;
            videoRef.current.setAttribute('webkit-playsinline', 'true');
            videoRef.current.setAttribute('x-webkit-airplay', 'allow');

            // ROBUSTE Event-Handler
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
                console.error(`[RemoteVideoPlayer] ${name} - Video Error Details:`, videoRef.current.error);
            };

            const handleLoadStart = () => {
                console.log(`[RemoteVideoPlayer] ${name} - 🔄 Video Load Start`);
            };

            const handleAbort = () => {
                console.log(`[RemoteVideoPlayer] ${name} - ⚠️ Video Load Abort`);
            };

            // Event-Listener hinzufügen
            videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoRef.current.addEventListener('canplay', handleCanPlay);
            videoRef.current.addEventListener('play', handlePlay);
            videoRef.current.addEventListener('error', handleError);
            videoRef.current.addEventListener('loadstart', handleLoadStart);
            videoRef.current.addEventListener('abort', handleAbort);

            // ROBUSTE Video-Start-Funktion
            const startVideo = () => {
                if (videoRef.current) {
                    const playPromise = videoRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            console.log(`[RemoteVideoPlayer] ${name} - ✅ Video erfolgreich gestartet`);
                        }).catch(error => {
                            console.error(`[RemoteVideoPlayer] ${name} - ❌ Autoplay Fehler:`, error);
                            
                            // Fallback: Versuche nach kurzer Verzögerung erneut
                            setTimeout(() => {
                                if (videoRef.current) {
                                    videoRef.current.play().catch(e => {
                                        console.error(`[RemoteVideoPlayer] ${name} - ❌ Retry Fehler:`, e);
                                    });
                                }
                            }, 1000);
                        });
                    }
                }
            };

// Video mit Verzögerung starten für bessere Browser-Kompatibilität
            setTimeout(startVideo, 100);
            
            // Cleanup
            return () => {
                if (videoRef.current) {
                    videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    videoRef.current.removeEventListener('canplay', handleCanPlay);
                    videoRef.current.removeEventListener('play', handlePlay);
                    videoRef.current.removeEventListener('error', handleError);
                    videoRef.current.removeEventListener('loadstart', handleLoadStart);
                    videoRef.current.removeEventListener('abort', handleAbort);
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
    const [localGameStarted, setLocalGameStarted] = useState(false);
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [turnEndTime, setTurnEndTime] = useState(null);

    // NEU: State für Startspieler-Auswahl
    const [startingPlayerId, setStartingPlayerId] = useState(null);
    const [showBullOffModal, setShowBullOffModal] = useState(false);
    const [bullOffModalShown, setBullOffModalShown] = useState(false);
    const [bullOffCompleted, setBullOffCompleted] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    
    // Video / Camera State - Vereinfacht
    const [localStream, setLocalStream] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);

    // Doppelquote-Abfrage State
    const [doubleAttemptsQuery, setDoubleAttemptsQuery] = useState(null);

    // Spectator state
    const [isSpectator, setIsSpectator] = useState(false);

    // NEU: State für die Aufnahme
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    // Video Layout State
    const [videoLayout, setVideoLayout] = useState({
        mode: 'splitscreen', // 'splitscreen' oder 'fullscreen'
        currentPlayerId: null
    });

    // Nummernpad-Sperrlogik - VEREINFACHT
    const [numpadState, setNumpadState] = useState({
        isLocked: true,        // Nummernpad gesperrt/entsperrt
        canUndo: false,        // Undo möglich
        lockedPlayerId: null,  // Wer ist gesperrt
        lockTimer: null        // Timer für automatische Entsperrung
    });
    
    // Refs
    const ignoreServerUntil = useRef(0);
    const expectedLocalScore = useRef(null);
    const localVideoRef = useRef(null);
    const peerConnections = useRef({});
    const iceCandidateQueue = useRef({}); // WICHTIG: Puffer für zu frühe Candidates

// Callbacks - Device Enumeration
    const refreshDevices = useCallback(async () => {
        try {
            // Um Labels zu bekommen, MÜSSEN wir kurz einen Stream anfragen. Wenn die Berechtigung schon da ist, passiert das ohne User-Interaktion.
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const list = await navigator.mediaDevices.enumerateDevices();
            const v = list.filter(d => d.kind === 'videoinput');
            setDevices(v);
            // WICHTIG: Temporären Stream sofort wieder stoppen, damit die Kamera-LED ausgeht.
            stream.getTracks().forEach(track => track.stop());

            // Setze das erste Gerät als Standard, falls noch keins ausgewählt ist.
            if (v.length > 0 && !selectedDeviceId) {
                setSelectedDeviceId(v[0].deviceId);
            }
        } catch(e) { 
            console.error("Geräte konnten nicht geladen werden:", e);
            alert("Kamera-Zugriff wurde verweigert. Die Kamera-Funktionen sind deaktiviert.");
        }
    }, [selectedDeviceId]); // Dependency bleibt, um bei manueller Auswahl neu laden zu können.

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

// Initialisiere startingPlayerId basierend auf Lobby-Einstellung, solange das Spiel nicht läuft
    useEffect(() => {
        if (gameState && gameState.players && gameState.players.length >= 2 && !localGameStarted) {
            const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
            const opponentPlayer = gameState.players.find(p => p.id !== gameState.hostId);
            
            let initialStarterId = null;
            if (gameState.whoStarts === 'opponent' && opponentPlayer) {
                // Wenn "Gegner" ausgewählt ist, soll der Gegner als Startspieler markiert werden
                initialStarterId = opponentPlayer.id;
            } else if (gameState.whoStarts === 'me' && hostPlayer) {
                // Wenn "Ich" ausgewählt ist, soll der Host (Ersteller) als Startspieler markiert werden
                initialStarterId = hostPlayer.id;
            } else if (gameState.whoStarts === 'random') {
                initialStarterId = 'bull-off'; // Zeige Ausbullen an
                // Wenn "Ausbullen" ausgewählt ist, zeige das Modal automatisch bei BEIDEN Spielern
                // Aber nur beim ersten Mal, nicht nach Abbrechen oder erfolgreichem Ausbullen
                if (!bullOffModalShown && !bullOffCompleted && gameState.players.length >= 2) {
                    setShowBullOffModal(true);
                    setBullOffModalShown(true);
                }
            } else {
                // Standard: Host beginnt
                initialStarterId = hostPlayer?.id;
            }
            
            // IMMER aktualisieren wenn sich whoStarts ändert, nicht nur beim ersten Mal
            if (initialStarterId) {
                setStartingPlayerId(initialStarterId);
            }
        }
    }, [gameState?.whoStarts, gameState?.players, localGameStarted]);

    // Funktion um Standard-Startspieler basierend auf Lobby-Einstellung ZUR ANZEIGE zu berechnen
    // Diese Funktion gibt die ID oder den String 'bull-off' zurück.
    const getDefaultStartingPlayerId = useCallback(() => {
        if (!gameState?.players || gameState.players.length < 2) return null;
        const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
        const opponentPlayer = gameState.players.find(p => p.id !== gameState.hostId);

        if (gameState.whoStarts === 'opponent') {
            return opponentPlayer?.id;
        } else if (gameState.whoStarts === 'random') {
            return 'bull-off';
        } else {
            // 'me' oder undefined → Host beginnt
            return hostPlayer?.id;
        }
    }, [gameState]);


    // Game State Handling
    const handleGameState = useCallback((newState) => {
        if (!newState) return;
        
const currentIndex = newState.currentPlayerIndex !== undefined 
            ? newState.currentPlayerIndex 
            : 0;
        
setGameState(prev => {
            if (!prev) {
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

const currentPlayerIndex = newState.currentPlayerIndex !== undefined 
                ? newState.currentPlayerIndex 
                : (prev?.currentPlayerIndex || 0);
            
            const currentPlayer = updatedPlayers[currentPlayerIndex];
            const prevPlayerIndex = prev?.currentPlayerIndex;
            
            // WICHTIG: Lockout nur aufheben wenn Spielerwechsel stattgefunden hat
            if (currentPlayer && user.id) {
                const newIsMyTurn = currentPlayer.id === user.id;
                setIsMyTurn(newIsMyTurn);

// Wenn ich jetzt dran bin und vorher nicht, dann Nummernpad entsperren
                if (newIsMyTurn && prevPlayerIndex !== currentPlayerIndex) {
                    setNumpadState(prev => ({
                        ...prev,
                        isLocked: false,
                        canUndo: false,
                        lockedPlayerId: null
                    }));
                    setTurnEndTime(null);
                    if (numpadState.lockTimer) {
                        clearTimeout(numpadState.lockTimer);
                    }
                }

// Für Cricket: Immer entsperren wenn ich dran bin (auch nach eigenem Wurf)
                if (newState.mode === 'cricket' && newIsMyTurn) {
                    setNumpadState(prev => ({
                        ...prev,
                        isLocked: false,
                        canUndo: false,
                        lockedPlayerId: null
                    }));
                }

// Video Layout setzen basierend auf Spielphase
                if (newState.gameStatus === 'active' && currentPlayer) {
                    // Spiel läuft: Aktueller Spieler in Vollbild
                    setVideoLayout({
                        mode: 'fullscreen',
                        currentPlayerId: newIsMyTurn ? 'local' : currentPlayer.id
                    });
                } else if (newState.gameStatus === 'waiting' || !newState.gameStatus) {
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

            // Doppelquote-Abfrage verarbeiten
            if (newState.doubleAttemptsQuery) {
                setDoubleAttemptsQuery(newState.doubleAttemptsQuery);
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
                    whoStarts: newState.whoStarts || prev?.whoStarts  // WICHTIG: whoStarts erhalten
                },
                currentPlayerIndex: currentPlayerIndex,
                whoStarts: newState.whoStarts || prev?.whoStarts  // whoStarts auch auf oberster Ebene
            };
        });
    }, []);

    const handleScoreInput = (scoreInput) => {
        if (!isMyTurn || numpadState.isLocked) return;
        const currentIndex = gameState?.currentPlayerIndex || 0;
        const currentPlayer = gameState?.players?.[currentIndex];
        if (!currentPlayer || !socket || !user?.id) return;

        let scorePayload;

        if (gameState.mode === 'cricket') {
            // For Cricket, scoreInput is an object like { number: 20, multiplier: 3 }
            if (typeof scoreInput !== 'object' || scoreInput === null) {
                console.error("Invalid score input for Cricket:", scoreInput);
                return;
            }
            scorePayload = scoreInput;
        } else {
            // For X01, scoreInput is a number
            const points = parseInt(scoreInput, 10);
            if (isNaN(points)) {
                console.error("Invalid score input for X01:", scoreInput);
                return;
            }
            scorePayload = points;
        }

        setLocalGameStarted(true);

        // Lock input for Cricket games to prevent rapid successive inputs
        if (gameState.mode === 'cricket') {
            // For Cricket, allow undo for the last dart of the turn
            setNumpadState(prev => ({
                ...prev,
                isLocked: true, // Lock to prevent rapid inputs
                canUndo: true,  // Allow undo
                lockedPlayerId: user.id
            }));

            // Unlock after server response (will be unlocked when game-state-update is received)
        } else {
            // For X01, allow undo for 5 seconds
            setNumpadState(prev => ({
                ...prev, // NumpadState for X01
                isLocked: false,
                canUndo: true,
                lockedPlayerId: user.id
            }));

            if (numpadState.lockTimer) {
                clearTimeout(numpadState.lockTimer);
            }

            const lockTimer = setTimeout(() => {
                setNumpadState(prev => ({
                    ...prev,
                    isLocked: false,
                    canUndo: false,
                    lockedPlayerId: null,
                    lockTimer: null
                }));
            }, 5000); // 5 seconds

            setNumpadState(prev => ({ ...prev, lockTimer }));
        }

        const payload = {
            roomId,
            userId: currentPlayer.id,
            score: scorePayload
        };

        console.log("Emitting score-input with payload:", payload);
        socket.emit('score-input', payload);
    };

    const handleUndo = () => {
        if (socket && user.id && numpadState.canUndo && window.confirm("Undo?")) {
            ignoreServerUntil.current = 0;
            expectedLocalScore.current = null;
            socket.emit('undo', { roomId, userId: user.id });

            // Nach Undo: Nummernpad sofort sperren
            setNumpadState(prev => ({
                ...prev,
                isLocked: true,
                canUndo: false,
                lockedPlayerId: null
            }));

            if (numpadState.lockTimer) {
                clearTimeout(numpadState.lockTimer);
            }
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

    useEffect(() => {
        if (!socket) return;

        socket.on('game-state-update', handleGameState);
        socket.on('game-started', handleGameState);
        socket.on('gameState', handleGameState);
        socket.on('statusUpdate', handleGameState);

        socket.on('joinedAsSpectator', () => {
            console.log("Als Zuschauer beigetreten.");
            setIsSpectator(true);
        });

        socket.on('youHaveBeenKicked', (data) => {
            alert(data.message || 'Du wurdest aus dem Raum entfernt.');
            window.location.href = '/'; // Redirect to lobby
        });

        socket.emit('joinRoom', { roomId });
        socket.emit('getGameState', roomId);

        const poll = setInterval(() => socket.emit('getGameState', roomId), 2500);
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

    // --- KAMERA & WEBRTC LOGIK ---

    const startCamera = async (targetDeviceId) => {
        const idToUse = targetDeviceId || selectedDeviceId;
        console.log("Starte Kamera mit ID:", idToUse);
        
        let stream = null;
    
        try {
            const constraints = {
                video: idToUse ? { deviceId: { exact: idToUse } } : true,
                audio: true
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.warn("Fehler beim Anfordern von Video+Audio, versuche nur Video:", error);
            try {
                const constraints = {
                    video: idToUse ? { deviceId: { exact: idToUse } } : true,
                    audio: false // Fallback ohne Audio
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (videoError) {
                console.error("Kamera konnte nicht gestartet werden:", videoError);
                alert("Kamera konnte nicht gestartet werden. Bitte prüfe die Berechtigungen in deinem Browser.");
                return; // Wichtig: hier abbrechen
            }
        }
    
        if (stream) {
            setLocalStream(stream);
            setIsCameraEnabled(true);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            // WICHTIG: Nach erfolgreichem Stream-Start die Geräteliste aktualisieren
            await refreshDevices();

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

    // ROBUSTE automatische Verbindung mit allen Gegnern
    const autoConnectToOpponents = useCallback(() => {
        console.log(`[AutoConnect] 🔄 Versuche automatische Verbindung...`);
        console.log(`[AutoConnect] localStream:`, !!localStream);
        console.log(`[AutoConnect] isCameraEnabled:`, isCameraEnabled);
        console.log(`[AutoConnect] gameState.players:`, !!gameState?.players);
        console.log(`[AutoConnect] user.id:`, user.id);
        
        // WICHTIG: Nur verbinden wenn Kamera bereits aktiviert ist
        if (!isCameraEnabled || !localStream) {
            console.log(`[AutoConnect] ❌ Übersprungen - Kamera nicht aktiviert`);
            return;
        }
        
        if (!gameState?.players) {
            console.log(`[AutoConnect] ❌ Übersprungen - keine Spieler`);
            return;
        }
        
        const opponents = gameState.players.filter(p => p.id !== user.id);
        console.log(`[AutoConnect] Gegner gefunden:`, opponents.map(p => p.name));
        
        if (opponents.length === 0) {
            console.log(`[AutoConnect] ⚠️ Keine Gegner gefunden`);
            return;
        }
        
        opponents.forEach((opponent, index) => {
            if (!peerConnections.current[opponent.id]) {
                console.log(`[AutoConnect] Initiating call to:`, opponent.name, opponent.id);
                // Verzögerung für bessere Stabilität
                setTimeout(() => {
                    console.log(`[AutoConnect] 🔌 Führe Anruf aus für:`, opponent.name);
                    initiateCall(opponent.id);
                }, (index + 1) * 1000); // 1s, 2s, 3s Verzögerung
            } else {
                console.log(`[AutoConnect] ✅ Bereits verbunden mit:`, opponent.name);
            }
        });
    }, [gameState?.players, user.id, isCameraEnabled, localStream]);

    // Automatische Verbindung nur wenn Kamera bereits aktiviert ist
    useEffect(() => {
        if (gameState?.players && isCameraEnabled) {
            console.log("🚀 gameState.players verfügbar UND Kamera aktiv - starte automatische Verbindung");
            setTimeout(() => autoConnectToOpponents(), 2000); // 2s Verzögerung
        }
    }, [gameState?.players, isCameraEnabled, autoConnectToOpponents]);

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
        console.log(`[WebRTC] 🔧 Erstelle PeerConnection zu: ${targetSocketId}, localStream verfügbar:`, !!localStream);
        
        // Browser-spezifische Konfiguration für optimale Kompatibilität
        const rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { urls: 'stun:stun.ekiga.net' },
                { urls: 'stun:stun.ideasip.com' },
                { urls: 'stun:stun.rixtelecom.se' },
                { urls: 'stun:stun.schlund.de' }
            ],
            iceCandidatePoolSize: 10
        };
        
        // Safari-spezifische Konfiguration
        if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
            rtcConfig.bundlePolicy = 'max-bundle';
            rtcConfig.rtcpMuxPolicy = 'require';
        }
        
        // Firefox-spezifische Konfiguration
        if (navigator.userAgent.includes('Firefox')) {
            rtcConfig.iceTransportPolicy = 'all';
        }
        
        console.log(`[WebRTC] 🔧 RTC Config für ${targetSocketId}:`, rtcConfig);
        const pc = new RTCPeerConnection(rtcConfig);

        // ROBUSTE Browser-kompatible Konfiguration
        try {
            // Prüfe ob Transceiver unterstützt werden (moderne Browser)
            if (pc.addTransceiver) {
                console.log(`[WebRTC] ✅ Verwende moderne Transceiver API`);
                
                // Video Transceiver - erzwinge Empfang
                const videoTransceiver = pc.addTransceiver('video', { 
                    direction: 'sendrecv'
                });
                console.log(`[WebRTC] ✅ Video Transceiver erstellt:`, videoTransceiver);
                
                // Audio Transceiver
                const audioTransceiver = pc.addTransceiver('audio', { 
                    direction: 'sendrecv'
                });
                console.log(`[WebRTC] ✅ Audio Transceiver erstellt:`, audioTransceiver);
            } else {
                console.log(`[WebRTC] ⚠️ Transceiver nicht unterstützt, verwende Legacy API`);
            }
        } catch (error) {
            console.error(`[WebRTC] ❌ Transceiver Fehler:`, error);
            // Fallback: Keine explizite Transceiver-Konfiguration
        }
        
        // Minimale Edge-Optimierung: Zusätzliche Transceiver für Edge
        if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) {
            try {
                console.log(`[WebRTC] Edge: Zusätzliche Transceiver-Konfiguration`);
                // Zusätzliche Video Transceiver für Edge
                const additionalVideoTransceiver = pc.addTransceiver('video', { 
                    direction: 'recvonly'
                });
                console.log(`[WebRTC] ✅ Edge zusätzlicher Video Transceiver:`, additionalVideoTransceiver);
            } catch (edgeError) {
                console.error(`[WebRTC] ❌ Edge Transceiver Fehler:`, edgeError);
            }
        }

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

        // ROBUSTE ontrack Behandlung für alle Browser
        pc.ontrack = (event) => {
            console.log(`[WebRTC] 🔥 ontrack Event von ${targetSocketId}!`);
            console.log(`[WebRTC] Event Details:`, {
                track: event.track?.kind,
                trackId: event.track?.id,
                streams: event.streams?.length,
                receiver: !!event.receiver,
                transceiver: !!event.transceiver
            });
            
            // Methode 1: Event.streams verwenden (moderne Browser)
            if (event.streams && event.streams.length > 0) {
                event.streams.forEach((stream, index) => {
                    console.log(`[WebRTC] Stream ${index} von ${targetSocketId}:`, {
                        id: stream.id,
                        active: stream.active,
                        tracks: stream.getTracks().length
                    });
                    
                    if (stream && stream.getTracks().length > 0) {
                        setRemoteStreams(prev => {
                            const newStreams = {
                                ...prev,
                                [targetSocketId]: stream
                            };
                            console.log(`[WebRTC] ✅ Remote Stream gesetzt für ${targetSocketId}:`, stream.id);
                            return newStreams;
                        });
                    }
                });
            } 
            // Methode 2: Track direkt verwenden (Legacy Browser)
            else if (event.track) {
                console.log(`[WebRTC] ⚠️ Kein Stream, verwende Track direkt`);
                setRemoteStreams(prev => {
                    const existingStream = prev[targetSocketId];
                    if (existingStream) {
                        // Füge Track zu existierendem Stream hinzu
                        existingStream.addTrack(event.track);
                        console.log(`[WebRTC] ✅ Track zu existierendem Stream hinzugefügt`);
                        return {
                            ...prev,
                            [targetSocketId]: existingStream
                        };
                    } else {
                        // Erstelle neuen Stream
                        const stream = new MediaStream([event.track]);
                        console.log(`[WebRTC] ✅ Neuen Stream erstellt für Track:`, event.track.kind);
                        return {
                            ...prev,
                            [targetSocketId]: stream
                        };
                    }
                });
            }
            
            // Methode 3: Fallback über receiver (falls verfügbar)
            if (event.receiver && event.receiver.track) {
                console.log(`[WebRTC] 📡 Receiver Track verfügbar:`, event.receiver.track.kind);
                setRemoteStreams(prev => {
                    const existingStream = prev[targetSocketId];
                    if (existingStream) {
                        existingStream.addTrack(event.receiver.track);
                        return {
                            ...prev,
                            [targetSocketId]: existingStream
                        };
                    } else {
                        const stream = new MediaStream([event.receiver.track]);
                        return {
                            ...prev,
                            [targetSocketId]: stream
                        };
                    }
                });
            }
            
            // Minimale Edge-Optimierung: Zusätzliche Verzögerung für Edge
            if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) {
                setTimeout(() => {
                    console.log(`[WebRTC] Edge: Zusätzliche Stream-Verarbeitung`);
                    if (event.track) {
                        setRemoteStreams(prev => {
                            if (prev[targetSocketId]) {
                                return prev; // Stream bereits vorhanden
                            }
                            const stream = new MediaStream([event.track]);
                            return {
                                ...prev,
                                [targetSocketId]: stream
                            };
                        });
                    }
                }, 100);
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`[WebRTC] Connection State zu ${targetSocketId}:`, state);
            
            // Robuste Verbindungsbehandlung
            if (state === 'failed') {
                console.log(`[WebRTC] ❌ Verbindung fehlgeschlagen für ${targetSocketId}, versuche Neustart...`);
                // Versuche ICE Restart
                if (pc.restartIce) {
                    pc.restartIce();
                }
            } else if (state === 'connected') {
                console.log(`[WebRTC] ✅ Erfolgreich verbunden mit ${targetSocketId}`);
            } else if (state === 'disconnected') {
                console.log(`[WebRTC] ⚠️ Verbindung getrennt zu ${targetSocketId}`);
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log(`[WebRTC] ICE Connection State zu ${targetSocketId}:`, state);
            
            if (state === 'failed') {
                console.log(`[WebRTC] ❌ ICE Connection fehlgeschlagen für ${targetSocketId}`);
                // Versuche ICE Restart
                if (pc.restartIce) {
                    pc.restartIce();
                }
            } else if (state === 'connected' || state === 'completed') {
                console.log(`[WebRTC] ✅ ICE Connection etabliert für ${targetSocketId}`);
            }
        };

        // ROBUSTE localStream Behandlung für alle Browser
        const addLocalTracks = () => {
            if (localStream && localStream.getTracks().length > 0) {
                console.log(`[WebRTC] Füge ${localStream.getTracks().length} Tracks zu PeerConnection hinzu`);
                
                // Methode 1: addTrack (Standard)
                localStream.getTracks().forEach(track => {
                    try {
                        const sender = pc.addTrack(track, localStream);
                        console.log(`[WebRTC] ✅ Track hinzugefügt (addTrack):`, track.kind, track.label, sender);
                    } catch (error) {
                        console.error(`[WebRTC] ❌ Fehler bei addTrack:`, error);
                    }
                });
                
                // Methode 2: Falls Transceiver verfügbar, setze Streams explizit
                if (pc.getTransceivers) {
                    pc.getTransceivers().forEach(transceiver => {
                        if (transceiver.sender && localStream) {
                            try {
                                transceiver.sender.replaceTrack(null);
                                localStream.getTracks().forEach(track => {
                                    if (track.kind === transceiver.sender.track?.kind) {
                                        transceiver.sender.replaceTrack(track);
                                    }
                                });
                            } catch (error) {
                                console.error(`[WebRTC] ❌ Fehler bei Transceiver replaceTrack:`, error);
                            }
                        }
                    });
                }
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
                if (localStream && localStream.getTracks().length > 0) {
                    console.log(`[WebRTC] localStream jetzt verfügbar für ${targetSocketId}`);
                    addLocalTracks();
                    clearInterval(checkLocalStream);
                }
            }, 100);
            
            // Timeout nach 10 Sekunden
            setTimeout(() => {
                clearInterval(checkLocalStream);
                console.log(`[WebRTC] Timeout beim Warten auf localStream für ${targetSocketId}`);
            }, 10000);
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
            // Browser-kompatible Offer-Erstellung
            const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            };
            
            const offer = await pc.createOffer(offerOptions);
            await pc.setLocalDescription(offer);
            
            console.log(`[WebRTC] ✅ Offer erstellt und gesetzt für ${targetUserId}`);
            
            if (socket) {
                socket.emit('camera-offer', {
                    offer,
                    to: targetUserId,
                    from: socket.id,
                    roomId
                });
                console.log(`[WebRTC] ✅ Offer gesendet an ${targetUserId}`);
            }
        } catch (e) {
            console.error("Fehler beim Anrufen:", e);
            // Cleanup bei Fehler
            if (pc) {
                pc.close();
            }
        }
    };

    // WebRTC Socket Listeners
    useEffect(() => {
        if (!socket) return;

socket.on('camera-offer', async (data) => {
            let pc = null;
            try {
                console.log("Kamera-Anruf erhalten von:", data.from);
                pc = createPeerConnection(data.from);
                
                // Browser-kompatible RemoteDescription
                const remoteDescription = new RTCSessionDescription(data.offer);
                await pc.setRemoteDescription(remoteDescription);
                
                console.log(`[WebRTC] ✅ RemoteDescription gesetzt für ${data.from}`);
                
                // JETZT Queue abarbeiten, da RemoteDescription gesetzt ist
                await processIceQueue(data.from, pc);

                // Browser-kompatible Answer-Erstellung
                const answerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                };
                
                const answer = await pc.createAnswer(answerOptions);
                await pc.setLocalDescription(answer);
                
                console.log(`[WebRTC] ✅ Answer erstellt und gesetzt für ${data.from}`);

                socket.emit('camera-answer', {
                    answer,
                    to: data.from,
                    from: socket.id,
                    roomId
                });
                
                console.log(`[WebRTC] ✅ Answer gesendet an ${data.from}`);
                
                // Minimale Edge-Optimierung: Zusätzliche Queue-Verarbeitung für Edge
                if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) {
                    setTimeout(async () => {
                        console.log(`[WebRTC] Edge: Zusätzliche Queue-Verarbeitung nach Offer`);
                        await processIceQueue(data.from, pc);
                    }, 1000);
                }
            } catch (error) {
                console.error("WebRTC Error (Answer):", error);
                // Cleanup bei Fehler
                if (pc) {
                    pc.close();
                }
            }
        });

socket.on('camera-answer', async (data) => {
            console.log("Kamera-Antwort erhalten von:", data.from);
            const pc = peerConnections.current[data.from];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                // Auch hier Queue abarbeiten
                await processIceQueue(data.from, pc);
                
                // Minimale Edge-Optimierung: Zusätzliche Verzögerung für Edge
                if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) {
                    setTimeout(async () => {
                        console.log(`[WebRTC] Edge: Zusätzliche Queue-Verarbeitung`);
                        await processIceQueue(data.from, pc);
                    }, 500);
                }
            }
        });

socket.on('camera-ice', async (data) => {
            const pc = peerConnections.current[data.from];
            
            // ROBUSTE ICE Candidate Behandlung
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log(`[WebRTC] ✅ ICE Candidate hinzugefügt für ${data.from}`);
                } catch (e) { 
                    console.error("ICE Error:", e);
                    // Retry nach kurzer Verzögerung
                    setTimeout(async () => {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                            console.log(`[WebRTC] ✅ ICE Candidate nach Retry hinzugefügt für ${data.from}`);
                        } catch (retryError) {
                            console.error(`[WebRTC] ❌ ICE Retry fehlgeschlagen für ${data.from}:`, retryError);
                        }
                    }, 500);
                }
            } else {
                // Sonst: In Queue speichern (WICHTIG für das schwarze Bild Problem)
                console.log(`[WebRTC] ⏳ Puffere ICE Candidate für ${data.from} (Verbindung noch nicht bereit)`);
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

        // Bestimme die endgültige Startspieler-ID basierend auf Dropdown-Auswahl oder Lobby-Standard.
        const defaultStarter = getDefaultStartingPlayerId();
        let finalStartingPlayerId = startingPlayerId || defaultStarter;
        
        // Wenn die Lobby-Einstellung 'random' ist, wird defaultStarter zu 'bull-off'.
        // Dies verhindert, dass 'random' in eine ID umgewandelt wird, bevor das Spiel startet (Problem 4).
        if (finalStartingPlayerId === 'bull-off') {
            // Wenn Ausbullen ausgewählt, zeige Modal und starte nicht das Spiel
            setShowBullOffModal(true);
            return;
        }

        // Wenn Host das Dropdown nicht angeklickt hat, aber whoStarts 'opponent' ist,
        // wird finalStartingPlayerId hier die ID des Gegners sein.

        const payload = {
            roomId,
            userId: user.id,
            resetScores: true,
            startingPlayerId: finalStartingPlayerId
        };
        socket.emit('start-game', payload);

        // Korrekte Ansicht basierend auf der Auswahl setzen
        if (user.id === finalStartingPlayerId) {
            setVideoLayout({
                mode: 'fullscreen',
                currentPlayerId: 'local'
            });
        } else {
            setVideoLayout({
                mode: 'fullscreen',
                currentPlayerId: finalStartingPlayerId
            });
        }
    };

    // --- AUFNAHME-FUNKTIONEN ---
    const startRecording = async () => {
        try {
            // Fordere den Bildschirm-Stream an (das ist der Screen Recorder)
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: true
            });

            // Erstelle einen MediaRecorder mit dem Bildschirm-Stream
            mediaRecorderRef.current = new MediaRecorder(displayStream, { mimeType: 'video/webm' });
            recordedChunksRef.current = [];
    
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };
    
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Darts-Aufnahme-${new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                // Stoppe den Bildschirm-Stream, wenn die Aufnahme beendet ist
                displayStream.getTracks().forEach(track => track.stop());
            };
    
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Fehler beim Starten der Aufnahme:", error);
            alert("Aufnahme konnte nicht gestartet werden. Bitte stelle sicher, dass du die Bildschirmfreigabe erlaubt hast.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
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

    const winner = gameState?.winner;

const isHost = gameState.hostId === user.id;
    const canInput = !numpadState.isLocked;
    const showCountdown = false;
    const countdown = 0;
    const handleRematch = () => {
        setShowWinnerPopup(false);
        // Reset startingPlayerId so that the dropdown shows the correct default for the new game
        setStartingPlayerId(null);
        if (socket) {
            socket.emit('rematch', { roomId, userId: user.id });
        }
    };

    const handleBullOffComplete = (winnerId) => {
        // Start the game with the bull-off winner
        setShowBullOffModal(false);
        setBullOffModalShown(false);
        
        if (socket) {
            const payload = {
                roomId,
                userId: user.id,
                resetScores: true,
                startingPlayerId: winnerId
            };
            socket.emit('start-game', payload);
        }
    };

// --- CRICKET LAYOUT START ---
    if (gameState.mode === 'cricket') {
        const opponents = gameState.players.filter(p => p.id !== user.id);
        const hasOpponent = opponents.length > 0;

        return (
            <div className="game-container">
                <div className="game-layout">
                    {/* --- LINKE SEITE (wird zu game-main-area) --- */}
                    <div className="game-main-area">
                        {/* Header */}
                        <div style={{padding: '10px 20px', backgroundColor: '#111', borderBottom: '1px solid #222'}}>
                            <CricketHeader gameState={gameState} user={user} />
                        </div>

                        {/* Status Bar */}
                        {isGameRunning && (
                            <div className={`game-status-bar ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
                                {isMyTurn ? 'DU BIST DRAN' : `${currentPlayer?.name} IST DRAN`}
                            </div>
                        )}

                        {/* Ready / Start Area */}
                        {(!isGameRunning && !isGameFinished) && (
                            <div className="ready-box" style={{backgroundColor: '#111'}}>
                                {gameState.players.length < 2 ?
                                    <h3 style={{color: '#888'}}>Warte auf Gegner...</h3> :
                                    (isHost ? <button onClick={handleStartGame} className="start-game-button">SPIEL STARTEN 🎯</button> : <div className="waiting-message">Warte auf Host...</div>)
                                }
                            </div>
                        )}

                        {/* MAIN GAME CONTENT (3 Columns: Input | Board | Chat) */}
                        <div style={{ flex: 1, display: 'flex', padding: '15px', gap: '15px', overflowY: 'auto', minHeight: 0, backgroundColor: '#0f0f1a' }}>
                            
                            {/* Spalte 1: Input */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <CricketInputPanel
                                    onScoreInput={handleScoreInput}
                                    isActive={isMyTurn && !numpadState.isLocked}
                                    isLocked={!isMyTurn || numpadState.isLocked}
                                    canUseUndo={numpadState.canUndo}
                                    onUndo={handleUndo}
                                    dartsThrownInTurn={gameState.dartsThrownInTurn || 0}
                                />
                            </div>

                            {/* Spalte 2: Board */}
                            <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                                <CricketBoard gameState={gameState} user={user} />
                            </div>

                            {/* Spalte 3: Chat */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <GameChat socket={socket} roomId={roomId} user={user} messages={gameState.chatMessages || []} />
                            </div>
                        </div>
                    </div>

                    {/* --- RECHTE SEITE (wird zu camera-column) --- */}
                    <div className="camera-column">
                        {/* CAMERA CONTROLS */}
                        <div className="camera-controls">
                            <select
                                value={selectedDeviceId}
                                onChange={e => {
                                    setSelectedDeviceId(e.target.value);
                                    if(isCameraEnabled) startCamera(e.target.value);
                                }}
                            >
                                {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Kamera"}</option>)}
                            </select>
                            <button
                                onClick={() => isCameraEnabled ? stopCamera() : startCamera(selectedDeviceId)}
                            >
                                {isCameraEnabled ? "📹 Stop" : "📹 Start"}
                            </button>
                        </div>

                        {/* VIDEOS */}
                        <div className="video-container">
                            {/* Lokales Video */}
                            {isCameraEnabled && (
                                <div className="video-player local">
                                     <div className="video-label">DU</div>
                                    <video ref={localVideoRef} autoPlay muted playsInline style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                </div>
                            )}

                            {/* Remote Video (Gegner) */}
                            {hasOpponent ? (
                                <div className="video-player remote">
                                    <RemoteVideoPlayer
                                        stream={remoteStreams[opponents[0].id]}
                                        name={opponents[0].name}
                                        playerId={opponents[0].id}
                                    />
                                </div>
                            ) : (
                                <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', flexDirection: 'column', background: '#000', flex: 1}}>
                                    <div style={{fontSize: '2em', marginBottom: '10px'}}>📷</div>
                                    <div>Warte auf Gegner Video...</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Popups (müssen auch hier gerendert werden) */}
                {showWinnerPopup && <GameEndPopup winner={winner} countdown={10} onRematch={handleRematch} />}
                {showBullOffModal && (
                    <BullOffModal
                        isOpen={showBullOffModal} onClose={() => setShowBullOffModal(false)}
                        players={gameState.players} onBullOffComplete={handleBullOffComplete}
                        socket={socket} roomId={roomId} user={user}
                    />
                )}
            </div>
        );
    }
    // --- CRICKET LAYOUT END ---

    // X01 Layout (original three-column layout)
    return (
        <div className="game-container">
            {isSpectator && <div className="spectator-banner">Zuschauer</div>}

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
                            {isHost && !isSpectator ? (
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
                            {!isSpectator && (
                                <div className="wurf-section">
                                    <h3 className="wurf-title">{isMyTurn ? 'DEIN WURF' : `${currentPlayer?.name.toUpperCase()} WIRFT`}</h3>
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
                                                isActive={isMyTurn && canInput}
                                                isLocked={!isMyTurn || numpadState.isLocked}
                                                isOpponentLocked={!isMyTurn}
                                                isMyTurn={isMyTurn}
                                                canUseUndo={numpadState.canUndo}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="game-column-center">
                            <div className="statistics-section"><LiveStatistics gameState={gameState} /></div>
                        </div>
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
                            {/* NEU: Aufnahme-Button */}
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                style={{
                                    marginLeft: '10px',
                                    padding: '5px 10px',
                                    backgroundColor: isRecording ? '#d9534f' : '#5cb85c',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px'
                                }}
                            >
                                {isRecording ? '● Aufnahme stoppen' : '○ Aufnahme starten'}
                            </button>
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
                                webkit-playsinline="true"
                                x-webkit-airplay="allow"
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
            {/* Doppelquote-Abfrage Modal */}
            {doubleAttemptsQuery && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: '#222',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '2px solid #ffd700',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ color: '#ffd700', marginBottom: '15px', textAlign: 'center' }}>
                            Doppelquote-Abfrage
                        </h3>
                        <p style={{ color: '#fff', marginBottom: '20px', textAlign: 'center' }}>
                            {doubleAttemptsQuery.question}
                        </p>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                        }}>
                            {doubleAttemptsQuery.options.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleDoubleAttemptsResponse(index)}
                                    style={{
                                        padding: '10px',
                                        backgroundColor: '#4CAF50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '16px'
                                    }}
                                    onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
                                    onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showWinnerPopup && <GameEndPopup winner={winner} countdown={10} onRematch={handleRematch} />}
            {showBullOffModal && (
                <BullOffModal
                    isOpen={showBullOffModal}
                    onClose={() => {
                        setShowBullOffModal(false);
                        setBullOffModalShown(false);
                        setBullOffCompleted(true);
                    }}
                    players={gameState.players}
                    onBullOffComplete={handleBullOffComplete}
                    socket={socket}
                    roomId={roomId}
                    user={user}
                />
            )}
            <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
        </div>
    );
}

// Export der Game-Komponente
export default Game;
