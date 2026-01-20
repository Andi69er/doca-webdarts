import { useCallback, useEffect, useRef, useState } from 'react';

const useWebRTC = ({ socket, roomId, gameState, user, selectedDeviceId, refreshDevices }) => {
    const localVideoRef = useRef(null);
    const peerConnections = useRef({});
    const iceCandidateQueue = useRef({});
    const remoteStreamCache = useRef({});
    const receiverPolls = useRef({});
    const disconnectionTimers = useRef({});
    const autoConnectRef = useRef(null);
    const gameStateRef = useRef(gameState);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const socketId = socket?.id;

    const dropPeerConnection = useCallback((targetSocketId, reason = 'unknown') => {
        if (!targetSocketId) {
            return;
        }
        const normalizedTarget = String(targetSocketId);
        console.log(`[WebRTC] 🧹 Entferne PeerConnection zu ${normalizedTarget}: ${reason}`);
        const cleanupKeys = new Set([normalizedTarget]);
        const players = gameStateRef.current?.players || [];
        players.forEach((player) => {
            if (!player) {
                return;
            }
            const identifiers = [player.id, player.userId, player.socketId]
                .filter(Boolean)
                .map(value => String(value));
            if (identifiers.includes(normalizedTarget)) {
                identifiers.forEach(value => cleanupKeys.add(value));
            }
        });

        cleanupKeys.forEach((key) => {
            const pc = peerConnections.current[key];
            if (pc) {
                try {
                    pc.ontrack = null;
                    pc.onicecandidate = null;
                    pc.close();
                } catch (error) {
                    console.warn('[WebRTC] Cleanup close error:', error);
                }
                delete peerConnections.current[key];
            }

            if (receiverPolls.current[key]) {
                clearInterval(receiverPolls.current[key]);
                delete receiverPolls.current[key];
            }

            if (disconnectionTimers.current[key]) {
                clearTimeout(disconnectionTimers.current[key]);
                delete disconnectionTimers.current[key];
            }

            if (iceCandidateQueue.current[key]) {
                delete iceCandidateQueue.current[key];
            }

            if (remoteStreamCache.current[key]) {
                delete remoteStreamCache.current[key];
            }
        });

        setRemoteStreams((prev) => {
            if (!prev) {
                return prev;
            }
            let changed = false;
            const next = { ...prev };
            cleanupKeys.forEach((key) => {
                if (next[key]) {
                    delete next[key];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, []);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const processIceQueue = useCallback(async (socketId, pc) => {
        const queue = iceCandidateQueue.current[socketId];
        if (queue) {
            console.log(`Verarbeite ${queue.length} gepufferte ICE Candidates für ${socketId}`);
            for (const candidate of queue) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Queue ICE Error:', error);
                }
            }
            delete iceCandidateQueue.current[socketId];
        }
    }, []);

    const createPeerConnection = useCallback((targetSocketId) => {
        const targetKey = String(targetSocketId);
        console.log(`[WebRTC] 🔧 Erstelle PeerConnection zu: ${targetKey}, localStream verfügbar:`, !!localStream);

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
                { urls: 'stun:stun.schlund.de' },
                { urls: 'stun:stun.voiparound.com' },
                { urls: 'stun:stun.voipbuster.com' },
                { urls: 'stun:stun.voipstunt.com' }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };

        if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
            rtcConfig.iceTransportPolicy = 'all';
        }

        if (navigator.userAgent.includes('Firefox')) {
            rtcConfig.iceTransportPolicy = 'all';
        }

        console.log(`[WebRTC] 🔧 RTC Config für ${targetKey}:`, rtcConfig);
        const pc = new RTCPeerConnection(rtcConfig);

        try {
            if (pc.addTransceiver) {
                console.log('[WebRTC] ✅ Verwende moderne Transceiver API');
                pc.addTransceiver('video', { direction: 'sendrecv' });
                pc.addTransceiver('audio', { direction: 'sendrecv' });
            } else {
                console.log('[WebRTC] ⚠️ Transceiver nicht unterstützt, verwende Legacy API');
            }
        } catch (error) {
            console.error('[WebRTC] ❌ Transceiver Fehler:', error);
        }

        if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) {
            try {
                console.log('[WebRTC] Edge: Zusätzliche Transceiver-Konfiguration');
                pc.addTransceiver('video', { direction: 'recvonly' });
            } catch (edgeError) {
                console.error('[WebRTC] ❌ Edge Transceiver Fehler:', edgeError);
            }
        }

        const scheduleReconnect = (reason) => {
            dropPeerConnection(targetKey, reason);
            if (autoConnectRef.current) {
                setTimeout(() => {
                    autoConnectRef.current?.();
                }, 1000);
            }
        };

        const clearDisconnectionTimer = () => {
            if (disconnectionTimers.current[targetKey]) {
                clearTimeout(disconnectionTimers.current[targetKey]);
                delete disconnectionTimers.current[targetKey];
            }
        };

        const triggerReconnectWithDelay = (reason) => {
            clearDisconnectionTimer();
            disconnectionTimers.current[targetKey] = setTimeout(() => {
                delete disconnectionTimers.current[targetKey];
                scheduleReconnect(reason);
            }, 3000);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                console.log(`[WebRTC] ICE Candidate gesendet an ${targetKey}`);
                socket.emit('camera-ice', {
                    candidate: event.candidate,
                    to: targetKey,
                    from: socket.id,
                    roomId
                });
            }
        };

        const getPlayerKeys = () => {
            const keys = new Set([targetKey]);
            const players = gameStateRef.current?.players || [];
            players.forEach((player) => {
                if (!player) {
                    return;
                }
                const identifiers = [player.id, player.userId, player.socketId]
                    .filter(Boolean)
                    .map(value => String(value));
                if (identifiers.includes(targetKey)) {
                    identifiers.forEach(value => keys.add(value));
                }
            });
            return Array.from(keys);
        };

        const ensureRemoteStream = (key) => {
            if (!remoteStreamCache.current[key]) {
                remoteStreamCache.current[key] = new MediaStream();
            }
            return remoteStreamCache.current[key];
        };

        const stopReceiverPoll = () => {
            if (receiverPolls.current[targetKey]) {
                clearInterval(receiverPolls.current[targetKey]);
                delete receiverPolls.current[targetKey];
            }
        };

        const startReceiverPoll = () => {
            if (!(navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg'))) {
                return;
            }
            if (receiverPolls.current[targetKey]) {
                return;
            }
            receiverPolls.current[targetKey] = setInterval(() => {
                syncReceiversToRemoteStreams();
                const keys = getPlayerKeys();
                const hasStream = keys.some(key => {
                    const stream = remoteStreamCache.current[key];
                    return stream && stream.getTracks().length > 0;
                });
                if (hasStream) {
                    stopReceiverPoll();
                }
            }, 500);
        };

        const pushTrackToRemoteStreams = (track) => {
            if (!track) {
                return;
            }
            const keys = getPlayerKeys();
            keys.forEach((key) => {
                const stream = ensureRemoteStream(key);
                const hasTrack = stream.getTracks().some(existingTrack => existingTrack.id === track.id);
                stream.getTracks()
                    .filter(existingTrack => existingTrack.kind === track.kind && existingTrack.id !== track.id)
                    .forEach(existingTrack => {
                        stream.removeTrack(existingTrack);
                    });
                if (!hasTrack) {
                    stream.addTrack(track);
                }
                setRemoteStreams(prev => ({
                    ...prev,
                    [key]: stream
                }));
            });
        };

        const syncReceiversToRemoteStreams = () => {
            if (!pc.getReceivers) {
                return;
            }
            const receivers = pc.getReceivers();
            console.log('[WebRTC] syncReceivers', targetKey, receivers.length);
            receivers.forEach(receiver => {
                if (receiver.track) {
                    pushTrackToRemoteStreams(receiver.track);
                }
            });
        };

        pc.ontrack = (event) => {
            console.log('[WebRTC] ontrack detail', targetKey, event.streams?.length, event.track?.kind);
            console.log(`[WebRTC] 🔥 ontrack Event von ${targetKey}!`);
            const tracks = [];

            if (event.streams && event.streams.length > 0) {
                event.streams.forEach((stream, index) => {
                    console.log(`[WebRTC] Stream ${index} von ${targetKey}:`, {
                        id: stream.id,
                        active: stream.active,
                        tracks: stream.getTracks().length
                    });
                    stream.getTracks().forEach(track => tracks.push(track));
                });
            }

            if (event.track) {
                tracks.push(event.track);
            }

            if (event.receiver && event.receiver.track) {
                tracks.push(event.receiver.track);
            }

            const uniqueTracks = [];
            tracks.forEach(track => {
                if (track && !uniqueTracks.some(existingTrack => existingTrack.id === track.id)) {
                    uniqueTracks.push(track);
                }
            });

            uniqueTracks.forEach(pushTrackToRemoteStreams);
            syncReceiversToRemoteStreams();
            startReceiverPoll();

            if ((navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) && event.track) {
                setTimeout(() => {
                    pushTrackToRemoteStreams(event.track);
                    syncReceiversToRemoteStreams();
                    startReceiverPoll();
                }, 100);
            }
        };

        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`[WebRTC] Connection State zu ${targetKey}:`, state);
            if (state === 'failed' && pc.restartIce) {
                pc.restartIce();
            }
            if (state === 'connected' || state === 'completed') {
                clearDisconnectionTimer();
                syncReceiversToRemoteStreams();
                startReceiverPoll();
                return;
            }
            if (state === 'disconnected') {
                triggerReconnectWithDelay(`connectionState:${state}`);
                return;
            }
            if (state === 'failed' || state === 'closed') {
                clearDisconnectionTimer();
                stopReceiverPoll();
                scheduleReconnect(`connectionState:${state}`);
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            console.log(`[WebRTC] ICE Connection State zu ${targetKey}:`, state);
            if (state === 'failed' && pc.restartIce) {
                pc.restartIce();
            }
            if (state === 'connected' || state === 'completed') {
                clearDisconnectionTimer();
                syncReceiversToRemoteStreams();
                startReceiverPoll();
                return;
            }
            if (state === 'disconnected') {
                triggerReconnectWithDelay(`iceConnectionState:${state}`);
                return;
            }
            if (state === 'failed' || state === 'closed') {
                clearDisconnectionTimer();
                stopReceiverPoll();
                scheduleReconnect(`iceConnectionState:${state}`);
            }
        };

        const addLocalTracks = () => {
            if (localStream && localStream.getTracks().length > 0) {
                console.log(`[WebRTC] Füge ${localStream.getTracks().length} Tracks zu PeerConnection hinzu`);
                localStream.getTracks().forEach(track => {
                    try {
                        pc.addTrack(track, localStream);
                    } catch (error) {
                        console.error('[WebRTC] ❌ Fehler bei addTrack:', error);
                    }
                });

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
                                console.error('[WebRTC] ❌ Fehler bei Transceiver replaceTrack:', error);
                            }
                        }
                    });
                }
            } else {
                console.log(`[WebRTC] ⚠️ Keine localStream Tracks verfügbar für ${targetKey}`);
            }
        };

        addLocalTracks();

        if (!localStream) {
            console.log(`[WebRTC] Warte auf localStream für ${targetKey}...`);
            const checkLocalStream = setInterval(() => {
                if (localStream && localStream.getTracks().length > 0) {
                    console.log(`[WebRTC] localStream jetzt verfügbar für ${targetKey}`);
                    addLocalTracks();
                    clearInterval(checkLocalStream);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkLocalStream);
                console.log(`[WebRTC] Timeout beim Warten auf localStream für ${targetKey}`);
            }, 10000);
        }

        peerConnections.current[targetKey] = pc;
        console.log(`[WebRTC] PeerConnection erstellt für ${targetKey}`);
        startReceiverPoll();
        return pc;
    }, [dropPeerConnection, localStream, roomId, socket]);

    const initiateCall = useCallback(async (targetUserId) => {
        if (!localStream) {
            alert('Bitte zuerst Kamera starten!');
            return;
        }

        console.log('Initiiere Anruf an:', targetUserId);
        const pc = createPeerConnection(targetUserId);

        try {
            const offerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
            const offer = await pc.createOffer(offerOptions);
            await pc.setLocalDescription(offer);

            if (socket) {
                socket.emit('camera-offer', {
                    offer,
                    to: targetUserId,
                    from: socket.id,
                    roomId
                });
                console.log(`[WebRTC] ✅ Offer gesendet an ${targetUserId}`);
            }
        } catch (error) {
            console.error('Fehler beim Anrufen:', error);
            try {
                pc.close();
            } catch (closeError) {
                console.warn('[WebRTC] close error nach Offer:', closeError);
            }
            dropPeerConnection(targetUserId, 'offer-error');
        }
    }, [createPeerConnection, dropPeerConnection, localStream, roomId, socket]);

    const shouldInitiateCall = useCallback((opponent) => {
        const localComparable = user?.id ?? socketId;
        const remoteComparable = opponent?.userId ?? opponent?.id ?? opponent?.socketId;
        if (!localComparable || !remoteComparable) {
            return true;
        }
        const localValue = String(localComparable);
        const remoteValue = String(remoteComparable);
        if (localValue === remoteValue) {
            return false;
        }
        return localValue < remoteValue;
    }, [socketId, user?.id]);

    const autoConnectToOpponents = useCallback(({ force = false } = {}) => {
        console.log('[AutoConnect] 🔄 Versuche automatische Verbindung...');
        console.log('[AutoConnect] localStream:', !!localStream);
        console.log('[AutoConnect] isCameraEnabled:', isCameraEnabled);
        console.log('[AutoConnect] gameState.players:', !!gameState?.players);
        console.log('[AutoConnect] user.id:', user?.id);
        console.log('[AutoConnect] socket.id:', socketId);

        if (!isCameraEnabled || !localStream) {
            console.log('[AutoConnect] ❌ Übersprungen - Kamera nicht aktiviert');
            return;
        }

        if (!gameState?.players) {
            console.log('[AutoConnect] ❌ Übersprungen - keine Spieler');
            return;
        }

        const localIdentifiers = [user?.id, socketId]
            .filter(Boolean)
            .map((value) => String(value));

        const opponents = gameState.players.filter((player) => {
            const playerIdentifiers = [player.id, player.userId, player.socketId]
                .filter(Boolean)
                .map((value) => String(value));
            if (playerIdentifiers.length === 0) {
                return true;
            }
            return !playerIdentifiers.some((id) => localIdentifiers.includes(id));
        });

        console.log('[AutoConnect] Gegner gefunden:', opponents.map(p => p.name));

        if (opponents.length === 0) {
            console.log('[AutoConnect] ⚠️ Keine Gegner gefunden');
            return;
        }

        opponents.forEach((opponent, index) => {
            const targetSocketId = opponent?.socketId || opponent?.id;
            const opponentLabel = opponent?.name ?? opponent?.userName ?? targetSocketId;

            if (!targetSocketId) {
                console.log('[AutoConnect] ⚠️ Kein Ziel-Socket für:', opponentLabel);
                return;
            }

            if (!force && !shouldInitiateCall(opponent)) {
                console.log('[AutoConnect] ⏭ Warte auf Remote-Initiator für:', opponentLabel);
                return;
            }

            if (peerConnections.current[targetSocketId]) {
                if (force) {
                    console.log('[AutoConnect] ♻️ Erzwinge Neuaufbau für:', opponentLabel);
                    dropPeerConnection(targetSocketId, 'force-reconnect');
                } else {
                    console.log('[AutoConnect] ✅ Bereits verbunden mit:', opponentLabel);
                    return;
                }
            }

            console.log('[AutoConnect] Initiating call to:', opponentLabel, targetSocketId);
            setTimeout(() => {
                console.log('[AutoConnect] 🔌 Führe Anruf aus für:', opponentLabel);
                initiateCall(targetSocketId);
            }, (index + 1) * 1000);
        });
    }, [dropPeerConnection, gameState?.players, initiateCall, isCameraEnabled, localStream, shouldInitiateCall, socketId, user?.id]);

    useEffect(() => {
        autoConnectRef.current = autoConnectToOpponents;
    }, [autoConnectToOpponents]);

    const startCamera = useCallback(async (targetDeviceId) => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Kamera-Zugriff wird von deinem Browser nicht unterstützt (wahrscheinlich wegen einer unsicheren Verbindung/HTTP).');
            return;
        }

        const idToUse = targetDeviceId || selectedDeviceId;
        console.log('Starte Kamera mit ID:', idToUse);
        let stream = null;

        try {
            const constraints = {
                video: idToUse ? { deviceId: { exact: idToUse } } : true,
                audio: true
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.warn('Fehler beim Anfordern von Video+Audio, versuche nur Video:', error);
            try {
                const constraints = {
                    video: idToUse ? { deviceId: { exact: idToUse } } : true,
                    audio: false
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (videoError) {
                console.error('Kamera konnte nicht gestartet werden:', videoError);
                
                let errorMessage = 'Kamera konnte nicht gestartet werden.\n\n';
                
                if (videoError.name === 'NotAllowedError' || videoError.name === 'PermissionDeniedError') {
                    errorMessage += '🚫 ZUGRIFF VERWEIGERT:\nBitte klicke oben in der Adresszeile auf das SCHLOSS-SYMBOL (oder "Nicht sicher") und stelle Kamera auf "Zulassen".';
                } else if (videoError.name === 'NotFoundError' || videoError.name === 'DevicesNotFoundError') {
                    errorMessage += '🔍 KEINE KAMERA GEFUNDEN:\nBitte stelle sicher, dass eine Kamera angeschlossen und eingeschaltet ist.';
                } else if (videoError.name === 'NotReadableError' || videoError.name === 'TrackStartError') {
                    errorMessage += '📷 KAMERA WIRD BEREITS GENUTZT:\nEin anderes Programm (Teams, Zoom, ein anderer Browser-Tab) blockiert die Kamera.';
                } else if (!window.isSecureContext) {
                    errorMessage += '🔒 UNSICHERE VERBINDUNG:\nChrome erlaubt Kamera nur über HTTPS oder Localhost. Nutze http://localhost:3000 oder richte die Chrome-Flags ein.';
                } else {
                    errorMessage += `Fehler: ${videoError.message || videoError.name}`;
                }
                
                alert(errorMessage);
                return;
            }
        }

        if (stream) {
            setLocalStream(stream);
            setIsCameraEnabled(true);

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            if (refreshDevices) {
                await refreshDevices();
            }

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

            setTimeout(() => {
                autoConnectToOpponents();
            }, 1000);
        }
    }, [autoConnectToOpponents, refreshDevices, selectedDeviceId]);

    const stopCamera = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            setIsCameraEnabled(false);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
        }
    }, [localStream]);

    useEffect(() => {
        if (gameState?.players && isCameraEnabled) {
            const timeout = setTimeout(() => autoConnectToOpponents(), 2000);
            return () => clearTimeout(timeout);
        }
    }, [autoConnectToOpponents, gameState?.players, isCameraEnabled]);

    useEffect(() => () => {
        Object.values(receiverPolls.current).forEach(intervalId => clearInterval(intervalId));
        receiverPolls.current = {};
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleOffer = async (data) => {
            let pc = null;
            try {
                console.log('Kamera-Anruf erhalten von:', data.from);
                pc = createPeerConnection(data.from);
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                console.log(`[WebRTC] ✅ RemoteDescription gesetzt für ${data.from}`);
                await processIceQueue(data.from, pc);

                const answerOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
                const answer = await pc.createAnswer(answerOptions);
                await pc.setLocalDescription(answer);

                socket.emit('camera-answer', {
                    answer,
                    to: data.from,
                    from: socket.id,
                    roomId
                });
                console.log(`[WebRTC] ✅ Answer gesendet an ${data.from}`);

                if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) {
                    setTimeout(async () => {
                        console.log('[WebRTC] Edge: Zusätzliche Queue-Verarbeitung nach Offer');
                        await processIceQueue(data.from, pc);
                    }, 1000);
                }
            } catch (error) {
                console.error('WebRTC Error (Answer):', error);
                if (pc) {
                    try {
                        pc.close();
                    } catch (closeError) {
                        console.warn('[WebRTC] close error nach Answer:', closeError);
                    }
                }
                dropPeerConnection(data.from, 'answer-error');
            }
        };

        const handleAnswer = async (data) => {
            console.log('Kamera-Antwort erhalten von:', data.from);
            const pc = peerConnections.current[data.from];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                await processIceQueue(data.from, pc);

                if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg')) {
                    setTimeout(async () => {
                        console.log('[WebRTC] Edge: Zusätzliche Queue-Verarbeitung');
                        await processIceQueue(data.from, pc);
                    }, 500);
                }
            }
        };

        const handleIce = async (data) => {
            const pc = peerConnections.current[data.from];
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (error) {
                    console.error('ICE Candidate Fehler:', error);
                }
            } else {
                if (!iceCandidateQueue.current[data.from]) {
                    iceCandidateQueue.current[data.from] = [];
                }
                iceCandidateQueue.current[data.from].push(data.candidate);
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
    }, [createPeerConnection, dropPeerConnection, processIceQueue, roomId, socket]);

    return {
        localVideoRef,
        localStream,
        remoteStreams,
        isCameraEnabled,
        startCamera,
        stopCamera,
        autoConnectToOpponents
    };
};

export default useWebRTC;
