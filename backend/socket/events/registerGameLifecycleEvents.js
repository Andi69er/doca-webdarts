function registerGameLifecycleEvents({ io, socket, state, games }) {
    const { X01Game, CricketGame } = games;

    socket.on('start-game', (data) => {
        console.log('\n=== START GAME START ===');
        console.log('1. start-game data received:', JSON.stringify(data, null, 2));

        const { roomId, userId, startingPlayerId } = data;
        const room = state.rooms.find(r => r.id === roomId);

        if (!room) {
            console.log('ERROR: Room not found:', roomId);
            socket.emit('gameError', { error: 'Raum nicht gefunden' });
            return;
        }

        console.log('2. Found room:', JSON.stringify(room, null, 2));
        console.log('3. Room gameOptions:', JSON.stringify(room.gameOptions, null, 2));

        let authorizedStarterId = room.hostId;
        if (room.whoStarts === 'opponent' && room.players.length >= 2) {
            const opponent = room.players.find(p => p.id !== room.hostId);
            if (opponent) authorizedStarterId = opponent.id;
        }

        if (userId !== authorizedStarterId) {
            console.log(`ERROR: User ${userId} not authorized to start. Expected ${authorizedStarterId}`);
            const msg = (room.whoStarts === 'opponent' && userId === room.hostId)
                ? 'Der Gegner muss das Spiel starten (Einstellung: Gegner beginnt).'
                : 'Du bist nicht berechtigt, das Spiel zu starten.';

            socket.emit('gameError', { error: msg });

            if (room.gameState) {
                let correctStarterId = room.hostId;
                if (room.whoStarts === 'opponent') {
                    const opponent = room.players.find(p => p.id !== room.hostId);
                    correctStarterId = opponent ? opponent.id : 'waiting_for_opponent';
                }
                room.gameState.activePlayer = correctStarterId;
                io.to(roomId).emit('game-state-update', room.gameState);
                socket.emit('game-state-update', room.gameState);
            }
            return;
        }

        if (room.players.length < 2) {
            console.log('ERROR: Not enough players:', room.players.length);
            socket.emit('gameError', { error: 'Warte auf zweiten Spieler' });
            return;
        }

        const gameOptions = room.gameOptions || {};
        const startScore = parseInt(gameOptions.startingScore, 10) || 501;

        console.log('4. Loaded gameOptions:', JSON.stringify(gameOptions, null, 2));
        console.log('5. startScore:', startScore);

        if (room.gameMode === 'CricketGame') {
            room.game = new CricketGame(gameOptions);
            console.log('6. Created CricketGame with options:', JSON.stringify(gameOptions, null, 2));
        } else {
            room.game = new X01Game(gameOptions);
            console.log('6. Created X01Game with options:', JSON.stringify(gameOptions, null, 2));
        }

        room.players.forEach(p => {
            p.score = startScore;
            p.dartsThrown = 0;
            p.avg = '0.00';
            p.scores = [];
            p.legs = 0;
            p.sets = 0;
            p.history = [];
            p.lastScore = 0;
            p.scores180 = 0;
            p.scores60plus = 0;
            p.scores100plus = 0;
            p.scores140plus = 0;

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
        } else if (room.whoStarts === 'opponent' && room.players.length >= 2) {
            const opponentIndex = room.players.findIndex(p => p.id !== room.hostId);
            currentPlayerIndex = opponentIndex !== -1 ? opponentIndex : 1;
        } else {
            const hostIndex = room.players.findIndex(p => p.id === room.hostId);
            currentPlayerIndex = hostIndex !== -1 ? hostIndex : 0;
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
            currentPlayerIndex,
            turns: []
        };

        if (room.gameMode === 'CricketGame') {
            room.gameState = {
                ...commonGameState,
                mode: 'cricket',
                players: room.players.map((p, index) => ({
                    ...p,
                    points: 0,
                    marks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
                    dartsThrown: 0,
                    isActive: index === currentPlayerIndex,
                    legs: 0,
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
                players: room.players.map((p, index) => ({
                    ...p,
                    score: startScore,
                    dartsThrown: 0,
                    dartsThrownBeforeLeg: 0,
                    avg: '0.00',
                    isActive: index === currentPlayerIndex,
                    legs: 0,
                    scores: [],
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

    socket.on('getGameState', (roomId) => {
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) {
            console.log(`[getGameState] Room not found: ${roomId}, total rooms: ${state.rooms.length}`);
            console.log(`[getGameState] Available room IDs: ${state.rooms.map(r => r.id).join(', ')}`);
            socket.emit('gameError', { error: 'Room not found' });
            return;
        }

        if (room.gameState) {
            if (room.gameState.gameStatus === 'waiting') {
                let starterId = room.hostId;
                if (room.whoStarts === 'opponent') {
                    const opponent = room.players.find(p => p.id !== room.hostId);
                    starterId = opponent ? opponent.id : 'waiting_for_opponent';
                }
                room.gameState.activePlayer = starterId;
            }
            socket.emit('gameState', room.gameState);
            return;
        }

        let starterId = room.hostId;
        if (room.whoStarts === 'opponent') {
            const opponent = room.players.find(p => p.id !== room.hostId);
            starterId = opponent ? opponent.id : 'waiting_for_opponent';
        }

        socket.emit('gameState', {
            mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
            players: room.players,
            gameStatus: 'waiting',
            hostId: room.hostId,
            whoStarts: room.whoStarts,
            activePlayer: starterId,
            gameOptions: room.gameOptions,
            legsWon: room.game ? room.game.legsWon : {},
            setsWon: room.game ? room.game.setsWon : {}
        });
    });

    socket.on('rematch', (data) => {
        const { roomId } = data;
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) {
            console.log(`[REMATCH ERROR] Room ${roomId} not found`);
            socket.emit('gameError', { error: 'Raum nicht mehr verfügbar. Bitte erstelle einen neuen Raum.' });
            return;
        }

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
            player.bestLeg = null;
            player.highestFinish = 0;
            player.matchDartsThrown = 0;
            player.matchPointsScored = 0;
        });

        let starterId = room.hostId;
        if (room.whoStarts === 'opponent') {
            const opponent = room.players.find(p => p.id !== room.hostId);
            starterId = opponent ? opponent.id : 'waiting_for_opponent';
        }

        const waitingState = {
            mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
            players: room.players,
            gameStatus: 'waiting',
            hostId: room.hostId,
            whoStarts: room.whoStarts,
            gameOptions: room.gameOptions,
            activePlayer: starterId
        };
        room.gameState = waitingState;
        io.to(room.id).emit('game-state-update', waitingState);
    });

    socket.on('bull-off-submit', (data) => {
        const { roomId, playerId, throws } = data;
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) return;
        if (!room.bullOffThrows) room.bullOffThrows = {};
        room.bullOffThrows[playerId] = throws;
        io.to(roomId).emit('bull-off-throws', { playerId, throws });
    });

    socket.on('bull-off-restart', (data) => {
        const { roomId } = data;
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) return;
        room.bullOffThrows = {};
        io.to(roomId).emit('bull-off-restart', { roomId });
    });
}

module.exports = registerGameLifecycleEvents;
