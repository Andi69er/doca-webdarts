import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import NumberPad from './NumberPad';
import GameChat from './GameChat';
import GameEndPopup from './GameEndPopup';
import './Game.css';
import LiveStatistics from "./LiveStatistics";
import PlayerScores from "./PlayerScores";

// --- HELPERS ---
const getCheckoutText = (score) => {
    if (score === undefined || score === null) return "";
    if (score > 170) return "Aufbau";
    if (score === 170) return "T20 T20 BULL";
    if (score === 167) return "T20 T19 BULL";
    if (score === 164) return "T20 T18 BULL";
    if (score === 161) return "T20 T17 BULL";
    if (score === 160) return "T20 T20 D20";
    if (score <= 170) return "Finish möglich!";
    return "Score";
};

// --- MAIN GAME ---
function Game() {
    // 1. Hooks in der richtigen Reihenfolge
    const { roomId } = useParams();
    const { socket, socketConnected } = useSocket();
    
    // 2. State Hooks
    const [isLoading, setIsLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(null);
    const [user, setUser] = useState({ id: null, name: 'Gast' });
    const [gameState, setGameState] = useState(null);
    const [inputLockout, setInputLockout] = useState(false);
    const [localGameStarted, setLocalGameStarted] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({});

    // 3. Refs
    const ignoreServerUntil = useRef(0);
    const expectedLocalScore = useRef(null);
    const localVideoRef = useRef(null);
    const peerConnections = useRef({});
    const lockoutTimerRef = useRef(null);

    // 4. Callback Hooks
    const refreshDevices = useCallback(async () => {
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const v = list.filter(d => d.kind === 'videoinput');
            setDevices(v);
            if (v.length > 0 && !selectedDeviceId) setSelectedDeviceId(v[0].deviceId);
        } catch(e) {
            console.error('Fehler beim Abrufen der Geräte:', e);
        }
    }, [selectedDeviceId]);

    // 5. Effect Hooks
    useEffect(() => {
        if (!socket) {
            console.log('Warte auf Socket-Initialisierung...');
            return;
        }

        console.log('Socket-Instanz:', socket);
        console.log('Socket verbunden:', socket.connected);
        console.log('Socket ID:', socket.id);

        const onConnect = () => {
            console.log('Mit Server verbunden mit ID:', socket.id);
            setUser(prev => ({ ...prev, id: socket.id }));
            setConnectionError(null);
            setIsLoading(false);
        };

        const onConnectError = (error) => {
            console.error('Verbindungsfehler:', error);
            setConnectionError('Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.');
            setIsLoading(false);
        };

        socket.on('connect', onConnect);
        socket.on('connect_error', onConnectError);

        // Initialen Verbindungsstatus überprüfen
        if (socket.connected) {
            onConnect();
        } else if (socket.disconnected) {
            onConnectError(new Error('Nicht verbunden'));
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('connect_error', onConnectError);
        };
    }, [socket]);

    // Geräte initialisieren
    useEffect(() => {
        refreshDevices();
    }, [refreshDevices]);

    // 3. Lade- und Fehlerzustand anzeigen
    if (isLoading) {
        return (
            <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#fff',
                backgroundColor: '#1a1a2e',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div>Verbindung wird hergestellt...</div>
                <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#aaa' }}>
                    Raum: {roomId}
                </div>
            </div>
        );
    }

    if (connectionError) {
        return (
            <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#ff6b6b',
                backgroundColor: '#1a1a2e',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div style={{ fontSize: '1.4em', marginBottom: '20px' }}>⚠️ Verbindungsfehler</div>
                <div style={{ marginBottom: '30px', maxWidth: '500px', lineHeight: '1.5' }}>
                    {connectionError}
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '12px 25px',
                        backgroundColor: '#4a90e2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1em',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#3a80d2'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#4a90e2'}
                >
                    Erneut versuchen
                </button>
                <div style={{ marginTop: '20px', fontSize: '0.8em', color: '#666' }}>
                    Raum: {roomId}
                </div>
            </div>
        );
    }

    // --- RENDER LOGIC ---
    if (!gameState || !gameState.players) {
        return <div>Lade Spiel...</div>;
    }
            }

