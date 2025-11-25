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
            socket.emit('updateOnlineUsers', onlineUsers);
        });

        socket.on('createRoom', (roomData) => {
            console.log('!!! createRoom EVENT VOM CLIENT EMPFANGEN !!! Daten:', roomData);

            const startScore = parseInt(roomData.gameOptions.startingScore, 10) || 0;

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: roomData.roomName,
                gameMode: roomData.gameMode,
                maxPlayers: 2, // Hardcoded for now, can be an option later
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`, score: startScore, throws: [] }],
                gameState: {
                    currentPlayerIndex: 0,
                    scores: {},
                    // Add other initial game state properties here
                }
            };
            rooms.push(newRoom);
            socket.join(newRoom.id);
            socket.emit('roomCreated', { roomId: newRoom.id });
            io.emit('updateRooms', rooms);
            console.log(`Raum erfolgreich erstellt: ${newRoom.name} (${newRoom.id})`);
        });

        // KORRIGIERTER UND VOLLSTÄNDIGER CODEBLOCK
        socket.on('joinRoom', (data) => {
            console.log(`!!! joinRoom EVENT VOM CLIENT ${socket.id} EMPFANGEN !!! Will Raum beitreten:`, data.roomId);
            const room = rooms.find(r => r.id === data.roomId);

            if (room) {
                if (room.players.length < room.maxPlayers) {
                    const startScore = room.players.length > 0 ? room.players[0].score : 0; // Inherit score from first player
                    
                    const newPlayer = {
                        id: socket.id,
                        name: `Player ${Math.floor(Math.random() * 1000)}`,
                        score: startScore,
                        throws: []
                    };
                    room.players.push(newPlayer);
                    socket.join(room.id);

                    console.log(`Spieler ${socket.id} ist Raum ${room.id} beigetreten.`);
                    
                    // SENDE DAS ENTSCHEIDENDE UPDATE AN ALLE IM RAUM
                    io.to(room.id).emit('gameStateUpdate', room);
                    // Update auch die Lobby-Ansicht
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
        
        // Listener für den Fall, dass ein Client den initialen GameState anfordert
        socket.on('getGameState', (roomId) => {
            const room = rooms.find(r => r.id === roomId);
            if(room) {
                // Sende den State nur an den anfragenden Client
                socket.emit('gameStateUpdate', room);
            }
        });

        socket.on('sendMessage', (message) => {
            console.log('!!! sendMessage EVENT VOM CLIENT EMPFANGEN !!! Nachricht:', message);
            io.emit('receiveMessage', { user: socket.id, text: message.text });
        });

        socket.on('disconnect', () => {
            onlineUsers--;
            io.emit('updateOnlineUsers', onlineUsers);
            // Additional logic to remove player from rooms on disconnect
            rooms.forEach(room => {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    // Wenn der Raum leer ist, lösche ihn
                    if (room.players.length === 0) {
                        rooms = rooms.filter(r => r.id !== room.id);
                    }
                    io.to(room.id).emit('gameStateUpdate', room); // Inform others in the room
                }
            });
            io.emit('updateRooms', rooms); // Update lobby for everyone
            console.log(`User disconnected: ${socket.id}, Online Users: ${onlineUsers}`);
        });
    });
}

module.exports = initializeSocket;