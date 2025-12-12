import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);

    useEffect(() => {
        // URL definieren
        const URL = process.env.REACT_APP_API_URL || 'https://doca-webdarts.onrender.com';
        console.log('Connecting to socket server at:', URL);

        // --- VERBESSERTE SOCKET KONFIGURATION ---
        const newSocket = io(URL, {
            transports: ['websocket'],  // Nur WebSockets für bessere Performance
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,  // 10 Sekunden Timeout
            withCredentials: false,  // Erstmal deaktivieren
            autoConnect: true,
            forceNew: true
        });

        // Debugging-Ausgaben
        console.log('Socket-Initialisierung abgeschlossen');
        console.log('Verbindungsparameter:', {
            url: URL,
            connected: newSocket.connected,
            id: newSocket.id
        });
        // -------------------------------------------

        newSocket.on('connect', () => {
            console.log(`[FRONTEND_CONNECT] Connected to server: ${newSocket.id}, Timestamp: ${new Date().toISOString()}`);
            setSocketConnected(true);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            // Wir setzen es nicht sofort auf false, vielleicht klappt der nächste Versuch
            // Aber für die UI Anzeige ist es okay:
            setSocketConnected(false);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            setSocketConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const value = {
        socket,
        socketConnected
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};