// Wenn Punkte gefallen sind, stelle sicher, dass das Spiel als gestartet markiert ist
            const startingScore = newState?.gameOptions?.startingScore || 501;
            if (newState.players.some(p => p.score < startingScore) && !localGameStarted) {
                console.log('Points detected, forcing game start');
                setLocalGameStarted(true);
            }

            // ECHO SCHUTZ - Ignoriere Updates, wenn wir ein lokales Update haben
            const myId = socket?.id || user?.id;
            const serverMe = newState.players?.find(p => p.id === myId);
            
            if (localGameStarted && expectedLocalScore.current !== null && serverMe) {
                if (serverMe.score > expectedLocalScore.current) {
                    console.log('Ignoring server update - local state is newer');
                    return;
                }
            }

            // Aktualisiere den Spielstatus
            setGameState(prev => {
                const updatedState = {
                    ...prev,
                    ...newState,
                    players: newState.players?.map(p => ({
                        ...p,
                        ...ensureStats(p)
                    })) || prev.players,
                    gameStatus: newState.gameStatus || prev.gameStatus || 'waiting'
                };
                
                console.log('Updating game state:', updatedState);
                return updatedState;
            });

            // Zurücksetzen des erwarteten Scores nach der Synchronisation
            if (serverMe && expectedLocalScore.current !== null && 
                serverMe.score <= expectedLocalScore.current) {
                expectedLocalScore.current = null;
            }
        };

        const handleReceiveMessage = (data) => {
            setGameState(prev => {
                if(!prev) return prev;
                return { ...prev, chatMessages: [...(prev.chatMessages || []), data] };
            });
        };

        socket.on('game-state-update', handleGameState);
        socket.on('gameState', handleGameState);
        socket.on('receiveMessage', handleReceiveMessage);
        socket.on('gameStarted', handleGameState);
        socket.on('statusUpdate', handleGameState);

        socket.emit('joinRoom', { roomId });
        socket.emit('getGameState', roomId);

        const poll = setInterval(() => socket.emit('getGameState', roomId), 2500);

        return () => {
            clearInterval(poll);
            socket.off('connect', onConnect);
            socket.off('game-state-update', handleGameState);
            socket.off('gameState', handleGameState);
            socket.off('receiveMessage', handleReceiveMessage);
            socket.off('gameStarted', handleGameState);
            socket.off('statusUpdate', handleGameState);
        };
    }, [socket, roomId, user.id, localGameStarted]);

    // --- ACTIONS ---
    const handleStartGame = () => {
        if (!socket) return;
        setLocalGameStarted(true); 
        ignoreServerUntil.current = Date.now() + 2000;
        
        // FEUER FREI: Alle Start-Befehle senden
        const payload = { roomId, userId: user.id };
        console.log("Starting Game with multiple events...");
        socket.emit('startGame', payload);
        socket.emit('start-game', payload); // Manche Server wollen das so
        socket.emit('start', payload);      // Oder so
        
        setGameState(prev => ({
            ...prev,
            gameStatus: 'active',
            gameState: { ...prev?.gameState, status: 'active' }
        }));
    };

    const handleScoreInput = (scoreInput) => {
        // Master Key: Host oder Aktiver Spieler darf tippen
        const isHost = gameState && (gameState.hostId === user.id || (gameState.players[0] && gameState.players[0].id === user.id));
        const currentIndex = gameState?.gameState?.currentPlayerIndex || 0;
        // Wir holen uns den Player, der gerade wirklich dran ist
        const currentPlayer = gameState?.players[currentIndex];
        const isMyTurn = currentPlayer?.id === user.id;

        if (socket && user.id && !inputLockout && (isMyTurn || isHost)) {
            const points = parseInt(scoreInput, 10);
            if (isNaN(points)) return;

            setLocalGameStarted(true); 
            ignoreServerUntil.current = Date.now() + 2500; 

            setGameState(prev => {
                if(!prev || !prev.players) return prev;
                // Wir nehmen den Index vom State
                const currIdx = prev.gameState?.currentPlayerIndex || 0;
                const nextIdx = (currIdx + 1) % prev.players.length; 
                
                const newPlayers = [...prev.players];
                const currentP = { ...newPlayers[currIdx] };
                
                // Optimistic Updates
                const newScore = Math.max(0, currentP.score - points);
                expectedLocalScore.current = newScore;
                
                const oldDarts = currentP.dartsThrown || 0;
                const newDarts = oldDarts + 3;
                
                currentP.score = newScore;
currentP.dartsThrown = newDarts;
                const startingScore = newState?.gameOptions?.startingScore || 501;
                const totalPoints = startingScore - newScore;
                currentP.avg = ((totalPoints / newDarts) * 3).toFixed(2);
                currentP.first9 = currentP.avg;

                newPlayers[currIdx] = currentP;

                const fakeHistory = { playerId: currentP.id, score: points, remaining: newScore, timestamp: new Date().toISOString() };

                return { 
                    ...prev, 
                    players: newPlayers,
                    gameState: {
                        ...prev.gameState,
                        currentPlayerIndex: nextIdx,
                        lastThrow: points,
                        history: [...(prev.gameState?.history || []), fakeHistory],
                        status: 'active'
                    },
                    gameStatus: 'active'
                };
            });

            // FEUER FREI: Alle Score-Befehle senden
            // WICHTIG: Wir senden die ID des Spielers, FÜR DEN geworfen wurde (wichtig wenn Host für Gast tippt)
            const targetUserId = currentPlayer ? currentPlayer.id : user.id;
            const payload = { roomId, userId: targetUserId, score: points, points: points }; // Manche Server wollen score, manche points
            
            console.log("Sending score events for:", targetUserId);
            socket.emit('throw', payload);
            socket.emit('score-input', payload);
            socket.emit('update-score', payload);
            
            setInputLockout(true);
            if(lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
            lockoutTimerRef.current = setTimeout(() => setInputLockout(false), 800);
        }
    };

    const handleUndo = () => {
        if (socket && user.id && window.confirm("Undo?")) {
            ignoreServerUntil.current = 0;
            expectedLocalScore.current = null;
            socket.emit('undo', { roomId, userId: user.id });
        }
    };

    // --- WEBRTC ---
    const refreshDevices = useCallback(async () => {
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const v = list.filter(d => d.kind === 'videoinput');
            setDevices(v);
            if (v.length > 0 && !selectedDeviceId) setSelectedDeviceId(v[0].deviceId);
        } catch(e) {}
    }, [selectedDeviceId]);
    useEffect(() => { refreshDevices(); }, [refreshDevices]);

    const startCamera = async (id = null) => {
        try {
            if(localStream) localStream.getTracks().forEach(t => t.stop());
            const s = await navigator.mediaDevices.getUserMedia({ video: (id || selectedDeviceId) ? { deviceId: { exact: (id || selectedDeviceId) }, width: 1280, height: 720 } : true, audio: false });
            setLocalStream(s); setIsCameraEnabled(true);
            if(localVideoRef.current) localVideoRef.current.srcObject = s;
            refreshDevices();
            Object.values(peerConnections.current).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender && s.getVideoTracks()[0]) sender.replaceTrack(s.getVideoTracks()[0]).catch(console.error);
                else if (s.getVideoTracks()[0]) pc.addTrack(s.getVideoTracks()[0], s);
            });
        } catch(e) { console.error("Cam Error", e); setIsCameraEnabled(false); }
    };

    const stopCamera = () => {
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); setLocalStream(null); }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setIsCameraEnabled(false);
    };

    const createPeerConnection = (targetUserId) => {
        if (peerConnections.current[targetUserId]) return peerConnections.current[targetUserId];
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pc.onicecandidate = e => { if (e.candidate) socket.emit('camera-ice', { roomId, from: user.id, to: targetUserId, candidate: e.candidate }); };
        pc.ontrack = e => setRemoteStreams(prev => ({ ...prev, [targetUserId]: e.streams[0] }));
        if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
        peerConnections.current[targetUserId] = pc;
        return pc;
    };

    const initiateCall = (targetUserId) => {
        if (!user?.id || targetUserId === user.id) return;
        const pc = createPeerConnection(targetUserId);
        pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => {
            socket.emit('camera-offer', { roomId, from: user.id, to: targetUserId, offer: pc.localDescription });
        }).catch(console.error);
    };

    useEffect(() => {
        if (!socket || !user?.id) return;
        socket.on('camera-offer', async d => {
            if (d.to !== user.id) return;
            const pc = createPeerConnection(d.from);
            await pc.setRemoteDescription(new RTCSessionDescription(d.offer));
            const a = await pc.createAnswer();
            await pc.setLocalDescription(a);
            socket.emit('camera-answer', { roomId, from: user.id, to: d.from, answer: a });
        });
        socket.on('camera-answer', async d => {
            if (d.to !== user.id) return;
            const pc = peerConnections.current[d.from];
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
        });
        socket.on('camera-ice', async d => {
            if (d.to !== user.id) return;
            const pc = peerConnections.current[d.from];
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(d.candidate));
        });
        return () => { socket.off('camera-offer'); socket.off('camera-answer'); socket.off('camera-ice'); };
    }, [socket, user?.id, roomId, localStream]);

    // --- RENDER ---
    if (!gameState || !gameState.players) return <div className="loading-screen">Lade...</div>;

