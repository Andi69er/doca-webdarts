// backend/socketHandler.js

const { gameModes, X01Game } = require('./gameModes');

let onlineUsers = 0;
let connectedUsers = [];
let rooms = [];
let finishedGames = []; 

function initializeSocket(io, gameManager, auth) {
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
            socket.emit('updateOnlineUsers', onlineUsers);
        });

        socket.on('getConnectedUsers', () => {
            socket.emit('connectedUsers', connectedUsers);
        });

        socket.on('getFinishedGames', () => {
            const recentGames = finishedGames.slice(-20).reverse();
            socket.emit('finishedGames', recentGames);
        });

        socket.on('getRunningGames', () => {
            const running = rooms.filter(room => 
                room.game && room.gameState && 
                !room.gameState.gameWinner && 
                room.players.length >= 2
            ).map(room => ({
                id: room.id,
                name: room.name,
                roomName: room.name,
                gameMode: room.gameMode,
                players: room.players,
                gameOptions: room.gameOptions
            }));
            socket.emit('runningGames', running);
        });

        socket.on('createRoom', (roomData) => {
            console.log('!!! createRoom EVENT VOM CLIENT EMPFANGEN !!! Daten:', roomData);
            
            const gameOptions = (roomData && roomData.gameOptions) ? roomData.gameOptions : {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: roomData.roomName,
                gameMode: roomData.gameMode,
                gameOptions: gameOptions,
                whoStarts: roomData.whoStarts, 
                hostId: socket.id, 
                maxPlayers: 2,
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`}],
                gameState: null, 
                game: null 
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
                const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);

                if (existingPlayerIndex !== -1) {
                    socket.join(room.id);
                    console.log(`Spieler ${socket.id} bereits im Raum ${room.id}, reconnection behandelt.`);
                    // Send proper gameState format instead of raw room object
                    const gameState = room.gameState || {
                        mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                        players: room.players,
                        gameStatus: 'waiting',
                        hostId: room.hostId,
                        whoStarts: room.whoStarts
                    };
                    socket.emit('gameState', gameState);
                } else if (room.players.length < room.maxPlayers) {
                    const gameOptions = room.gameOptions || {};
                    const startScore = parseInt(gameOptions.startingScore, 10) || 501;

                    const newPlayer = {
                        id: socket.id,
                        name: `Player ${Math.floor(Math.random() * 1000)}`,
                        score: startScore
                    };
                    room.players.push(newPlayer);
                    socket.join(room.id);
                    socket.emit('roomJoined', { roomId: room.id });
                    
                    if (room.game) {
                        socket.emit('game-started', room.gameState);
                    }

                    console.log(`Spieler ${socket.id} ist Raum ${room.id} beigetreten.`);
                    // Only emit game-state-update if there's an active game
                    if (room.game && room.gameState) {
                        io.to(room.id).emit('game-state-update', room.gameState);
                    }
                    io.emit('updateRooms', rooms);
                } else {
                    socket.emit('gameError', { error: 'Room is full' });
                }
            } else {
                socket.emit('gameError', { error: 'Room not found' });
            }
        });

        // ==========================================
        // HIER IST DIE LOGIK FÜR DEN SPIELSTART
        // ==========================================
        socket.on('start-game', (data) => {
            console.log(`[SERVER] Received 'start-game' event. Payload:`, data);
            
            // 1. Daten extrahieren
            const { roomId, userId, startingPlayerId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                socket.emit('gameError', { error: 'Raum nicht gefunden' });
                return;
            }
            
            const isHost = room.players[0]?.id === userId || room.hostId === userId;
            
            if (!isHost) {
                socket.emit('gameError', { error: 'Nur der Host kann das Spiel starten' });
                return;
            }
            
            if (room.players.length < 2) {
                socket.emit('gameError', { error: 'Warte auf zweiten Spieler' });
                return;
            }

            const gameOptions = room.gameOptions || {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;

            // Spielinstanz neu erstellen
            if (room.gameMode === 'CricketGame') {
                const { CricketGame } = require('./gameModes');
                room.game = new CricketGame(gameOptions);
            } else {
                room.game = new X01Game(gameOptions);
            }
            
            // 2. Startspieler bestimmen (mit ausführlichem Debugging)
            let currentPlayerIndex = 0; // Standard: Host fängt an

            console.log("--- [DEBUG START-LOGIC] ---");
            console.log("Gewünschte Start-ID vom Frontend:", startingPlayerId);
            console.log("Spieler im Raum:", room.players.map((p, i) => `${i}: ${p.id} (${p.name})`));

            if (startingPlayerId) {
                // Wenn Frontend eine ID mitschickt (aus dem Dropdown)
                const foundIndex = room.players.findIndex(p => p.id === startingPlayerId);
                if (foundIndex !== -1) {
                    currentPlayerIndex = foundIndex;
                    console.log(`✅ ID gefunden an Index ${foundIndex}. Spieler ${startingPlayerId} beginnt.`);
                } else {
                    console.log(`⚠️ ID ${startingPlayerId} nicht im Raum gefunden. Fallback auf Index 0.`);
                }
            } else {
                // Fallback, wenn Frontend keine ID schickt (altes Frontend oder kein Dropdown gewählt)
                console.log("ℹ️ Keine startingPlayerId empfangen. Nutze Raumeinstellungen/Zufall.");
                if (room.whoStarts === 'opponent' && room.players.length >= 2) {
                    // Finde den Nicht-Host-Spieler
                    const opponentIndex = room.players.findIndex(p => p.id !== room.hostId);
                    currentPlayerIndex = opponentIndex !== -1 ? opponentIndex : 1;
                    console.log(`-> Einstellung 'opponent': Index ${currentPlayerIndex} beginnt.`);
            } else {
                    // Finde den Host-Spieler
                    const hostIndex = room.players.findIndex(p => p.id === room.hostId);
                    currentPlayerIndex = hostIndex !== -1 ? hostIndex : 0;
                    console.log(`-> Standard: Host (Index ${currentPlayerIndex}) beginnt.`);
                }
            }
            console.log("---------------------------");

            // 3. Spiel mit korrektem Index initialisieren
            room.game.initializePlayers(room.players.map(p => p.id), currentPlayerIndex);
            
            room.gameStarted = true;

// 4. GameState für Frontend bauen
            if (room.gameMode === 'CricketGame') {
                room.gameState = {
                    mode: 'cricket',
                    players: room.players.map((p, index) => ({
                        ...p,
                        points: 0,
                        marks: {15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0},
                        dartsThrown: 0,
                        isActive: index === currentPlayerIndex,
                        legs: 0
                    })),
                    currentPlayerIndex: currentPlayerIndex,
                    gameStatus: 'active',
                    lastThrow: null,
                    hostId: room.hostId,
                    whoStarts: room.whoStarts
                };
            } else {
                room.gameState = {
                    mode: 'x01',
                    players: room.players.map((p, index) => ({
                        ...p,
                        score: startScore,
                        dartsThrown: 0,
                        dartsThrownBeforeLeg: 0,
                        avg: '0.00',
                        isActive: index === currentPlayerIndex,
                        legs: 0,
                        scores: [],
                        turns: []
                    })),
                    currentPlayerIndex: currentPlayerIndex,
                    gameStatus: 'active',
                    lastThrow: null,
                    history: [],
                    hostId: room.hostId,
                    whoStarts: room.whoStarts,
                    turns: {}
                };
            }
            
            room.game.playerIds = room.players.map(p => p.id);

            io.to(roomId).emit('game-started', room.gameState);
            console.log(`Spiel gestartet. Index: ${currentPlayerIndex}, ID: ${room.players[currentPlayerIndex].id}`);
        });

        socket.on('score-input', (data) => {
            const { roomId, score, userId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room || !room.game) {
                return socket.emit('gameError', { error: 'Spiel nicht gestartet oder Raum nicht gefunden' });
            }

            const currentPlayerIndex = room.game.currentPlayerIndex || 0;
            const currentPlayer = room.players[currentPlayerIndex];

            if (currentPlayer?.id !== userId) {
                return socket.emit('gameError', { error: 'Nicht dein Zug' });
            }

            try {
                const result = room.game.processThrow(userId, score);

                if (!result.valid) {
                    return socket.emit('gameError', { error: result.reason });
                }

                // 2. GameState vom Spielobjekt holen (dieser ist jetzt die "Wahrheit")
                const newGameStateFromGame = room.game.getGameState();

                // 3. Spielerdaten für das Frontend aktualisieren (Statistiken etc.)
                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                const updatedPlayers = room.players.map((p, idx) => {
                    const isCurrentPlayer = p.id === userId;
                    const newDartsThrown = (p.dartsThrown || 0) + (isCurrentPlayer ? (room.gameMode === 'CricketGame' ? 1 : 3) : 0);
                    
                    let average = p.avg || "0.00";
                    if (room.gameMode !== 'CricketGame' && newDartsThrown > 0) {
                        const pointsScored = startScore - (newGameStateFromGame.scores[p.id] || startScore);
                        average = ((pointsScored / newDartsThrown) * 3).toFixed(2);
                    }

                    return {
                        ...p,
                        // Daten aus der Game-Instanz übernehmen
                        score: newGameStateFromGame.scores[p.id], // X01
                        points: newGameStateFromGame.scores[p.id], // Cricket
                        marks: newGameStateFromGame.marks ? newGameStateFromGame.marks[p.id] : p.marks,
                        
                        // Statistiken neu berechnen
                        dartsThrown: newDartsThrown,
                        avg: average,
                        isActive: idx === newGameStateFromGame.currentPlayerIndex,
                        lastScore: isCurrentPlayer ? score : (p.lastScore || 0),
                        legs: p.legs || 0, // TODO: Leg-Logik
                    };
                });
                room.players = updatedPlayers;

                // 4. Update-Payload für Clients erstellen
                const updateData = {
                    mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                    players: updatedPlayers,
                    gameStatus: newGameStateFromGame.winner ? 'finished' : 'active',
                    winner: newGameStateFromGame.winner,
                    currentPlayerIndex: newGameStateFromGame.currentPlayerIndex,
                    lastThrow: { playerId: userId, score },
                    hostId: room.hostId,
                    gameState: newGameStateFromGame, // Das komplette State-Objekt vom Spiel
                    dartsThrownInTurn: result.dartsThrownInTurn, // Wichtig für Cricket
                };

                // TODO: Leg-Gewinner-Logik hier einfügen, falls benötigt
                if (result.winner) {
                    // ...
                }

                // 5. Neuen State speichern und an Clients senden
                room.gameState = { ...updateData };
                io.to(roomId).emit('game-state-update', updateData);

            } catch (error) {
                console.error(`[SCORE-INPUT] Fehler:`, error);
                socket.emit('gameError', { error: 'Interner Serverfehler' });
            }
        });
        
        socket.on('getGameState', (roomId) => {
            const room = rooms.find(r => r.id === roomId);
            if(room) {
                // Return the gameState if it exists, otherwise return room info
                if (room.gameState) {
                    socket.emit('gameState', room.gameState);
                } else {
                    socket.emit('gameState', {
                        mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                        players: room.players,
                        gameStatus: 'waiting',
                        hostId: room.hostId,
                        whoStarts: room.whoStarts
                    });
                }
            }
        });

        socket.on('sendMessage', (message) => {
            if (message.roomId) {
                io.to(message.roomId).emit('receiveMessage', message);
            } else {
                const lobbyMessage = {
                    ...message,
                    user: `User_${socket.id.substring(0, 4)}` 
                };
                io.emit('receiveMessage', lobbyMessage);
            }
        });

        socket.on('checkout-selection', (data) => {
            const { roomId, dartCount } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room || !room.game) return;

            if (room.game.setCheckoutDarts) {
                room.game.setCheckoutDarts(dartCount);
            }
            room.gameState = room.game.getGameState();
            io.to(room.id).emit('game-state-update', room);
        });

        socket.on('rematch', (data) => {
            const { roomId } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;

            // Reverse players (switch starter)
            room.players.reverse();
            room.gameState = null;
            room.game = null;

            // Send a waiting state gameState instead of the room object
            const waitingState = {
                mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01', // Preserve the game mode
                players: room.players,
                gameStatus: 'waiting',
                hostId: room.hostId,
                whoStarts: room.whoStarts
            };
            io.to(room.id).emit('game-state-update', waitingState);
        });

// Bull-off logic
        socket.on('bull-off-submit', (data) => {
            const { roomId, playerId, throws } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;

            // Store the throws for this player
            if (!room.bullOffThrows) room.bullOffThrows = {};
            room.bullOffThrows[playerId] = throws;

            // Broadcast to all players in the room
            io.to(roomId).emit('bull-off-throws', { playerId, throws });
        });

        // Bull-off restart for sudden death phase
        socket.on('bull-off-restart', (data) => {
            const { roomId } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;

            // Clear previous throws for sudden death phase
            room.bullOffThrows = {};

            // Broadcast restart to all players
            io.to(roomId).emit('bull-off-restart', { roomId });
        });

        // WebRTC Camera Signaling
        socket.on('camera-offer', (data) => {
            const { roomId, to } = data;
            io.to(to).emit('camera-offer', data);
        });

        socket.on('camera-answer', (data) => {
            const { roomId, to } = data;
            io.to(to).emit('camera-answer', data);
        });

        socket.on('camera-ice', (data) => {
            const { roomId, to } = data;
            io.to(to).emit('camera-ice', data);
        });

        socket.on('disconnect', () => {
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
        });
    });
}

module.exports = initializeSocket;