import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

const buildCandidateUrls = () => {
    const urls = [];
    const addUrl = (value) => {
        const trimmed = value?.trim();
        if (!trimmed) {
            return;
        }
        const normalized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
        if (!urls.includes(normalized)) {
            urls.push(normalized);
        }
    };

    if (process.env.REACT_APP_API_URL) {
        addUrl(process.env.REACT_APP_API_URL);
    }

    if (typeof window !== 'undefined') {
        const { protocol, hostname, port } = window.location;
        const buildUrl = (customPort) => `${protocol}//${hostname}${customPort ? `:${customPort}` : ''}`;
        if (port && port !== '3000') {
            addUrl(buildUrl(port));
        }
        if (port === '3000') {
            addUrl(buildUrl('3002'));
            addUrl(buildUrl('3001'));
        }
        if (!port) {
            addUrl(buildUrl());
            addUrl(buildUrl('3001'));
            addUrl(buildUrl('3002'));
        }
    } else {
        addUrl('http://localhost:3001');
        addUrl('http://localhost:3002');
    }

    addUrl('http://localhost:3001');
    addUrl('http://localhost:3002');

    return urls;
};

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);

    useEffect(() => {
        const candidates = buildCandidateUrls();
        let isMounted = true;
        let activeSocket = null;
        let attemptIndex = 0;

        const connectToNext = () => {
            if (!isMounted || attemptIndex >= candidates.length) {
                console.error('No reachable socket server candidates:', candidates);
                return;
            }

            const targetUrl = candidates[attemptIndex++];
            console.log('Connecting to socket server at:', targetUrl);

            const nextSocket = io(targetUrl, {
                transports: ['websocket'],
                reconnection: false,
                timeout: 10000,
                withCredentials: false,
                autoConnect: true,
                forceNew: true
            });

            activeSocket = nextSocket;
            setSocket(nextSocket);
            setSocketConnected(false);

            const handleConnect = () => {
                if (!isMounted) {
                    return;
                }
                nextSocket.io.opts.reconnection = true;
                console.log(`[FRONTEND_CONNECT] Connected to server: ${nextSocket.id}, Timestamp: ${new Date().toISOString()}`);
                setSocketConnected(true);
            };

            const handleDisconnect = (reason) => {
                if (!isMounted) {
                    return;
                }
                console.log('Disconnected from server:', reason);
                setSocketConnected(false);
            };

            const handleConnectError = (error) => {
                console.error('Connection error for', targetUrl, error.message);
                nextSocket.off('connect', handleConnect);
                nextSocket.off('disconnect', handleDisconnect);
                nextSocket.off('connect_error', handleConnectError);
                nextSocket.close();
                if (!isMounted) {
                    return;
                }
                if (activeSocket === nextSocket) {
                    activeSocket = null;
                }
                setSocket(null);
                connectToNext();
            };

            nextSocket.once('connect', handleConnect);
            nextSocket.on('disconnect', handleDisconnect);
            nextSocket.once('connect_error', handleConnectError);
        };

        connectToNext();

        return () => {
            isMounted = false;
            if (activeSocket) {
                activeSocket.disconnect();
            }
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
