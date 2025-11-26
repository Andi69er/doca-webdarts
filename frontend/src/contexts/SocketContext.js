import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    // NEU: State, um den Verbindungsstatus zu speichern
    const [socketConnected, setSocketConnected] = useState(false);

    useEffect(() => {
        const URL = process.env.REACT_APP_API_URL || 'https://doca-webdarts.onrender.com';
        const newSocket = io(URL, {
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
        });

        newSocket.on('connect', () => {
            console.log(`[FRONTEND_CONNECT] Connected to server: ${newSocket.id}, Timestamp: ${new Date().toISOString()}`);
            // NEU: Status auf 'verbunden' setzen
            setSocketConnected(true);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            // NEU: Status auf 'nicht verbunden' setzen
            setSocketConnected(false);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            // NEU: Status auf 'nicht verbunden' setzen
            setSocketConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Wichtig: socket und den neuen Status 'socketConnected' bereitstellen
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