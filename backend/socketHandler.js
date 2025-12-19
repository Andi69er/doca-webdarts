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
            // REPARATUR: Daten aus der Lobby robust auslesen
            // Wir kombinieren roomData und gameOptions, falls das Frontend es unterschiedlich schickt
            const flatData = { ...roomData, ...(roomData.gameOptions || {}) };

            const startScore = parseInt(flatData.startingScore, 10) || 501;
            const sets = parseInt(flatData.sets, 10) || 0;
            const legs = parseInt(flatData.legs, 10) || 1;
            
            // Best Of / First To Logik
            // Wenn sets > 0 ist, ist es meist "Best Of Sets" oder "First To Sets", je nach Frontend Logik.
            // Wir nutzen hier eine sichere Logik:
            const winMode = (flatData.winMode || flatData.siegerModus || 'First To');
            const isBestOf = winMode.toLowerCase().includes('best');

            const gameOptions = {
                startingScore: startScore,
                inMode: flatData.inMode || 'single',
                outMode: flatData.outMode || 'double',
                sets: sets,
                legs: legs,
                length: { 
                    type: isBestOf ? 'bestOf' : 'firstTo', 
                    value: sets > 0 ? sets : legs 
                },
                checkIn: flatData.inMode || 'single',
                checkOut: flatData.outMode || 'double'
            };

            const newRoom = {
                id: (Math.random().toString(36).substring(2, 8)),
                name: flatData.roomName || roomData.roomName,
                gameMode: flatData.gameMode || roomData.gameMode,
                gameOptions: gameOptions, // Hier die sauberen Options speichern
                whoStarts: flatData.whoStarts || roomData.whoStarts, 
                hostId: socket.id, 
                maxPlayers: 2,
                players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`}],
                spectators: [],
                gameState: null, 
                game: null 
            };
            
            newRoom.players[0].score = startScore;
            rooms.push(newRoom);
            socket.join(newRoom.id);
            socket.emit('roomCreated', { roomId: newRoom.id });
            io.emit('updateRooms', rooms);
        });

        socket.on('joinRoom', (data) => {
            const room = rooms.find(r => r.id === data.roomId);

            if (room) {
                const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);

                if (existingPlayerIndex !== -1) {
                    socket.join(room.id);
                    const oldId = room.players[existingPlayerIndex].id;
                    room.players[existingPlayerIndex].id = socket.id;

                    if (room.gameState && room.gameState.players) {
                        const gamePlayerIndex = room.gameState.players.findIndex(p => p.id === oldId);
                        if (gamePlayerIndex !== -1) {
                            room.gameState.players[gamePlayerIndex].id = socket.id;
                        }
                    }

                    const gameState = room.gameState || {
                        mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                        players: room.players,
                        gameStatus: 'waiting',
                        hostId: room.hostId,
                        whoStarts: room.whoStarts,
                        gameOptions: room.gameOptions
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
            const { roomId, userId, startingPlayerId } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) return socket.emit('gameError', { error: 'Raum nicht gefunden' });
            
            const isHost = room.players[0]?.id === userId || room.hostId === userId;
            if (!isHost) return socket.emit('gameError', { error: 'Nur der Host kann das Spiel starten' });
            if (room.players.length < 2) return socket.emit('gameError', { error: 'Warte auf zweiten Spieler' });

            // REPARATUR: Optionen explizit aus dem Raumobjekt laden
            const gameOptions = room.gameOptions || {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;

            if (room.gameMode === 'CricketGame') {
                const { CricketGame } = require('./gameModes');
                room.game = new CricketGame(gameOptions);
            } else {
                room.game = new X01Game(gameOptions);
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
            io.to(roomId).emit('game-started', room.gameState);
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

                // 3. Spielerdaten für das Frontend aktualisieren
                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                
                const updatedPlayers = room.players.map((p, idx) => {
                    const isCurrentPlayer = p.id === userId;
                    
                    // Standardmäßig +3 Darts rechnen. Das wird bei Checkout korrigiert.
                    const newDartsThrown = (p.dartsThrown || 0) + (isCurrentPlayer ? (room.gameMode === 'CricketGame' ? 1 : 3) : 0);

                    // Average-Berechnung
                    let average = p.avg || "0.00";
                    if (room.gameMode !== 'CricketGame' && newDartsThrown > 0) {
                        const pointsScored = startScore - (newGameStateFromGame.scores[p.id] || startScore);
                        const turnsPlayed = newDartsThrown / 3;
                        if (turnsPlayed > 0) {
                            average = (pointsScored / turnsPlayed).toFixed(2);
                        } else {
                            average = "0.00";
                        }
                    } else if (newDartsThrown === 0) {
                        average = "0.00";
                    }

                    // Live Statistics Updates
                    let newScores = p.scores || [];
                    let newFinishes = p.finishes || [];
                    
                    // REPARATUR: Stats vom Player Objekt nehmen
                    let newHighestFinish = p.highestFinish || 0;
                    let newScores180 = p.scores180 || 0;
                    let newScores60plus = p.scores60plus || 0;
                    let newScores100plus = p.scores100plus || 0;
                    let newScores140plus = p.scores140plus || 0;
                    let newDoublesHit = p.doublesHit || 0;
                    let newDoublesThrown = p.doublesThrown || 0;
                    let newBestLeg = p.bestLeg || null;
                    let newMatchDarts = p.matchDartsThrown || 0;
                    let newMatchPoints = p.matchPointsScored || 0;

                    if (isCurrentPlayer) {
                        newScores = [...newScores, score];
                        if (score == 180) newScores180 += 1;
                        if (score >= 60 && score < 100) newScores60plus += 1;
                        if (score >= 100 && score < 180) newScores100plus += 1;
                        if (score >= 140 && score < 180) newScores140plus += 1;

                        // Akkumuliere Match-Statistiken
                        newMatchDarts += (room.gameMode === 'CricketGame' ? 1 : 3);
                        newMatchPoints += score;

                        // REPARATUR: High Finish Check wenn Rest 0 ist
                        if (newGameStateFromGame.scores[p.id] === 0) {
                            newFinishes = [...newFinishes, score];
                            if (score > newHighestFinish) {
                                newHighestFinish = score;
                            }
                        }
                    }
                    
                    // Update Persistent data in room object
                    p.matchDartsThrown = newMatchDarts;
                    p.matchPointsScored = newMatchPoints;
                    p.highestFinish = newHighestFinish;

                    return {
                        ...p,
                        score: newGameStateFromGame.scores[p.id],
                        points: newGameStateFromGame.scores[p.id],
                        marks: newGameStateFromGame.marks ? newGameStateFromGame.marks[p.id] : p.marks,
                        dartsThrown: newDartsThrown,
                        avg: average,
                        isActive: idx === newGameStateFromGame.currentPlayerIndex,
                        lastScore: isCurrentPlayer ? score : (p.lastScore || 0),
                        legs: p.legs || 0,
                        scores: newScores,
                        finishes: newFinishes,
                        highestFinish: newHighestFinish,
                        scores180: newScores180,
                        scores60plus: newScores60plus,
                        scores100plus: newScores100plus,
                        scores140plus: newScores140plus,
                        doublesHit: newDoublesHit,
                        doublesThrown: newDoublesThrown,
                        lastThrownScore: isCurrentPlayer ? score : (p.lastThrownScore || 0),
                        bestLeg: newBestLeg,
                        matchDartsThrown: newMatchDarts,
                        matchPointsScored: newMatchPoints
                    };
                });
                room.players = updatedPlayers;

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
                        const player = room.players.find(p => p.id === userId);
                        checkoutQuery = {
                            player: player,
                            score: score,
                            startScore: scoreBeforeThrow
                        };
                    } else if (inFinishRange && currentScore > 1) {
                        // VERPASST
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
                    players: updatedPlayers,
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

                room.gameState = { ...updateData };
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

            if (player) {
                player.dartsThrown = (player.dartsThrown - 3) + actualDartsUsed;

                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                const pointsScored = startScore;
                if (player.dartsThrown > 0) {
                    player.avg = (pointsScored / (player.dartsThrown / 3)).toFixed(2);
                }

                // DOPPELSTATISTIK: 1 Hit, 1 Attempt
                player.doublesHit = (player.doublesHit || 0) + 1;
                player.doublesThrown = (player.doublesThrown || 0) + 1;

                // REPARATUR: BEST LEG TRACKING (Short Leg)
                // Wenn noch kein Best Leg (null/0) oder aktuelles Leg schneller war
                if (!player.bestLeg || player.dartsThrown < player.bestLeg) {
                    player.bestLeg = player.dartsThrown;
                }
                
                // High Finish sicherstellen (falls nicht in score-input erfasst)
                if (player.lastScore > (player.highestFinish || 0)) {
                    player.highestFinish = player.lastScore;
                }
            }

            if (room.game.setCheckoutDarts) {
                room.game.setCheckoutDarts(dartCount);
            }
            
            // Win Condition manuell auslösen um Legs/Sets in Game Logic zu updaten
            room.game.checkWinCondition(player.id);

            room.gameState = room.game.getGameState();
            
            if (room.gameState) {
                room.gameState.checkoutQuery = null;
                room.gameState.doubleAttemptsQuery = null;
            }
            
            const updateData = {
                ...room.gameState,
                players: room.players,
                gameStatus: 'finished',
                winner: player.id,
                legsWon: room.game.legsWon,
                setsWon: room.game.setsWon
            };

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
            
            const gameStateInner = room.game.getGameState();
            const updateData = {
                ...room.gameState,
                players: room.players,
                gameState: gameStateInner,
                winner: gameStateInner.winner,
                gameStatus: gameStateInner.winner ? 'finished' : 'active',
                legsWon: room.game.legsWon,
                setsWon: room.game.setsWon
            };

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
                    const leavingPlayer = room.players[playerIndex];
                    room.players.splice(playerIndex, 1);
                    if (room.players.length === 0) {
                        rooms = rooms.filter(r => r.id !== room.id);
                    }
                    io.to(room.id).emit('game-state-update', room);
                    io.to(room.id).emit('receiveMessage', { user: 'System', text: `${leavingPlayer.name} hat den Raum verlassen.` });
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