// backend/socketHandler.js

const { gameModes, X01Game } = require('./gameModes');

let onlineUsers = 0;
let connectedUsers = [];
let rooms = [];
let finishedGames = []; // Array für beendete Spiele

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
            console.log(`[GET_ONLINE_USERS] User ${socket.id} requested online users count: ${onlineUsers}, Timestamp: ${new Date().toISOString()}`);
            socket.emit('updateOnlineUsers', onlineUsers);
        });

        socket.on('getConnectedUsers', () => {
            socket.emit('connectedUsers', connectedUsers);
        });

        socket.on('getFinishedGames', () => {
            // Sende die letzten 20 beendeten Spiele
            const recentGames = finishedGames.slice(-20).reverse();
            socket.emit('finishedGames', recentGames);
        });

        socket.on('getRunningGames', () => {
            // Sende alle laufenden Spiele (Spiel gestartet, aber nicht beendet)
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
                    socket.emit('roomJoined', { roomId: room.id });
                    
                    // Wenn das Spiel bereits läuft, sende den aktuellen Spielstatus an den neuen Spieler
                    if (room.game) {
                        socket.emit('game-started', room.gameState);
                    }

                    console.log(`Spieler ${socket.id} ist Raum ${room.id} beigetreten. Raum hat jetzt ${room.players.length} Spieler:`, room.players.map(p => p.id));

                    // CRITICAL: Send the updated room to EVERYONE in the room (including existing players)
                    io.to(room.id).emit('game-state-update', room);
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
            console.log(`[SERVER] Received 'start-game' event with data:`, data);
            const { roomId, userId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                console.log(`[SERVER] Start-Game Fehler: Raum ${roomId} nicht gefunden.`);
                socket.emit('gameError', { error: 'Raum nicht gefunden' });
                return;
            }
            
            console.log(`[SERVER] Start-Game: Raum ${roomId} gefunden. HostId: ${room.hostId}, UserId: ${userId}, Players:`, room.players.map(p => p.id));
            
            const isHost = room.players[0]?.id === userId || room.hostId === userId;
            
            if (!isHost) {
                console.log(`[SERVER] Start-Game Fehler: User ${userId} ist nicht der Host von Raum ${roomId}.`);
                socket.emit('gameError', { error: 'Nur der Host kann das Spiel starten' });
                return;
            }
            
            console.log(`[SERVER] Start-Game: User ${userId} ist der Host.`);
            
            if (room.game) {
                console.log(`[SERVER] Start-Game Fehler: Spiel in Raum ${roomId} bereits gestartet.`);
                socket.emit('gameError', { error: 'Spiel bereits gestartet' });
                return;
            }
            
            if (room.players.length < 2) {
                console.log(`[SERVER] Start-Game Fehler: Nicht genug Spieler in Raum ${roomId}.`);
                socket.emit('gameError', { error: 'Warte auf zweiten Spieler' });
                return;
            }

            const gameOptions = room.gameOptions || {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;

            room.game = new X01Game(gameOptions);
            room.game.initializePlayers(room.players);
            room.gameStarted = true;
            
// whoStarts-Logik implementieren
            let currentPlayerIndex = 0;
            if (room.whoStarts === 'opponent' && room.players.length >= 2) {
                currentPlayerIndex = 1; // Gegner beginnt
            } else if (room.whoStarts === 'random') {
                currentPlayerIndex = Math.random() < 0.5 ? 0 : 1; // Zufällig
            }
            // 'me' → currentPlayerIndex = 0 (Standard, Host beginnt)

            room.gameState = {
                players: room.players.map((p, index) => ({
                    ...p,
                    score: startScore,
                    dartsThrown: 0,
                    dartsThrownBeforeLeg: 0, // Add this line
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
                turns: {} // Initialisiere turns hier
            };

            room.game.playerIds = room.players.map(p => p.id);

            console.log(`[START-GAME] Sende game-started Event an alle Spieler in Raum ${roomId}`, room.gameState);
            io.to(roomId).emit('game-started', room.gameState);
            console.log(`Spiel in Raum ${roomId} gestartet von Host ${userId} mit Startscore ${startScore}`);
        });

        socket.on('score-input', (data) => {
            const { roomId, score, userId, nextPlayerIndex } = data;
            const room = rooms.find(r => r.id === roomId);
            
            if (!room || !room.game) {
                console.error(`[SCORE-INPUT] Spiel in Raum ${roomId} nicht gefunden oder nicht gestartet`);
                return socket.emit('gameError', { error: 'Spiel nicht gestartet oder Raum nicht gefunden' });
            }

            const currentPlayerIndex = room.game.currentPlayerIndex || 0;
            const currentPlayer = room.players[currentPlayerIndex];
            
            if (currentPlayer?.id !== userId) {
                console.log(`[SCORE-INPUT] Spieler ${userId} ist nicht am Zug`);
                return socket.emit('gameError', { error: 'Nicht dein Zug' });
            }

            console.log(`[SCORE-INPUT] Eingabe von ${userId} in Raum ${roomId}: ${score} Punkte`);
            console.log(`[SCORE-INPUT] Aktueller Score vor Wurf: ${room.game.scores[userId]}`);
            
            try {
                const result = room.game.processThrow(userId, parseInt(score));

                if (!result.valid) {
                    console.log(`[SCORE-INPUT] Ungültiger Wurf: ${result.reason}`);
                    return socket.emit('gameError', { error: result.reason });
                }

                console.log(`[SCORE-INPUT] Score nach Wurf: ${room.game.scores[userId]}`);
                console.log(`[SCORE-INPUT] Nächster Spieler Index: ${room.game.currentPlayerIndex}`);
                
                const gameOptions = room.gameOptions || {};
                const startScore = parseInt(gameOptions.startingScore, 10) || 501;
                
                let legWinnerId = null;
                if (result.winner) {
                    legWinnerId = result.winner;
                }

                const updatedPlayers = room.players.map((p, idx) => {
                    const isCurrentPlayer = idx === currentPlayerIndex;
                    const newDartsThrown = (p.dartsThrown || 0) + (isCurrentPlayer ? 3 : 0);
                    
                    const newScores = isCurrentPlayer ? [...(p.scores || []), parseInt(score)] : (p.scores || []);
                    const newScores180 = isCurrentPlayer && parseInt(score) === 180 ? (p.scores180 || 0) + 1 : (p.scores180 || 0);

                    const pointsScored = startScore - room.game.scores[p.id];
                    const average = newDartsThrown > 0 ? ((pointsScored / newDartsThrown) * 3).toFixed(2) : "0.00";
                    
                    let first9Avg = p.first9Avg || "0.00";
                    if (newDartsThrown >= 9) {
                        const first9Scores = newScores.slice(0, 3);
                        const totalPointsFirst9 = first9Scores.reduce((acc, s) => acc + s, 0);
                        first9Avg = ((totalPointsFirst9 / 9) * 3).toFixed(2);
                    }

                    return {
                        ...p,
                        score: room.game.scores[p.id],
                        dartsThrown: newDartsThrown,
                        avg: average,
                        average: average,
                        isActive: idx === room.game.currentPlayerIndex,
                        lastScore: isCurrentPlayer ? score : (p.lastScore || 0),
                        scores: newScores,
                        first9Avg: first9Avg,
                        scores180: newScores180,
                        legs: p.legs || 0
                    };
                });
                
                room.players = updatedPlayers;
                
                const updateData = {
                    players: updatedPlayers,
                    gameStatus: 'active',
                    currentPlayerIndex: room.game.currentPlayerIndex,
                    lastThrow: { playerId: userId, score },
                    gameState: {
                        currentPlayerIndex: room.game.currentPlayerIndex,
                        lastThrow: { playerId: userId, score }
                    },
                    hostId: room.hostId,
                    turns: room.gameState.turns || {}
                };

                if (legWinnerId) {
                    console.log(`[LEG-WINNER] Spieler ${legWinnerId} hat das Leg gewonnen.`);
                    
                    const winnerPlayer = room.players.find(p => p.id === legWinnerId);
                    const dartsThisLeg = winnerPlayer.dartsThrown - (winnerPlayer.dartsThrownBeforeLeg || 0);

                    if (!updateData.turns[legWinnerId]) {
                        updateData.turns[legWinnerId] = [];
                    }
                    updateData.turns[legWinnerId].push(dartsThisLeg);

                    winnerPlayer.legs += 1;

                    const legsToWin = room.gameOptions.legsToWin || 1;

                    if (winnerPlayer.legs >= legsToWin) {
                        updateData.gameStatus = 'finished';
                        updateData.winner = legWinnerId;
                        console.log(`[GAME-OVER] Spiel beendet! Gewinner: ${legWinnerId}`);
                    } else {
                        // Reset for next leg ONLY if game is not over
                        room.players.forEach(p => {
                            p.score = startScore;
                            p.dartsThrownBeforeLeg = p.dartsThrown;
                        });
                        
                        room.game.scores = {};
                        room.players.forEach(p => {
                            room.game.scores[p.id] = startScore;
                        });

                        console.log(`[NEW-LEG] Nächstes Leg gestartet. Scores zurückgesetzt.`);
                    }

                    updateData.players = room.players;
                }
                
                room.gameState = {
                    ...updateData
                };

                console.log(`[SCORE-INPUT] Sende Update an alle Spieler in Raum ${roomId}:`, {
                    currentPlayerIndex: updateData.currentPlayerIndex,
                    scores: updatedPlayers.map(p => ({ id: p.id, score: p.score }))
                });

                io.to(roomId).emit('game-state-update', updateData);
            } catch (error) {
                console.error(`[SCORE-INPUT] Fehler bei der Verarbeitung des Wurfs:`, error);
                socket.emit('gameError', { error: 'Interner Serverfehler' });
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
