// backend/socketHandler.js

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
            console.log(`[GET_ONLINE_USERS] User ${socket.id} requested online users count: ${onlineUsers}, Timestamp: ${new Date().toISOString()}`);
            socket.emit('updateOnlineUsers', onlineUsers);
        });

        socket.on('createRoom', (roomData) => {
            console.log('!!! createRoom EVENT VOM CLIENT EMPFANGEN !!! Daten:', roomData);

            const startScore = parseInt(roomData.gameOptions.startingScore, 10) || 0;

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: roomData.roomName,
                gameMode: roomData.gameMode,
                maxPlayers: 2,
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`, score: startScore, throws: [] }],
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
            console.log(`!!! joinRoom EVENT VOM CLIENT ${socket.id} EMPFANGEN !!! Will Raum beitreten:`, data.roomId);
            const room = rooms.find(r => r.id === data.roomId);

            if (room) {
                if (room.players.length < room.maxPlayers) {
                    const startScore = room.players.length > 0 ? room.players[0].score : 0;

                    const newPlayer = {
                        id: socket.id,
                        name: `Player ${Math.floor(Math.random() * 1000)}`,
                        score: startScore,
                        throws: []
                    };
                    room.players.push(newPlayer);
                    socket.join(room.id);

                    console.log(`Spieler ${socket.id} ist Raum ${room.id} beigetreten.`);

                    socket.emit('gameState', room.gameState);
                    io.to(room.id).emit('gameStateUpdate', room);
                    io.emit('updateRooms', rooms);
                } else {
                    socket.emit('gameError', { error: 'Room is full' });
                    console.log(`Beitritt zu Raum ${data.roomId} fehlgeschlagen: Raum ist voll.`);
                }
            } else {
                socket.emit('gameError', { error: 'Room not found' });
                console.log(`Beitritt zu Raum ${data.roomId} fehlgeschlagen: Raum nicht gefunden.`);
            }
        });
        
        // RAUCHZEICHEN HIER HINZUGEFÜGT
        socket.on('getGameState', (roomId) => {
            console.log(`!!! getGameState EVENT VOM CLIENT ${socket.id} EMPFANGEN für Raum ${roomId} !!!`);
            const room = rooms.find(r => r.id === roomId);
            if(room) {
                console.log(`Raum ${roomId} gefunden. Sende gameState an ${socket.id}.`);
                socket.emit('gameState', room.gameState);
            } else {
                console.log(`WARNUNG: Raum ${roomId} wurde angefragt, aber nicht gefunden.`);
            }
        });

        socket.on('sendMessage', (message) => {
            console.log('!!! sendMessage EVENT VOM CLIENT EMPFANGEN !!! Nachricht:', message);
            io.emit('receiveMessage', { user: socket.id, text: message.text });
        });

        socket.on('disconnect', () => {
            onlineUsers--;
            io.emit('updateOnlineUsers', onlineUsers);
            rooms.forEach(room => {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    if (room.players.length === 0) {
                        rooms = rooms.filter(r => r.id !== room.id);
                    }
                    io.to(room.id).emit('gameStateUpdate', room);
                }
            });
            io.emit('updateRooms', rooms);
            console.log(`[DISCONNECT] User disconnected: ${socket.id}, Online Users: ${onlineUsers}, Timestamp: ${new Date().toISOString()}`);
        });
    });
}

module.exports = initializeSocket;