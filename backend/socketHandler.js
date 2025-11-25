// backend/socketHandler.js

// Wir importieren die gameModes, da wir sie hier brauchen.
const { gameModes } = require('./gameModes');

let onlineUsers = 0;
let rooms = [];

function initializeSocket(io) {
    io.on('connection', (socket) => {
        onlineUsers++;
        io.emit('updateOnlineUsers', onlineUsers);
        console.log(`User connected: ${socket.id}, Online Users: ${onlineUsers}`);

        socket.on('getRooms', () => {
            socket.emit('updateRooms', rooms);
        });

        socket.on('getOnlineUsers', () => {
            socket.emit('updateOnlineUsers', onlineUsers);
        });

        socket.on('createRoom', (roomData) => {
            console.log('!!! createRoom EVENT VOM CLIENT EMPFANGEN !!! Daten:', roomData);

            // DER FINALE FIX IST HIER!
            // Wir nehmen den Start-Score jetzt aus den roomData, die vom Client kommen.
            const startScore = parseInt(roomData.gameOptions.startingScore, 10);

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: roomData.roomName,
                gameMode: roomData.gameMode,
                maxPlayers: roomData.maxPlayers,
                // UND WIR BENUTZEN IHN HIER!
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`, score: startScore }],
                gameState: {
                    currentPlayerIndex: 0,
                    scores: {},
                }
            };
            rooms.push(newRoom);
            socket.join(newRoom.id);
            socket.emit('roomCreated', { roomId: newRoom.id });
            io.emit('updateRooms', rooms);
            console.log(`Raum erfolgreich erstellt: ${newRoom.name} (${newRoom.id})`);
        });

        socket.on('joinRoom', (data) => {
           // ... (Logik für joinRoom)
        });

        socket.on('sendMessage', (message) => {
            console.log('!!! sendMessage EVENT VOM CLIENT EMPFANGEN !!! Nachricht:', message);
            io.emit('receiveMessage', { user: socket.id, text: message.text });
        });

        socket.on('disconnect', () => {
            onlineUsers--;
            io.emit('updateOnlineUsers', onlineUsers);
            // ... (restliche disconnect Logik)
            console.log(`User disconnected: ${socket.id}, Online Users: ${onlineUsers}`);
        });
    });
}

module.exports = initializeSocket;