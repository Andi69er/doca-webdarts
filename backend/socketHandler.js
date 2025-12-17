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
                // NEU: Array für Zuschauer
                spectators: [],
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

                    // Update player id in case of socket reconnection
                    const oldId = room.players[existingPlayerIndex].id;
                    room.players[existingPlayerIndex].id = socket.id;

                    // Also update in gameState if it exists
                    if (room.gameState && room.gameState.players) {
                        const gamePlayerIndex = room.gameState.players.findIndex(p => p.id === oldId);
                        if (gamePlayerIndex !== -1) {
                            room.gameState.players[gamePlayerIndex].id = socket.id;
                        }
                    }

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

                    // Systemnachricht an den Raum senden
                    io.to(room.id).emit('receiveMessage', {
                        user: 'System',
                        text: `${newPlayer.name} ist dem Raum beigetreten.`
                    });

                    socket.emit('roomJoined', { roomId: room.id });
                    
                    if (room.game) {
                        socket.emit('game-started', room.gameState);
                    }

                    console.log(`Spieler ${socket.id} ist Raum ${room.id} beigetreten.`);
                    // Send game state to all in room, including the new player
                    io.to(room.id).emit('game-state-update', room.gameState);
                    io.emit('updateRooms', rooms);
                } else {
                    // Raum ist voll, als Zuschauer hinzufügen
                    if (!room.spectators) room.spectators = [];
                    
                    const newSpectator = {
                        id: socket.id,
                        name: `Zuschauer_${socket.id.substring(0, 4)}`
                    };
                    room.spectators.push(newSpectator);
                    socket.join(room.id);

                    // Systemnachricht an den Raum senden
                    io.to(room.id).emit('receiveMessage', {
                        user: 'System',
                        text: `${newSpectator.name} schaut jetzt zu.`
                    });
                    
                    // Informiere den Client, dass er Zuschauer ist und sende den aktuellen Spielstand
                    socket.emit('joinedAsSpectator', { roomId: room.id });
                    socket.emit('game-state-update', room.gameState);
                    console.log(`Zuschauer ${socket.id} ist Raum ${room.id} beigetreten.`);
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
            if (!room) {
                return socket.emit('gameError', { error: 'Raum nicht gefunden.' });
            }

            const player = room.players.find(p => p.id === userId);
            if (!player) {
                // Maybe the user is a spectator
                const spectator = room.spectators.find(s => s.id === userId);
                if (spectator) spectator.name = newName.trim();
            } else {
                const oldName = player.name;
                player.name = newName.trim();

                // Update the name in the gameState as well
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

            if (!room) {
                return socket.emit('gameError', { error: 'Raum nicht gefunden.' });
            }

            // Check if the user sending the request is the host
            if (room.hostId !== socket.id) {
                return socket.emit('gameError', { error: 'Nur der Host kann Spieler kicken.' });
            }

            const playerToKick = room.players.find(p => p.id === playerIdToKick);
            if (!playerToKick) {
                return socket.emit('gameError', { error: 'Spieler nicht im Raum gefunden.' });
            }

            // Find the socket of the player to be kicked
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

            if (startingPlayerId === 'bull-off') {
                // Random mode - start with bull-off
                console.log("-> Zufälliger Start (Ausbullen) gewählt. Aktueller Spielerindex bleibt 0 für Host.");
                // Start with host, bull-off will determine starter later
            } else if (startingPlayerId) {
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
            console.log(`Spiel gestartet. Index: ${currentPlayerIndex}, ID: ${room.players[currentPlayerIndex].id}`);
        });

socket.on('score-input', (data) => {
            const { roomId, score, userId } = data;
            console.log(`[DEBUG] score-input received:`, { roomId, score, userId });
            const room = rooms.find(r => r.id === roomId);

            if (!room || !room.game) {
                console.log(`[DEBUG] No room or game found`);
                return socket.emit('gameError', { error: 'Spiel nicht gestartet oder Raum nicht gefunden' });
            }

            console.log(`[DEBUG] Room found, game mode:`, room.gameMode);
            const currentPlayerIndex = room.game.currentPlayerIndex || 0;
            const currentPlayer = room.players[currentPlayerIndex];

            console.log(`[DEBUG] Current player:`, currentPlayer?.id, `Expected:`, userId);
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

                    // Average-Berechnung: Punkte erzielt / Turns gespielt
                    let average = p.avg || "0.00";
                    if (room.gameMode !== 'CricketGame' && newDartsThrown > 0) {
                        // Berechne die bereits erzielten Punkte: Startscore - aktueller verbleibender Score
                        const pointsScored = startScore - (newGameStateFromGame.scores[p.id] || startScore);
                        const turnsPlayed = Math.floor(newDartsThrown / 3); // Anzahl der vollständigen Turns
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
                        // Add score to scores array
                        newScores = [...newScores, score];

                        // Check for 180
                        if (score == 180) {
                            newScores180 += 1;
                        }

                        // Check for 60+
                        if (score >= 60 && score < 100) {
                            newScores60plus += 1;
                        }

                        // Check for 100+
                        if (score >= 100 && score < 180) {
                            newScores100plus += 1;
                        }

                        // Check for 140+
                        if (score >= 140 && score < 180) {
                            newScores140plus += 1;
                        }

                        // Check for finish (score reaches 0)
                        if (newGameStateFromGame.scores[p.id] === 0) {
                            newFinishes = [...newFinishes, score];
                            if (score > newHighestFinish) {
                                newHighestFinish = score;
                            }
                            // Double-Finish wird später über manuelle Abfrage bestimmt
                            // Für X01: Prüfe ob der letzte Score ein Double war (gerade Zahl und >= 2)
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

                        // Live Statistics
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

                        // Berechne bestLeg (geringste Anzahl Darts für ein Leg)
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

// 4. Prüfe ob Doppelquote-Abfrage nötig ist
                // Berechne Score VOR dem Wurf, um zu wissen, ob man auf einem Doppel stand
                const currentScore = newGameStateFromGame.scores[userId];
                const scoreBeforeThrow = currentScore + score; // Bei X01 wird subtrahiert, also addieren wir hier
                
                // Prüfen, ob vor dem Wurf ein Finish möglich war
                const wasFinishPossible = (scoreBeforeThrow === 50) || (scoreBeforeThrow <= 40 && scoreBeforeThrow % 2 === 0);

                console.log(`[DEBUG] User ${userId} - Score Before: ${scoreBeforeThrow}, Current: ${currentScore}, Was Finish Possible: ${wasFinishPossible}`);
                
                let doubleAttemptsQuery = null;
                let checkoutQuery = null;
                
                // Für alle X01 Spiele wenn Finish möglich war
                if (wasFinishPossible && room.gameMode !== 'CricketGame') {
                    console.log(`[DEBUG] Finish was possible for user ${userId}`);
                    
                    if (currentScore === 0) {
                        // Check - verwende dedizierte Checkout-Abfrage
                        console.log(`[DEBUG] Checkout detected - creating checkout query`);
                        const player = room.players.find(p => p.id === userId);
                        checkoutQuery = {
                            player: player,
                            score: score,
                            startScore: scoreBeforeThrow
                        };
                    } else if (currentScore > 1) {
                        // Kein Check aber Finish WAR möglich - frage nach Versuchen
                        console.log(`[DEBUG] No checkout but finish was possible - creating attempts query`);
                        doubleAttemptsQuery = {
                            type: 'attempts',
                            playerId: userId,
                            question: 'Wie viele Darts hast du auf ein Doppel geworfen?',
                            options: ['0', '1', '2', '3'],
                            score: score,
                            startScore: scoreBeforeThrow
                        };
                    } else if (currentScore < 0 || currentScore === 1) {
                        // Bust - frage nach Versuchen vor dem Bust
                        console.log(`[DEBUG] Bust detected - creating bust query`);
                        doubleAttemptsQuery = {
                            type: 'bust',
                            playerId: userId,
                            question: 'Wie viele Darts gingen auf das Doppel, bevor du überworfen hast?',
                            options: ['0', '1', '2', '3'],
                            score: score,
                            startScore: scoreBeforeThrow // Hier war es vorher newGameStateFromGame.scores[userId], was bei Bust falsch sein kann
                        };
                    }
                }

// 5. Update-Payload für Clients erstellen
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
                    doubleAttemptsQuery: doubleAttemptsQuery, // Neue Abfrage
                    checkoutQuery: checkoutQuery, // Checkout-Abfrage
                };
                
                // FIX für Checkout-Popup: Wenn wir nach Checkout fragen, dürfen wir das Spiel noch nicht
                // als 'finished' markieren und den Winner noch nicht senden, sonst überdeckt das
                // GameEndPopup (Winner) das CheckoutPopup.
                if (checkoutQuery) {
                    console.log("[DEBUG] Holding winner state to ask for checkout details");
                    updateData.winner = null;
                    updateData.gameStatus = 'active';
                }

                // 6. Neuen State speichern und an Clients senden
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
            // Hole den finalen State (inklusive Winner)
            room.gameState = room.game.getGameState();
            
            // WICHTIG: Checkout-Abfrage im State löschen, da sie beantwortet ist
            if (room.gameState) {
                room.gameState.checkoutQuery = null;
                room.gameState.doubleAttemptsQuery = null;
            }
            
            // Jetzt senden wir den State MIT Winner, da die Frage beantwortet wurde
            io.to(room.id).emit('game-state-update', room.gameState);
        });

        // Doppelquote-Abfrage Antwort
        socket.on('double-attempts-response', (data) => {
            const { roomId, userId, response, queryType, score, startScore } = data;
            const room = rooms.find(r => r.id === roomId);

            if (!room) return;

            const player = room.players.find(p => p.id === userId);
            if (!player) return;

            // Statistik aktualisieren basierend auf der Antwort
            let hitsToAdd = 0;
            let attemptsToAdd = 0;

            if (queryType === 'checkout') {
                // Check - response ist der Dart-Index (0, 1, 2 für 1., 2., 3. Dart)
                hitsToAdd = 1;
                attemptsToAdd = parseInt(response) + 1; // 0->1, 1->2, 2->3
            } else if (queryType === 'attempts' || queryType === 'bust') {
                // Kein Check - response ist die Anzahl der Versuche (0-3)
                hitsToAdd = 0;
                attemptsToAdd = parseInt(response);
            }

            // Statistik aktualisieren
            player.doublesHit = (player.doublesHit || 0) + hitsToAdd;
            player.doublesThrown = (player.doublesThrown || 0) + attemptsToAdd;

            // WICHTIG: Die Abfrage im State löschen, damit das Popup nicht wieder erscheint!
            if (room.gameState) {
                room.gameState.doubleAttemptsQuery = null;
                room.gameState.checkoutQuery = null;
            }

            // Broadcast update
            io.to(roomId).emit('game-state-update', room.gameState);
        });

        socket.on('rematch', (data) => {
            const { roomId } = data;
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;

            // Setze das Spiel komplett zurück
            room.gameState = null;
            room.game = null;
            room.gameStarted = false;

            // Setze die Spielerstatistiken zurück, aber behalte Namen, IDs und die Reihenfolge bei
            const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
            room.players.forEach(player => {
                player.score = startScore;
                player.dartsThrown = 0;
                player.avg = '0.00';
                player.legs = 0;
                player.sets = 0; // Auch Sets zurücksetzen für ein komplett neues Spiel
                player.marks = {}; // For cricket
                player.lastScore = 0;
                player.isActive = false;
            });

            // Erstelle einen sauberen "Warte"-Zustand
            const waitingState = {
                mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                players: room.players,
                gameStatus: 'waiting',
                hostId: room.hostId,
                whoStarts: room.whoStarts // Behalte die "Wer beginnt"-Einstellung bei
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