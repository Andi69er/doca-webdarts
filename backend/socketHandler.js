// backend/socketHandler.js

const { gameModes, X01Game } = require('./gameModes');

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

            const startScore = parseInt(roomData.gameOptions.startingScore, 10) || 501;

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: roomData.roomName,
                gameMode: roomData.gameMode,
                gameOptions: roomData.gameOptions, // Store game options
                hostId: socket.id, // Store host ID
                maxPlayers: 2,
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`}],
                gameState: null, // Game state is null until game starts
                game: null // No game instance until game starts
            };
            
            // Manually set initial score for the first player
            newRoom.players[0].score = startScore;

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
                    const startScore = room.gameOptions.startingScore || 501;

                    const newPlayer = {
                        id: socket.id,
                        name: `Player ${Math.floor(Math.random() * 1000)}`,
                        score: startScore
                    };
                    room.players.push(newPlayer);
                    socket.join(room.id);

                    console.log(`Spieler ${socket.id} ist Raum ${room.id} beigetreten.`);
                    
                    // Send the entire room object to the new player
                    socket.emit('gameState', room); 
                    // Inform others in the room about the new player
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

        socket.on('start-game', (data) => {
            const { roomId, userId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                return console.error("Start-Game: Room not found");
            }
            if (room.hostId !== userId) {
                return console.error("Start-Game: Only host can start the game");
            }
            if (room.game) {
                return console.error("Start-Game: Game already started");
            }

            console.log(`!!! start-game EVENT für Raum ${roomId} !!!`);
            
            let gameInstance;
            // For now, only X01 is implemented
            if (room.gameMode === 'X01Game') {
                 gameInstance = new X01Game(room.gameOptions);
                 gameInstance.initializePlayers(room.players);
            } else {
                console.error(`Game mode ${room.gameMode} not implemented on backend yet.`);
                return;
            }

            room.game = gameInstance;
            room.gameState = room.game.getGameState();

            io.to(room.id).emit('game-state-update', room);
            console.log(`Spiel in Raum ${roomId} gestartet. Sende initialen GameState.`);
        });

        socket.on('score-input', (data) => {
            const { roomId, score, userId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room || !room.game) {
                return console.error("Score-Input: Game not running in this room.");
            }

            console.log(`!!! score-input EVENT in Raum ${roomId} von ${userId} mit Score ${score} !!!`);
            
            const result = room.game.processThrow(userId, score);
            
            if (result.valid) {
                 room.gameState = room.game.getGameState();
                 io.to(room.id).emit('game-state-update', room);
                 console.log(`Wurf verarbeitet. Neuer Spielstand für Raum ${roomId} gesendet.`);
                 if(result.winner){
                     console.log(`!!! SPIEL BEENDET in Raum ${roomId}. Gewinner: ${result.winner} !!!`);
                 }
            } else {
                console.error(`Ungültiger Wurf in Raum ${roomId} von ${userId}. Grund: ${result.reason}`);
                // Optionally notify the user of the invalid throw
                socket.emit('gameError', { error: `Invalid throw: ${result.reason}` });
                // Even on invalid throw, game state might change (e.g., turn advances), so we send update
                room.gameState = room.game.getGameState();
                io.to(room.id).emit('game-state-update', room);
            }
        });
        
        socket.on('getGameState', (roomId) => {
            console.log(`!!! getGameState EVENT VOM CLIENT ${socket.id} EMPFANGEN für Raum ${roomId} !!!`);
            const room = rooms.find(r => r.id === roomId);
            if(room) {
                console.log(`Raum ${roomId} gefunden. Sende gameState an ${socket.id}.`);
                socket.emit('gameState', room); // FIX: Send the full room object
            } else {
                console.log(`WARNUNG: Raum ${roomId} wurde angefragt, aber nicht gefunden.`);
            }
        });

        socket.on('sendMessage', (message) => {
            console.log('!!! sendMessage EVENT VOM CLIENT EMPFANGEN !!! Nachricht:', message);
            // FIX: Broadcast to the specific room and send the original message object
            io.to(message.roomId).emit('receiveMessage', message);
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