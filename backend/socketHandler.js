// backend/socketHandler.js

const { gameModes, X01Game } = require('./gameModes');

let onlineUsers = 0;
let connectedUsers = [];
let rooms = [];

function initializeSocket(io) {
    io.on('connection', (socket) => {
        // Add user to connected users list
        const user = { id: socket.id, name: `User_${socket.id.substring(0, 4)}` };
        connectedUsers.push(user);

        onlineUsers++;
        io.emit('updateOnlineUsers', onlineUsers);
        io.emit('connectedUsers', connectedUsers);
        console.log(`User connected: ${socket.id}, Online Users: ${onlineUsers}`);

        socket.on('getRooms', () => {
            socket.emit('updateRooms', rooms);
        });

        socket.on('getOnlineUsers', () => {
            console.log(`[GET_ONLINE_USERS] User ${socket.id} requested online users count: ${onlineUsers}, Timestamp: ${new Date().toISOString()}`);
            socket.emit('updateOnlineUsers', onlineUsers);
        });

        socket.on('getConnectedUsers', () => {
            socket.emit('connectedUsers', connectedUsers);
        });

        socket.on('createRoom', (roomData) => {
            console.log('!!! createRoom EVENT VOM CLIENT EMPFANGEN !!! Daten:', roomData);
            
            // Safely handle gameOptions to prevent server crash
            const gameOptions = (roomData && roomData.gameOptions) ? roomData.gameOptions : {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: roomData.roomName,
                gameMode: roomData.gameMode,
                gameOptions: gameOptions, // Store sanitized game options
                hostId: socket.id, // Store host ID
                maxPlayers: 2,
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`}],
                gameState: null, // Game state is null until game starts
                game: null // No game instance until game starts
            };
            console.log(`[CREATE_ROOM] New room object created:`, newRoom);
            
            // Manually set initial score for the first player
            newRoom.players[0].score = startScore;

            console.log(`[CREATE_ROOM] Before pushing room to array. Current rooms: ${rooms.length}`);
            rooms.push(newRoom);
            console.log(`[CREATE_ROOM] After pushing room to array. Current rooms: ${rooms.length}`);
            
            console.log(`[CREATE_ROOM] Before joining socket to room ${newRoom.id}`);
            socket.join(newRoom.id);
            console.log(`[CREATE_ROOM] After joining socket to room ${newRoom.id}`);

            console.log(`[CREATE_ROOM] Before emitting 'roomCreated' for roomId: ${newRoom.id}`);
            socket.emit('roomCreated', { roomId: newRoom.id });
            console.log(`[CREATE_ROOM] After emitting 'roomCreated' for roomId: ${newRoom.id}`);

            io.emit('updateRooms', rooms);
            console.log(`Raum erfolgreich erstellt: ${newRoom.name} (${newRoom.id})`);
        });

        socket.on('joinRoom', (data) => {
            console.log(`!!! joinRoom EVENT VOM CLIENT ${socket.id} EMPFANGEN !!! Will Raum beitreten:`, data.roomId);
            const room = rooms.find(r => r.id === data.roomId);

            if (room) {
                // Check if user already exists in the room (reconnection case)
                const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);

                if (existingPlayerIndex !== -1) {
                    // User is reconnecting, just update socket and join room
                    socket.join(room.id);
                    console.log(`Spieler ${socket.id} bereits im Raum ${room.id}, reconnection behandelt.`);

                    // Send current room state to the reconnected player
                    socket.emit('gameState', room);
                } else if (room.players.length < room.maxPlayers) {
                    // Safely handle gameOptions to prevent server crash
                    const gameOptions = room.gameOptions || {};
                    const startScore = parseInt(gameOptions.startingScore, 10) || 501;

                    const newPlayer = {
                        id: socket.id,
                        name: `Player ${Math.floor(Math.random() * 1000)}`,
                        score: startScore
                    };
                    room.players.push(newPlayer);
                    socket.join(room.id);

                    console.log(`Spieler ${socket.id} ist Raum ${room.id} beigetreten. Raum hat jetzt ${room.players.length} Spieler:`, room.players.map(p => p.id));

                    // CRITICAL: Send the updated room to EVERYONE in the room (including existing players)
                    io.to(room.id).emit('game-state-update', room);
                    // Also send to the new player individually
                    socket.emit('gameState', room);
                    io.emit('updateRooms', rooms);

                    console.log(`!!! SENT gameStateUpdate to ALL players in room ${room.id} !!!`);
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
                console.log(`WARNUNG: Raum ${roomId} wurde anfragt, aber nicht gefunden.`);
            }
        });

        socket.on('sendMessage', (message) => {
            console.log('!!! sendMessage EVENT VOM CLIENT EMPFANGEN !!! Nachricht:', message);
            if (message.roomId) {
                // In-game message
                io.to(message.roomId).emit('receiveMessage', message);
            } else {
                // Lobby message, needs user name
                const lobbyMessage = {
                    ...message,
                    user: `User_${socket.id.substring(0, 4)}` // Add a generic user name
                };
                io.emit('receiveMessage', lobbyMessage);
            }
        });

        socket.on('checkout-selection', (data) => {
            const { roomId, dartCount, userId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room || !room.game) {
                return console.error("Checkout-Selection: Game not running in this room.");
            }

            console.log(`!!! checkout-selection EVENT in Raum ${roomId} von ${userId} mit ${dartCount} Darts !!!`);

            // Store the checkout darts in the game state
            if (room.game.setCheckoutDarts) {
                room.game.setCheckoutDarts(dartCount);
            }

            room.gameState = room.game.getGameState();

            io.to(room.id).emit('game-state-update', room);
            console.log(`Checkout selection saved for Raum ${roomId}.`);
        });

        socket.on('rematch', (data) => {
            const { roomId, userId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                return console.error("Rematch: Room not found");
            }

            console.log(`!!! rematch EVENT für Raum ${roomId} von ${userId} !!!`);

            // Reverse players (switch starter)
            room.players.reverse();

            // Keep same game options for automatic takeover
            // The game settings are preserved

            // Reset game state
            room.gameState = null;
            room.game = null;

            io.to(room.id).emit('game-state-update', room);
            console.log(`Rematch in Raum ${roomId} gestartet. Spieler getauscht, Einstellungen übernommen.`);
        });

        // WebRTC Camera Signaling
        socket.on('camera-offer', (data) => {
            const { roomId, from, to, offer } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                return console.error("Camera-Offer: Room not found");
            }

            console.log(`!!! camera-offer EVENT in Raum ${roomId} von ${from} zu ${to} !!!`);

            // Send offer to the target player
            io.to(to).emit('camera-offer', data);
        });

        socket.on('camera-answer', (data) => {
            const { roomId, from, to, answer } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                return console.error("Camera-Answer: Room not found");
            }

            console.log(`!!! camera-answer EVENT in Raum ${roomId} von ${from} zu ${to} !!!`);

            // Send answer to the target player
            io.to(to).emit('camera-answer', data);
        });

        socket.on('camera-ice', (data) => {
            const { roomId, from, to, candidate } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                return console.error("Camera-ICE: Room not found");
            }

            console.log(`!!! camera-ice EVENT in Raum ${roomId} von ${from} zu ${to} !!!`);

            // Send ICE candidate to the target player
            io.to(to).emit('camera-ice', data);
        });



        socket.on('disconnect', () => {
            // Remove user from connected users list
            connectedUsers = connectedUsers.filter(user => user.id !== socket.id);

            onlineUsers--;
            io.emit('updateOnlineUsers', onlineUsers);
            io.emit('connectedUsers', connectedUsers);

            rooms.forEach(room => {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    if (room.players.length === 0) {
                        rooms = rooms.filter(r => r.id !== room.id);
                    }
                    io.to(room.id).emit('game-state-update', room);
                }
            });
            io.emit('updateRooms', rooms);
            console.log(`[DISCONNECT] User disconnected: ${socket.id}, Online Users: ${onlineUsers}, Timestamp: ${new Date().toISOString()}`);
        });
    });
}

module.exports = initializeSocket;
