import React, { createContext } from 'react';
import io from 'socket.io-client';

// Deine Online-Adresse
const URL = 'https://doca-webdarts.onrender.com';

// Wir fügen Optionen hinzu, damit die Verbindung stabiler ist
// und Timeouts nicht sofort zum Absturz führen
export const socket = io(URL, {
    transports: ['websocket', 'polling'], // Versucht modern (Websocket) und klassisch (Polling)
    reconnection: true,                   // Automatisch neu verbinden
    reconnectionAttempts: 10,             // Öfter versuchen (falls Server aufwacht)
    reconnectionDelay: 1000,              // Jede Sekunde neu versuchen
    timeout: 20000,                       // 20 Sekunden warten bevor "Timeout" kommt
    autoConnect: true
});

export const SocketContext = createContext(socket);