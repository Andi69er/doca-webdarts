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
            console.log('\n=== CREATE ROOM START ===');
            console.log('1. RAW roomData received:', JSON.stringify(roomData, null, 2));
            console.log('2. roomData.gameOptions:', JSON.stringify(roomData.gameOptions, null, 2));
            
            // REPARATUR: Daten aus der Lobby robust auslesen
            // Wir kombinieren roomData und gameOptions, falls das Frontend es unterschiedlich schickt
            // WICHTIG: Die spezifischeren gameOptions müssen die allgemeinen roomData überschreiben.
            const flatData = { ...roomData, ...(roomData.gameOptions || {}), ...roomData.gameOptions };

            
            console.log('3. flatData after merge:', JSON.stringify(flatData, null, 2));

            const startScore = parseInt(flatData.startingScore, 10) || 501;
            const sets = parseInt(flatData.sets, 10) || 0;
            const legs = parseInt(flatData.legs, 10) || 1;
            
            console.log('4. Parsed values:', {
                startScore,
                sets,
                legs,
                startingScore_raw: flatData.startingScore,
                sets_raw: flatData.sets,
                legs_raw: flatData.legs,
                winType_raw: flatData.winType
            });
            
            // Best Of / First To Logik
            const winType = flatData.winType || 'firstTo';
            const isBestOf = winType === 'bestOf';
            
            console.log('5. WinType logic:', { winType, isBestOf });

            const gameOptions = {
                startingScore: startScore,
                inMode: flatData.inMode || 'single',
                outMode: flatData.outMode || 'double',
                sets: sets,
                legs: legs,
                winType: winType,
                length: { 
                    type: isBestOf ? 'bestOf' : 'firstTo', 
                    value: sets > 0 ? sets : legs 
                },
                checkIn: flatData.inMode || 'single',
                checkOut: flatData.outMode || 'double'
            };
            
            console.log('6. Final gameOptions object:', JSON.stringify(gameOptions, null, 2));

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: flatData.roomName || roomData.roomName,
                gameMode: gameOptions.gameMode || flatData.gameMode || roomData.gameMode, // Nehmen Sie den Modus aus den finalen Optionen
                gameOptions: gameOptions, // Verwenden Sie die neu erstellten, korrekten Optionen
                whoStarts: flatData.whoStarts || roomData.whoStarts, 
                hostId: socket.id, 
                maxPlayers: 2,
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`}],
                spectators: [],
                gameState: null, 
                game: null 
            };
            
            console.log('7. Complete newRoom object:', JSON.stringify(newRoom, null, 2));
            console.log('8. newRoom.gameOptions:', JSON.stringify(newRoom.gameOptions, null, 2));
            
            newRoom.players[0].score = startScore;
            rooms.push(newRoom);
            console.log('9. Room added to rooms array. Total rooms:', rooms.length);
            
            socket.join(newRoom.id);
            socket.emit('roomCreated', { roomId: newRoom.id });
            io.emit('updateRooms', rooms);
            console.log('=== CREATE ROOM END ===\n');
        });

        socket.on('joinRoom', (data) => {
            const room = rooms.find(r => r.id === data.roomId);

            if (room) {
                // Allow rejoining by checking for a player with a matching name from the client
                const rejoiningPlayer = data.playerName ? room.players.find(p => p.name === data.playerName && p.disconnected) : null;
                const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);

                if (rejoiningPlayer) {
                    // Player is rejoining after a disconnect
                    const oldId = rejoiningPlayer.id;
                    rejoiningPlayer.id = socket.id; // Update to the new socket ID
                    rejoiningPlayer.disconnected = false;
                    socket.join(room.id);

                    io.to(room.id).emit('receiveMessage', {
                        user: 'System',
                        text: `${rejoiningPlayer.name} hat die Verbindung wiederhergestellt.`
                    });

                    if (room.gameState && room.gameState.players) {
                        const gamePlayerIndex = room.gameState.players.findIndex(p => p.id === oldId);
                        if (gamePlayerIndex !== -1) {
                            room.gameState.players[gamePlayerIndex].id = socket.id;
                        }
                    }
                    io.to(room.id).emit('game-state-update', room.gameState);
                    socket.emit('gameState', room.gameState);

                } else if (existingPlayerIndex !== -1) {

const gameState = room.gameState || {
                        mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                        players: room.players,
                        gameStatus: 'waiting',
                        hostId: room.hostId,
                        whoStarts: room.whoStarts,
                        gameOptions: room.gameOptions,
                        gameMode: room.gameMode // FÜR DEBUG: Original Mode behalten
                    };
                    socket.emit('gameState', gameState);
                } else if (room.players.length < room.maxPlayers) {
                    // REPARATUR: Score aus Options
                    const gameOptions = room.gameOptions || {};
                    const startScore = parseInt(gameOptions.startingScore, 10) || 501;

                    const newPlayer = {
                        id: socket.id,
                        name: `Player ${Math.floor(Math.random() * 1000)}`,
                        score: startScore
                    };
                    room.players.push(newPlayer);
                    socket.join(room.id);

                    io.to(room.id).emit('receiveMessage', {
                        user: 'System',
                        text: `${newPlayer.name} ist dem Raum beigetreten.`
                    });

                    socket.emit('roomJoined', { roomId: room.id });
                    
                    if (room.game) {
                        socket.emit('game-started', room.gameState);
                    }

                    io.to(room.id).emit('game-state-update', room.gameState);
                    io.emit('updateRooms', rooms);
                } else {
                    if (!room.spectators) room.spectators = [];
                    const newSpectator = {
                        id: socket.id,
                        name: `Zuschauer_${socket.id.substring(0, 4)}`
                    };
                    room.spectators.push(newSpectator);
                    socket.join(room.id);
                    io.to(room.id).emit('receiveMessage', {
                        user: 'System',
                        text: `${newSpectator.name} schaut jetzt zu.`
                    });
                    socket.emit('joinedAsSpectator', { roomId: room.id });
                    socket.emit('game-state-update', room.gameState);
                }
            } else {
                socket.emit('gameError', { error: 'Room not found' });
            }
        });

        socket.on('changePlayerName', (data) => {
            const { roomId, userId, newName } = data;
            if (!newName || newName.trim().length < 3 || newName.trim().length > 15) {
                return socket.emit('gameError', { error: 'Name muss zwischen 3 und 15 Zeichen lang sein.' });
            }

            const room = rooms.find(r => r.id === roomId);
            if (!room) return socket.emit('gameError', { error: 'Raum nicht gefunden.' });

            const player = room.players.find(p => p.id === userId);
            if (!player) {
                const spectator = room.spectators.find(s => s.id === userId);
                if (spectator) spectator.name = newName.trim();
            } else {
                const oldName = player.name;
                player.name = newName.trim();

                if (room.gameState && room.gameState.players) {
                    const playerInGameState = room.gameState.players.find(p => p.id === userId);
                    if (playerInGameState) {
                        playerInGameState.name = newName.trim();
                    }
                }
                io.to(room.id).emit('receiveMessage', { user: 'System', text: `${oldName} heißt jetzt ${player.name}.` });
            }
            io.to(room.id).emit('game-state-update', room.gameState);
        });

        socket.on('kickPlayer', (data) => {
            const { roomId, playerIdToKick } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return socket.emit('gameError', { error: 'Raum nicht gefunden.' });

            if (room.hostId !== socket.id) {
                return socket.emit('gameError', { error: 'Nur der Host kann Spieler kicken.' });
            }

            const playerToKick = room.players.find(p => p.id === playerIdToKick);
            if (!playerToKick) return socket.emit('gameError', { error: 'Spieler nicht im Raum gefunden.' });

            const kickedSocket = io.sockets.sockets.get(playerIdToKick);
            if (kickedSocket) {
                kickedSocket.leave(roomId);
                kickedSocket.emit('youHaveBeenKicked', { message: 'Du wurdest vom Host aus dem Raum entfernt.' });
            }

            room.players = room.players.filter(p => p.id !== playerIdToKick);
            io.to(roomId).emit('receiveMessage', { user: 'System', text: `${playerToKick.name} wurde vom Host entfernt.` });
            io.to(roomId).emit('game-state-update', { ...room.gameState, players: room.players });
            io.emit('updateRooms', rooms);
        });

socket.on('start-game', (data) => {
            console.log('\n=== START GAME START ===');
            console.log('1. start-game data received:', JSON.stringify(data, null, 2));
            
            const { roomId, userId, startingPlayerId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) {
                console.log('ERROR: Room not found:', roomId);
                return socket.emit('gameError', { error: 'Raum nicht gefunden' });
            }
            
            console.log('2. Found room:', JSON.stringify(room, null, 2));
            console.log('3. Room gameOptions:', JSON.stringify(room.gameOptions, null, 2));
            
            // KORREKTUR 1: Wer darf das Spiel starten?
            // Der Host darf immer starten. Wenn der Gegner starten soll, darf dieser es auch.
            const hostId = room.hostId;
            const opponent = room.players.find(p => p.id !== hostId);
            const isHostRequest = userId === hostId;
            const isOpponentRequest = opponent && userId === opponent.id;

            // Spiel darf gestartet werden, wenn der Anfragende der Host ist,
            // ODER wenn der Gegner starten soll UND die Anfrage vom Gegner kommt.
            const canStart = isHostRequest || (room.whoStarts === 'opponent' && isOpponentRequest);

            if (!canStart) {
                console.log('ERROR: User not authorized to start game.');
                return socket.emit('gameError', { error: 'Du bist nicht berechtigt, das Spiel zu starten.' });
            }

            if (room.players.length < 2) {
                console.log('ERROR: Not enough players:', room.players.length);
                return socket.emit('gameError', { error: 'Warte auf zweiten Spieler' });
            }

            // REPARATUR: Optionen explizit aus dem Raumobjekt laden
            const gameOptions = room.gameOptions || {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;
            
            console.log('4. Loaded gameOptions:', JSON.stringify(gameOptions, null, 2));
            console.log('5. startScore:', startScore);

            if (room.gameMode === 'CricketGame') {
                const { CricketGame } = require('./gameModes');
                room.game = new CricketGame(gameOptions);
                console.log('6. Created CricketGame with options:', JSON.stringify(gameOptions, null, 2));
            } else {
                room.game = new X01Game(gameOptions);
                console.log('6. Created X01Game with options:', JSON.stringify(gameOptions, null, 2));
            }
            
            // STATISTIK RESET: Hier werden Spielerdaten zurückgesetzt, aber persistente Statistiken bleiben erhalten!
            room.players.forEach(p => {
                p.score = startScore;
                
                // Nicht-persistente Statistiken zurücksetzen:
                p.dartsThrown = 0; // Pro-Leg Darts
                p.avg = "0.00"; // Pro-Leg Average
                p.scores = []; // Pro-Leg Scores
                p.legs = 0; // Wird vom Game-State verwaltet
                p.sets = 0; // Wird vom Game-State verwaltet
                p.history = [];
                p.lastScore = 0;
                p.scores180 = 0;
                p.scores60plus = 0;
                p.scores100plus = 0;
                p.scores140plus = 0;

                // REPARATUR: Persistente Statistiken NICHT löschen, wenn sie existieren
                if (p.highestFinish === undefined) p.highestFinish = 0;
                if (p.bestLeg === undefined) p.bestLeg = null;
                if (p.matchDartsThrown === undefined) p.matchDartsThrown = 0;
                if (p.matchPointsScored === undefined) p.matchPointsScored = 0;
                if (p.doublesHit === undefined) p.doublesHit = 0;
                if (p.doublesThrown === undefined) p.doublesThrown = 0;
                if (p.finishes === undefined) p.finishes = [];
            });
            
            let currentPlayerIndex = 0;
            if (startingPlayerId === 'bull-off') {
            } else if (startingPlayerId) {
                const foundIndex = room.players.findIndex(p => p.id === startingPlayerId);
                if (foundIndex !== -1) currentPlayerIndex = foundIndex;
            } else {
                if (room.whoStarts === 'opponent' && room.players.length >= 2) {
                    const opponentIndex = room.players.findIndex(p => p.id !== room.hostId);
                    currentPlayerIndex = opponentIndex !== -1 ? opponentIndex : 1;
                } else {
                    const hostIndex = room.players.findIndex(p => p.id === room.hostId);
                    currentPlayerIndex = hostIndex !== -1 ? hostIndex : 0;
                }
            }

            room.game.initializePlayers(room.players.map(p => p.id), currentPlayerIndex);
            room.gameStarted = true;

            const commonGameState = {
                gameStatus: 'active',
                lastThrow: null,
                hostId: room.hostId,
                whoStarts: room.whoStarts,
                gameOptions: room.gameOptions,
                legsWon: room.game.legsWon,
                setsWon: room.game.setsWon,
                currentPlayerIndex: currentPlayerIndex
            };

            if (room.gameMode === 'CricketGame') {
                room.gameState = {
                    ...commonGameState,
                    mode: 'cricket',
                    players: room.players.map((p, index) => ({
                        ...p,
                        points: 0,
                        marks: {15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0},
                        dartsThrown: 0,
                        isActive: index === currentPlayerIndex,
                        legs: 0,
                        // Preserve persistent statistics
                        doublesHit: p.doublesHit,
                        doublesThrown: p.doublesThrown,
                        highestFinish: p.highestFinish,
                        bestLeg: p.bestLeg,
                        matchDartsThrown: p.matchDartsThrown,
                        matchPointsScored: p.matchPointsScored,
                        finishes: p.finishes
                    }))
                };
            } else {
                room.gameState = {
                    ...commonGameState,
                    mode: 'x01',
                    history: [],
                    turns: {},
                    players: room.players.map((p, index) => ({
                        ...p,
                        score: startScore,
                        dartsThrown: 0,
                        dartsThrownBeforeLeg: 0,
                        avg: '0.00',
                        isActive: index === currentPlayerIndex,
                        legs: 0,
                        scores: [],
                        turns: [],
                        doublesHit: p.doublesHit,
                        doublesThrown: p.doublesThrown,
                        scores180: 0,
                        scores60plus: 0,
                        scores100plus: 0,
                        scores140plus: 0,
                        highestFinish: p.highestFinish,
                        bestLeg: p.bestLeg,
                        finishes: p.finishes,
                        lastThrownScore: 0,
                        matchDartsThrown: p.matchDartsThrown,
                        matchPointsScored: p.matchPointsScored
                    }))
                };
            }
            
room.game.playerIds = room.players.map(p => p.id);
            
            console.log('7. room.gameState before sending:', JSON.stringify(room.gameState, null, 2));
            console.log('8. room.gameOptions at send time:', JSON.stringify(room.gameOptions, null, 2));
            console.log('9. About to emit game-started with room.gameState');
            
            io.to(roomId).emit('game-started', room.gameState);
            console.log('10. game-started emitted');
            console.log('=== START GAME END ===\n');
            console.log('10. game-started event sent');
            console.log('=== START GAME END ===\n');
            console.log('10. game-started emitted');
            console.log('=== START GAME END ===\n');
            console.log('=== START GAME END ===\n');
            console.log('=== START GAME END ===\n');
            console.log('10. game-started event emitted');
            console.log('=== START GAME END ===\n');
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
                // Vorherigen Stand sichern für Logic-Checks
                const preThrowGameState = room.game.getGameState();
                const scoreBeforeThrow = preThrowGameState.scores[userId] || 0;

                const result = room.game.processThrow(userId, score);

                if (!result.valid) {
                    return socket.emit('gameError', { error: result.reason });
                }

                // 2. Neuen GameState holen (hier ist der Score schon abgezogen!)
                const newGameStateFromGame = room.game.getGameState();

                // 3. Spielerdaten für das Frontend aktualisieren (Refaktorisierte Logik)
                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                const playerToUpdate = room.players[currentPlayerIndex];

                if (playerToUpdate) {
                    // Temporäre Leg-Statistiken
                    playerToUpdate.dartsThrown = (playerToUpdate.dartsThrown || 0) + (room.gameMode === 'CricketGame' ? 1 : 3);
                    playerToUpdate.scores = [...(playerToUpdate.scores || []), score];
                    playerToUpdate.lastScore = score;
                    playerToUpdate.lastThrownScore = score;

                    // Leg-Average
                    if (room.gameMode !== 'CricketGame' && playerToUpdate.dartsThrown > 0) {
                        const pointsScored = startScore - (newGameStateFromGame.scores[playerToUpdate.id] || startScore);
                        const turnsPlayed = playerToUpdate.dartsThrown / 3;
                        playerToUpdate.avg = turnsPlayed > 0 ? (pointsScored / turnsPlayed).toFixed(2) : "0.00";
                    }

                    // Match-Statistiken (persistent)
                    playerToUpdate.matchDartsThrown = (playerToUpdate.matchDartsThrown || 0) + (room.gameMode === 'CricketGame' ? 1 : 3);
                    playerToUpdate.matchPointsScored = (playerToUpdate.matchPointsScored || 0) + score;

                    // High-Scores
                    if (score === 180) { // Zählt nur als 180
                        playerToUpdate.scores180 = (playerToUpdate.scores180 || 0) + 1;
                    }
                    if (score >= 140 && score < 180) { // Zählt als 140+
                        playerToUpdate.scores140plus = (playerToUpdate.scores140plus || 0) + 1;
                    }
                    if (score >= 100 && score < 180) { // Zählt als 100+ (inkl. 140+)
                        playerToUpdate.scores100plus = (playerToUpdate.scores100plus || 0) + 1;
                    }
                    if (score >= 60 && score < 100) {
                        playerToUpdate.scores60plus = (playerToUpdate.scores60plus || 0) + 1;
                    }

                    // High-Finish (wird bei Checkout finalisiert, hier vorläufig)
                    if (newGameStateFromGame.scores[playerToUpdate.id] === 0) {
                        playerToUpdate.finishes = [...(playerToUpdate.finishes || []), score];
                        if (score > (playerToUpdate.highestFinish || 0)) {
                            playerToUpdate.highestFinish = score;
                        }
                    }
                }

                // Erstelle den finalen Player-State für das Frontend
                const updatedPlayersForFrontend = room.players.map((p, idx) => {
                    return {
                        ...p,
                        score: newGameStateFromGame.scores[p.id],
                        points: newGameStateFromGame.scores[p.id],
                        marks: newGameStateFromGame.marks ? newGameStateFromGame.marks[p.id] : p.marks,
                        isActive: idx === newGameStateFromGame.currentPlayerIndex,
                        // Stelle sicher, dass alle Stats aktuell sind
                        avg: p.avg || "0.00",
                        dartsThrown: p.dartsThrown || 0,
                        scores: p.scores || [],
                        finishes: p.finishes || [],
                        highestFinish: p.highestFinish || 0,
                        scores180: p.scores180 || 0,
                        scores60plus: p.scores60plus || 0,
                        scores100plus: p.scores100plus || 0,
                        scores140plus: p.scores140plus || 0,
                        doublesHit: p.doublesHit || 0,
                        doublesThrown: p.doublesThrown || 0,
                        bestLeg: p.bestLeg || null,
                        matchDartsThrown: p.matchDartsThrown || 0,
                        matchPointsScored: p.matchPointsScored || 0
                    };
                });

                // 4. Abfragen generieren
                const currentScore = newGameStateFromGame.scores[userId];
                
                // Helper: Ist ein Finish möglich? (<= 170, nicht Bogie)
                const canCheckoutFrom = (s) => {
                     if (s > 170) return false;
                     if ([169, 168, 166, 165, 163, 162, 159].includes(s)) return false;
                     return true;
                };

                // Die Abfrage "Versuche auf Doppel" macht Sinn, wenn man sich im Finish-Bereich befindet.
                const inFinishRange = canCheckoutFrom(scoreBeforeThrow);

                let doubleAttemptsQuery = null;
                let checkoutQuery = null;
                
                if (room.gameMode !== 'CricketGame') {
                    if (currentScore === 0) {
                        // CHECKOUT
                        const player = playerToUpdate; // Nehmen Sie den bereits gefundenen Spieler
                        checkoutQuery = {
                            player: player,
                            score: score,
                            startScore: scoreBeforeThrow
                        };
                    } else if (inFinishRange && currentScore > 1) {
                        // VERPASST
                        checkoutQuery = null; // Stellen Sie sicher, dass keine Checkout-Abfrage gesendet wird
                        doubleAttemptsQuery = {
                            type: 'attempts',
                            playerId: userId,
                            question: 'Versuche auf Doppel?',
                            options: ['0', '1', '2', '3'],
                            score: score,
                            startScore: scoreBeforeThrow
                        };
                    } else if (currentScore < 0 || currentScore === 1) {
                        // BUST
                        checkoutQuery = null; // Stellen Sie sicher, dass keine Checkout-Abfrage gesendet wird
                        if (inFinishRange) {
                            doubleAttemptsQuery = {
                                type: 'bust',
                                playerId: userId,
                                question: 'Versuche auf Doppel vor Überwerfen?',
                                options: ['0', '1', '2', '3'],
                                score: score,
                                startScore: scoreBeforeThrow
                            };
                        }
                    }
                }

                // 5. Update-Payload
                const updateData = {
                    mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                    players: updatedPlayersForFrontend,
                    gameStatus: newGameStateFromGame.winner ? 'finished' : 'active',
                    winner: newGameStateFromGame.winner,
                    currentPlayerIndex: newGameStateFromGame.currentPlayerIndex,
                    lastThrow: { playerId: userId, score },
                    hostId: room.hostId,
                    gameState: {
                        ...newGameStateFromGame,
                        legsWon: room.game.legsWon,
                        setsWon: room.game.setsWon
                    },
                    dartsThrownInTurn: result.dartsThrownInTurn,
                    doubleAttemptsQuery: doubleAttemptsQuery,
                    checkoutQuery: checkoutQuery,
                    legsWon: room.game.legsWon,
                    setsWon: room.game.setsWon,
                    turns: room.game.turns,
                    gameOptions: room.gameOptions
                };

                // Wenn Checkout-Popup, Spiel aktiv lassen damit Popup sichtbar ist
                if (checkoutQuery) {
                    updateData.winner = null;
                    updateData.gameStatus = 'active';
                    if (updateData.gameState) {
                        updateData.gameState = { ...updateData.gameState, winner: null };
                    }
                }

                // KRITISCH: Preserve room metadata when updating game state
                room.gameState = {
                    ...room.gameState, // Preserve existing room metadata
                    turns: room.game.turns, // Darthistorie explizit hinzufügen
                    ...updateData, // Update with new data
                    gameOptions: room.gameOptions, // Ensure gameOptions are preserved
                    whoStarts: room.whoStarts, // Ensure whoStarts is preserved
                    hostId: room.hostId // Ensure hostId is preserved
                };
                io.to(roomId).emit('game-state-update', updateData);

            } catch (error) {
                console.error(`[UNDO] Fehler:`, error);
                socket.emit('gameError', { error: 'Interner Serverfehler beim Rückgängigmachen.' });
            }
        });

        socket.on('getGameState', (roomId) => {
            const room = rooms.find(r => r.id === roomId);
            if(room) {
                if (room.gameState) {
                    socket.emit('gameState', room.gameState);
                } else {
                    socket.emit('gameState', {
                        mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                        players: room.players,
                        gameStatus: 'waiting',
                        hostId: room.hostId,
                        whoStarts: room.whoStarts,
                        gameOptions: room.gameOptions,
                        legsWon: room.game ? room.game.legsWon : {},
                        setsWon: room.game ? room.game.setsWon : {}
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
        
            const actualDartsUsed = parseInt(dartCount, 10);
            
            // Spieler finden (der gewonnen hat)
            const gameStateInner = room.game.getGameState();
            const playerIdx = room.game.currentPlayerIndex;
            const player = room.players[playerIdx];

            if (player && player.id) { // Sicherstellen, dass der Spieler gültig ist
                player.dartsThrown = (player.dartsThrown - 3) + actualDartsUsed; // Korrigiere die Darts für das Leg

                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                const pointsScored = startScore;
                if (player.dartsThrown > 0) {
                    player.avg = (pointsScored / (player.dartsThrown / 3)).toFixed(2);
                }
        
                // Doppelstatistik: 1 Treffer, 1 Versuch für diesen Wurf
                player.doublesHit = (player.doublesHit || 0) + 1;
                player.doublesThrown = (player.doublesThrown || 0) + 1;
        
                // Short Leg (Best Leg) Tracking
                if (!player.bestLeg || player.dartsThrown < player.bestLeg) {
                    player.bestLeg = player.dartsThrown;
                }
                
                // High Finish
                if (player.lastScore > (player.highestFinish || 0)) {
                    player.highestFinish = player.lastScore;
                }
            }

            if (room.game.setCheckoutDarts) {
                room.game.setCheckoutDarts(dartCount);
            }
            
            // Win Condition auslösen, um Legs/Sets in der Game-Logik zu aktualisieren
            room.game.checkWinCondition(player.id);

            // Finalen GameState aus der Game-Logik holen
            const gameInternalState = room.game.getGameState();

            // Erstelle ein sauberes, finales Update-Objekt
            const updateData = {
                ...gameInternalState,
                players: room.players,
                gameStatus: 'finished',
                turns: room.game.turns, // KORREKTUR 4: Darthistorie mitsenden
                winner: gameInternalState.winner,
                legsWon: room.game.legsWon,
                setsWon: room.game.setsWon,
                checkoutQuery: null, // Alle Popups schließen
                doubleAttemptsQuery: null,
                gameOptions: room.gameOptions,
                // Stelle sicher, dass die finalen Statistiken (bestLeg) enthalten sind
                players: room.players.map(p => ({ // KORREKTUR 2: Vollständige Spielerdaten senden
                    ...p,
                    score: gameInternalState.scores[p.id],
                    bestLeg: p.bestLeg, // Wichtig: bestLeg explizit mitsenden
                    highestFinish: p.highestFinish,
                    doublesHit: p.doublesHit,
                    doublesThrown: p.doublesThrown
                }))
            };

            // Speichere den finalen Zustand im Raum
            room.gameState = updateData;
            
            io.to(room.id).emit('game-state-update', updateData);
        });

        socket.on('double-attempts-response', (data) => {
            const { roomId, userId, response, queryType, score, startScore } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;

            const player = room.players.find(p => p.id === userId);
            if (!player) return;

            let hitsToAdd = 0;
            let attemptsToAdd = 0;
            
            if (queryType === 'checkout') {
                const actualDartsUsed = parseInt(response) + 1;
                player.dartsThrown = (player.dartsThrown - 3) + actualDartsUsed;
                
                const startScoreGame = parseInt(room.gameOptions.startingScore, 10) || 501;
                const pointsScored = startScoreGame;
                if (player.dartsThrown > 0) {
                    player.avg = (pointsScored / (player.dartsThrown / 3)).toFixed(2);
                }
                hitsToAdd = 1;
                attemptsToAdd = 1; 
                
                // Best Leg update auch hier
                 if (!player.bestLeg || player.dartsThrown < player.bestLeg) {
                    player.bestLeg = player.dartsThrown;
                }
                if (score > (player.highestFinish || 0)) {
                    player.highestFinish = score;
                }

            } else if (queryType === 'attempts' || queryType === 'bust') {
                hitsToAdd = 0;
                attemptsToAdd = parseInt(response);
            }

            player.doublesHit = (player.doublesHit || 0) + hitsToAdd;
            player.doublesThrown = (player.doublesThrown || 0) + attemptsToAdd;

            if (room.gameState) {
                room.gameState.doubleAttemptsQuery = null;
                room.gameState.checkoutQuery = null;
            }
            
            // KORREKTUR 3: Sende ein vollständiges und aktuelles State-Update
            // Erstelle ein sauberes Player-Array mit den neuesten Stats
            const updatedPlayers = room.players.map(p => ({
                ...p,
                score: room.game.getGameState().scores[p.id],
                doublesHit: p.doublesHit,
                doublesThrown: p.doublesThrown
            }));

            const updateData = {
                ...room.game.getGameState(), // Nimm den aktuellsten State aus der Game-Engine
                players: updatedPlayers,
                gameStatus: 'active', // Das Spiel läuft weiter
                legsWon: room.game.legsWon,
                setsWon: room.game.setsWon,
                turns: room.game.turns, // KORREKTUR 4: Darthistorie mitsenden
                doubleAttemptsQuery: null, // Query wurde beantwortet
                checkoutQuery: null
            };

            room.gameState = { ...room.gameState, ...updateData };
            io.to(roomId).emit('game-state-update', updateData);
        });

        socket.on('rematch', (data) => {
            const { roomId } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;

            room.gameState = null;
            room.game = null;
            room.gameStarted = false;

            const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
            room.players.forEach(player => {
                player.score = startScore;
                player.dartsThrown = 0;
                player.avg = '0.00';
                player.legs = 0;
                player.sets = 0; 
                player.marks = {}; 
                player.lastScore = 0;
                player.doublesHit = 0;
                player.doublesThrown = 0;
                player.isActive = false;
                
                // Full Reset bei Rematch
                player.bestLeg = null;
                player.highestFinish = 0;
                player.matchDartsThrown = 0;
                player.matchPointsScored = 0;
            });

            const waitingState = {
                mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                players: room.players,
                gameStatus: 'waiting',
                hostId: room.hostId,
                whoStarts: room.whoStarts,
                gameOptions: room.gameOptions
            };
            io.to(room.id).emit('game-state-update', waitingState);
        });

        socket.on('bull-off-submit', (data) => {
            const { roomId, playerId, throws } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;
            if (!room.bullOffThrows) room.bullOffThrows = {};
            room.bullOffThrows[playerId] = throws;
            io.to(roomId).emit('bull-off-throws', { playerId, throws });
        });

        socket.on('bull-off-restart', (data) => {
            const { roomId } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;
            room.bullOffThrows = {};
            io.to(roomId).emit('bull-off-restart', { roomId });
        });

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
                const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);

                if (playerIndex !== -1) {
                    const disconnectedPlayer = room.players[playerIndex];
                    console.log(`Player ${disconnectedPlayer.name} disconnected from room ${room.id}`);
                    
                    // Mark player as disconnected instead of removing them
                    disconnectedPlayer.disconnected = true;

                    // Notify other players
                    io.to(room.id).emit('receiveMessage', { user: 'System', text: `${disconnectedPlayer.name} hat die Verbindung verloren.` });
                    
                    // Update game state to show player as disconnected
                    if (room.gameState && room.gameState.players) {
                        const playerInGame = room.gameState.players.find(p => p.id === socket.id);
                        if (playerInGame) playerInGame.disconnected = true;
                    }
                    io.to(room.id).emit('game-state-update', room.gameState);

                } else if (spectatorIndex !== -1) {
                    const leavingSpectator = room.spectators[spectatorIndex];
                    room.spectators.splice(spectatorIndex, 1);
                    io.to(room.id).emit('receiveMessage', { user: 'System', text: `${leavingSpectator.name} schaut nicht mehr zu.` });
                }
            });
            io.emit('updateRooms', rooms);
        });
    });
}

module.exports = initializeSocket;