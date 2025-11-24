import React, { createContext } from 'react';
import io from 'socket.io-client';

// Erstelle die Verbindung zum Live-Server
export const socket = io('https://projekt.doca.at/www.doca.at/', {
  transports: ['websocket', 'polling']
});

// Add logging for connection status
socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('reconnect', (attempt) => {
  console.log('Reconnected after', attempt, 'attempts');
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error);
});

// Erstelle den Context, den andere Teile der App benutzen können
export const SocketContext = createContext(socket);