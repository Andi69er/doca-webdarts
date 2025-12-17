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

            const gameOptions = room.gameOptions || {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;

            if (room.gameMode === 'CricketGame') {
                const { CricketGame } = require('./gameModes');
                room.game = new CricketGame(gameOptions);
            } else {
                room.game = new X01Game(gameOptions);
            }
            
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
                        turns: [],
                        doublesHit: 0,
                        doublesThrown: 0,
                        scores180: 0,
                        scores60plus: 0,
                        scores100plus: 0,
                        scores140plus: 0,
                        highestFinish: 0,
                        bestLeg: null,
                        finishes: [],
                        lastThrownScore: 0
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
                // Vorherigen Stand sichern für Berechnungen
                const preThrowGameState = room.game.getGameState();
                const scoreBeforeThrow = preThrowGameState.scores[userId] || 0;

                const result = room.game.processThrow(userId, score);

                if (!result.valid) {
                    return socket.emit('gameError', { error: result.reason });
                }

                // 2. Neuen GameState holen
                const newGameStateFromGame = room.game.getGameState();

                // 3. Spielerdaten für das Frontend aktualisieren
                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                
                const updatedPlayers = room.players.map((p, idx) => {
                    const isCurrentPlayer = p.id === userId;
                    
                    // Bei X01 addieren wir hier erst einmal 3 Darts. 
                    // Das wird in 'checkout-selection' korrigiert, falls weniger gebraucht wurden.
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
                    let newHighestFinish = p.highestFinish || 0;
                    let newScores180 = p.scores180 || 0;
                    let newScores60plus = p.scores60plus || 0;
                    let newScores100plus = p.scores100plus || 0;
                    let newScores140plus = p.scores140plus || 0;
                    let newDoublesHit = p.doublesHit || 0;
                    let newDoublesThrown = p.doublesThrown || 0;

                    if (isCurrentPlayer) {
                        newScores = [...newScores, score];
                        if (score == 180) newScores180 += 1;
                        if (score >= 60 && score < 100) newScores60plus += 1;
                        if (score >= 100 && score < 180) newScores100plus += 1;
                        if (score >= 140 && score < 180) newScores140plus += 1;

                        if (newGameStateFromGame.scores[p.id] === 0) {
                            newFinishes = [...newFinishes, score];
                            if (score > newHighestFinish) {
                                newHighestFinish = score;
                            }
                            if (room.gameMode !== 'CricketGame' && score >= 2 && score % 2 === 0) {
                                newDoublesHit += 1;
                            }
                        }
                        if (room.gameMode !== 'CricketGame') {
                            newDoublesThrown += 3;
                        }
                    }

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
                        bestLeg: (() => {
                            const turns = room.gameState?.turns?.[p.id] || [];
                            if (turns.length === 0) return null;
                            const validTurns = turns.filter(t => t !== null && t !== undefined && t > 0);
                            if (validTurns.length === 0) return null;
                            return Math.min(...validTurns);
                        })(),
                    };
                });
                room.players = updatedPlayers;

                // 4. Abfragen generieren
                const currentScore = newGameStateFromGame.scores[userId];
                // Wir nehmen den Score VOR dem Wurf, um sicher zu sein (da wir runterzählen bei X01)
                // scoreBeforeThrow haben wir oben gesichert.
                
                const wasFinishPossible = (scoreBeforeThrow === 50) || (scoreBeforeThrow <= 40 && scoreBeforeThrow % 2 === 0);

                let doubleAttemptsQuery = null;
                let checkoutQuery = null;
                
                if (wasFinishPossible && room.gameMode !== 'CricketGame') {
                    if (currentScore === 0) {
                        // CHECKOUT
                        const player = room.players.find(p => p.id === userId);
                        checkoutQuery = {
                            player: player,
                            score: score,
                            startScore: scoreBeforeThrow
                        };
                    } else if (currentScore > 1) {
                        // Finish verpasst
                        doubleAttemptsQuery = {
                            type: 'attempts',
                            playerId: userId,
                            question: 'Wie viele Darts hast du auf ein Doppel geworfen?',
                            options: ['0', '1', '2', '3'],
                            score: score,
                            startScore: scoreBeforeThrow
                        };
                    } else if (currentScore < 0 || currentScore === 1) {
                        // Bust
                        doubleAttemptsQuery = {
                            type: 'bust',
                            playerId: userId,
                            question: 'Wie viele Darts gingen auf das Doppel, bevor du überworfen hast?',
                            options: ['0', '1', '2', '3'],
                            score: score,
                            startScore: scoreBeforeThrow
                        };
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
                    gameState: newGameStateFromGame,
                    dartsThrownInTurn: result.dartsThrownInTurn,
                    doubleAttemptsQuery: doubleAttemptsQuery,
                    checkoutQuery: checkoutQuery,
                };

                // WICHTIGSTER FIX:
                // Wenn wir eine Checkout-Abfrage haben, MÜSSEN wir so tun, als wäre das Spiel noch aktiv
                // und es gäbe noch keinen Gewinner, sonst zeigt das Frontend den GameEndPopup
                // anstatt des CheckoutPopups. Wir müssen auch den Gewinner im verschachtelten gameState verstecken.
                if (checkoutQuery) {
                    updateData.winner = null;
                    updateData.gameStatus = 'active';
                    if (updateData.gameState) {
                        // Erstelle eine flache Kopie, um das Original nicht zu verändern
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

            // Logik-Korrektur:
            // Wir haben in score-input pauschal +3 Darts gerechnet.
            // Der User sagt uns jetzt, wie viele er WIRKLICH brauchte (1, 2 oder 3).
            // Also: Darts = (Aktuell - 3) + Tatsächlich
            
            const actualDartsUsed = parseInt(dartCount, 10);
            
            // Wir müssen den Gewinner finden. Da das Spiel im Hintergrund schon fertig ist,
            // ist der 'winner' im Game-Objekt gesetzt.
            const gameStateInner = room.game.getGameState();
            let player = null;
            if (gameStateInner.winner) {
                player = room.players.find(p => p.id === gameStateInner.winner);
            }

            if (player) {
                player.dartsThrown = (player.dartsThrown - 3) + actualDartsUsed;
                
                // Average neu berechnen
                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                const pointsScored = startScore; // Checkout = Full Score
                if (player.dartsThrown > 0) {
                    player.avg = (pointsScored / (player.dartsThrown / 3)).toFixed(2);
                }
            }

            if (room.game.setCheckoutDarts) {
                room.game.setCheckoutDarts(dartCount);
            }

            // GameState aktualisieren (Winner ist hier jetzt enthalten)
            room.gameState = room.game.getGameState();
            
            // Abfragen löschen
            if (room.gameState) {
                room.gameState.checkoutQuery = null;
                room.gameState.doubleAttemptsQuery = null;
            }
            
            // Jetzt senden wir den ECHTEN Status (finished) mit dem Gewinner
            const updateData = {
                ...room.gameState,
                players: room.players, // Die korrigierten Player-Objekte
                gameStatus: 'finished',
                winner: gameStateInner.winner
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
                // Falls Checkout über diesen Weg kommt (Backup)
                const actualDartsUsed = parseInt(response) + 1; // 0->1
                player.dartsThrown = (player.dartsThrown - 3) + actualDartsUsed;
                
                // Average Update
                const startScoreGame = parseInt(room.gameOptions.startingScore, 10) || 501;
                const pointsScored = startScoreGame;
                if (player.dartsThrown > 0) {
                    player.avg = (pointsScored / (player.dartsThrown / 3)).toFixed(2);
                }

                hitsToAdd = 1;
                attemptsToAdd = actualDartsUsed;
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
            
            // State wiederherstellen (inkl. Winner falls Spiel vorbei)
            const gameStateInner = room.game.getGameState();
            const updateData = {
                ...room.gameState,
                players: room.players,
                gameState: gameStateInner,
                winner: gameStateInner.winner,
                gameStatus: gameStateInner.winner ? 'finished' : 'active'
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
                player.isActive = false;
            });

            const waitingState = {
                mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                players: room.players,
                gameStatus: 'waiting',
                hostId: room.hostId,
                whoStarts: room.whoStarts
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