// Status Berechnung
    const startingScore = gameState?.gameOptions?.startingScore || 501;
    const pointsScored = gameState.players.some(p => p.score < startingScore);
    const isGameRunning = localGameStarted || gameState.gameStatus === 'active' || pointsScored;

    const currentIndex = gameState.gameState?.currentPlayerIndex || 0;
    const currentPlayer = gameState.players[currentIndex];
    const isMyTurn = currentPlayer?.id === user.id;
    const isHost = gameState.hostId === user.id || (gameState.players[0] && gameState.players[0].id === user.id);

    // NumberPad aktiv: Wenn Spiel läuft UND (ich bin dran ODER ich bin Host)
    const canInput = isGameRunning && (isMyTurn || isHost);

    const videoLayout = !isGameRunning 
        ? { flexDirection: 'column', localHeight: '50%', remoteHeight: '50%', localVisible: true, remoteVisible: true }
        : (isMyTurn ? { flexDirection: 'column', localHeight: '100%', remoteHeight: '0%', localVisible: true, remoteVisible: false }
                    : { flexDirection: 'column', localHeight: '0%', remoteHeight: '100%', localVisible: false, remoteVisible: true });

    return (
        <div className="game-container">
            {!gameState.players.some(p => p.id === user.id) && <div className="spectator-banner">Zuschauer</div>}
            <div className="game-layout">
                <div className="game-main-area">
                    <PlayerScores gameState={gameState} user={user} />
                    {isGameRunning && (
                        <div className={`game-status-bar ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
                            <div className="status-text">{isMyTurn ? 'DU BIST DRAN' : `${currentPlayer?.name} IST DRAN`}</div>
                        </div>
                    )}
                    
                    {!isGameRunning ? (
                        <div className="ready-box">
                            <div className="ready-status">{gameState.players.length < 2 ? "Warte auf Gegner..." : "Bereit zum Start"}</div>
                            {isHost ? <button className="start-game-button" onClick={handleStartGame}>SPIEL STARTEN 🎯</button> : <div className="waiting-message">Warte auf Host...</div>}
                        </div>
                    ) : (
                        <GameInfoBar currentPlayer={currentPlayer} isMyTurn={isMyTurn} />
                    )}

                    <div className="game-bottom-section">
                        <div className="game-column-left">
                            <div className="wurf-section">
                                <h3 className="wurf-title">DEIN WURF</h3>
                                <div className="number-pad-container">
                                    <NumberPad 
                                        onScoreInput={handleScoreInput} 
                                        onUndo={handleUndo} 
                                        checkoutSuggestions={gameState.checkoutSuggestions} 
                                        isActive={canInput} 
                                        isLocked={inputLockout} 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="game-column-center"><div className="statistics-section"><LiveStatistics gameState={gameState} /></div></div>
                        <div className="game-column-right"><div className="game-chat-container"><GameChat socket={socket} roomId={roomId} user={user} messages={gameState.chatMessages || []} /></div></div>
                    </div>
                </div>
                <div className="camera-column">
                    <div className="camera-controls">
                        <select value={selectedDeviceId} onChange={e => { setSelectedDeviceId(e.target.value); if(isCameraEnabled) startCamera(e.target.value); }}>{devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || "Kamera"}</option>)}</select>
                        <button onClick={() => isCameraEnabled ? stopCamera() : startCamera()}>{isCameraEnabled ? "Stop" : "Start"}</button>
                        <button onClick={() => gameState.players.forEach(p => { if(p.id !== user.id) initiateCall(p.id); })} style={{ marginLeft: '10px', padding: '5px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}>🔌 Verbinden</button>
                    </div>
                    <div className="video-container" style={{ flexDirection: videoLayout.flexDirection }}>
                        <div className="video-player local" style={{ height: videoLayout.localHeight, display: videoLayout.localVisible ? 'flex' : 'none' }}><div className="video-label">Du</div><video ref={localVideoRef} autoPlay muted playsInline style={{width:'100%', height:'100%'}} /></div>
                        {gameState.players.filter(p => p.id !== user.id).map(p => (<div key={p.id} className="video-player remote" style={{ height: videoLayout.remoteHeight, display: videoLayout.remoteVisible ? 'flex' : 'none' }}><RemoteVideoPlayer stream={remoteStreams[p.id]} name={p.name} /></div>))}
                    </div>
                </div>
            </div>
            {gameState.gameStatus === 'finished' && <GameEndPopup gameState={gameState} currentUserId={user?.id} />}
        </div>
    );
}
export default Game;