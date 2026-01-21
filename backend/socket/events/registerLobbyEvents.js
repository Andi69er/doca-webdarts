function registerLobbyEvents({ io, socket, state }) {
    const defaultTeamNames = { teamA: 'Team A', teamB: 'Team B' };

    const getPerTeamLimit = (room) => Math.max(1, Math.floor((room?.maxPlayers || 2) / 2));

    const ensureTeamData = (room, overrides = {}) => {
        if (!room) {
            return;
        }
        room.teamMode = overrides.teamMode || room.teamMode || 'singles';
        const teamAName = overrides.teamAName || overrides.teamNames?.teamA || room.teamNames?.teamA || defaultTeamNames.teamA;
        const teamBName = overrides.teamBName || overrides.teamNames?.teamB || room.teamNames?.teamB || defaultTeamNames.teamB;
        room.teamNames = { teamA: teamAName, teamB: teamBName };
        if (!room.teamAssignments) {
            room.teamAssignments = {};
        }
        if (!room.maxPlayers) {
            room.maxPlayers = room.teamMode === 'doubles' ? 4 : 2;
        }
    };

    const getTeamCounts = (room) => {
        const counts = { teamA: 0, teamB: 0 };
        if (!room || !room.players) {
            return counts;
        }
        room.players.forEach((player) => {
            const assignment = room.teamAssignments?.[player.id];
            if (assignment && typeof counts[assignment] === 'number') {
                counts[assignment]++;
            }
        });
        return counts;
    };

    const applyTeamMeta = (player, teamKey, teamNames) => {
        if (!player || !teamKey) {
            return;
        }
        const label = teamNames?.[teamKey] || defaultTeamNames[teamKey] || teamKey;
        player.team = label;
        player.teamName = label;
    };

    const syncPlayerTeams = (room) => {
        if (!room) {
            return;
        }
        ensureTeamData(room);
        const { teamAssignments, teamNames } = room;
        const syncList = (list = []) => {
            list.forEach((player) => {
                const assignment = teamAssignments[player.id];
                if (assignment) {
                    applyTeamMeta(player, assignment, teamNames);
                }
            });
        };
        syncList(room.players);
        if (room.gameState?.players) {
            syncList(room.gameState.players);
        }
        if (room.gameState) {
            room.gameState.teamMode = room.teamMode;
            room.gameState.teamNames = room.teamNames;
            room.gameState.teamAssignments = { ...room.teamAssignments };
        }
    };

    const assignPlayerToTeam = (room, player, preferredTeamKey = null) => {
        if (!room || !player) {
            return null;
        }
        ensureTeamData(room);
        const perTeamLimit = getPerTeamLimit(room);
        const counts = getTeamCounts(room);
        let targetKey = preferredTeamKey;
        if (targetKey && counts[targetKey] >= perTeamLimit) {
            targetKey = null;
        }
        if (!targetKey) {
            if (counts.teamA === counts.teamB) {
                targetKey = 'teamA';
            } else {
                targetKey = counts.teamA < counts.teamB ? 'teamA' : 'teamB';
            }
            if (counts[targetKey] >= perTeamLimit) {
                targetKey = targetKey === 'teamA' ? 'teamB' : 'teamA';
            }
        }
        if (!targetKey) {
            targetKey = 'teamA';
        }
        room.teamAssignments[player.id] = targetKey;
        applyTeamMeta(player, targetKey, room.teamNames);
        syncPlayerTeams(room);
        return targetKey;
    };

    const moveTeamAssignment = (room, oldId, newId) => {
        if (!room || !oldId || !newId || oldId === newId) {
            return;
        }
        ensureTeamData(room);
        const assignment = room.teamAssignments?.[oldId];
        if (assignment) {
            room.teamAssignments[newId] = assignment;
            delete room.teamAssignments[oldId];
            syncPlayerTeams(room);
        }
    };

    const attachTeamMetadata = (target, room) => {
        if (!target || !room) {
            return target;
        }
        ensureTeamData(room);
        target.teamMode = room.teamMode;
        target.teamNames = room.teamNames;
        target.teamAssignments = { ...room.teamAssignments };
        return target;
    };

    socket.on('getRooms', () => {
        socket.emit('updateRooms', state.rooms);
    });

    socket.on('getOnlineUsers', () => {
        socket.emit('updateOnlineUsers', state.onlineUsers);
    });

    socket.on('getConnectedUsers', () => {
        socket.emit('connectedUsers', state.connectedUsers);
    });

    socket.on('getFinishedGames', () => {
        const recentGames = state.finishedGames.slice(-20).reverse();
        socket.emit('finishedGames', recentGames);
    });

    socket.on('getRunningGames', () => {
        const running = state.rooms
            .filter(room => room.game && room.gameState && !room.gameState.gameWinner && room.players.length >= 2)
            .map(room => ({
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
        const flatData = { ...roomData };
        if (roomData.gameOptions) {
            Object.assign(flatData, roomData.gameOptions);
        }

        const startScore = parseInt(flatData.startingScore, 10) || 501;
        const sets = parseInt(flatData.sets, 10) || 0;
        const legs = parseInt(flatData.legs, 10) || 1;
        const winType = flatData.winType || 'firstTo';
        const isBestOf = winType === 'bestOf';

        let whoStarts = flatData.whoStarts || roomData.whoStarts;
        if (!whoStarts && (flatData.opponentStarts === true || flatData.opponentStarts === 'true')) {
            whoStarts = 'opponent';
        }

        const gameOptions = {
            startingScore: startScore,
            inMode: flatData.inMode || 'single',
            outMode: flatData.outMode || 'double',
            sets,
            legs,
            winType,
            length: {
                type: isBestOf ? 'bestOf' : 'firstTo',
                value: sets > 0 ? sets : legs
            },
            checkIn: flatData.inMode || 'single',
            checkOut: flatData.outMode || 'double'
        };

        const teamMode = flatData.teamMode === 'doubles' ? 'doubles' : 'singles';
        const teamAName = (flatData.teamAName || 'Team A').trim() || 'Team A';
        const teamBName = (flatData.teamBName || 'Team B').trim() || 'Team B';
        const maxPlayers = teamMode === 'doubles' ? 4 : 2;
        const hostPlayer = {
            id: socket.id,
            name: `Player ${Math.floor(Math.random() * 1000)}`,
            score: startScore
        };

        const newRoom = {
            id: (Math.random().toString(36).substring(2, 8)),
            name: flatData.roomName || roomData.roomName,
            gameMode: gameOptions.gameMode || flatData.gameMode || roomData.gameMode,
            gameOptions,
            whoStarts,
            hostId: socket.id,
            maxPlayers,
            players: [hostPlayer],
            spectators: [],
            gameState: null,
            game: null,
            teamMode,
            teamNames: { teamA: teamAName, teamB: teamBName },
            teamAssignments: {}
        };

        ensureTeamData(newRoom, { teamMode, teamAName, teamBName });
        assignPlayerToTeam(newRoom, hostPlayer, 'teamA');

        state.rooms.push(newRoom);

        socket.join(newRoom.id);
        socket.emit('roomCreated', { roomId: newRoom.id });
        io.emit('updateRooms', state.rooms);
    });

    socket.on('joinRoom', (data) => {
        const room = state.rooms.find(r => r.id === data.roomId);

        if (!room) {
            socket.emit('gameError', { error: 'Room not found' });
            return;
        }

        ensureTeamData(room);
        syncPlayerTeams(room);

        const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);

        if (room.hostId !== socket.id) {
            const hostPlayerInRoom = room.players.find(p => p.id === room.hostId);
            if (hostPlayerInRoom && hostPlayerInRoom.id === room.hostId && hostPlayerInRoom.disconnected) {
                const oldHostId = room.hostId;
                room.hostId = socket.id;
                hostPlayerInRoom.id = socket.id;
                hostPlayerInRoom.disconnected = false;
                moveTeamAssignment(room, oldHostId, socket.id);

                if (room.gameState?.players) {
                    const idx = room.gameState.players.findIndex(p => p.id === oldHostId);
                    if (idx !== -1) {
                        room.gameState.players[idx].id = socket.id;
                    }
                }

                io.to(room.id).emit('receiveMessage', {
                    user: 'System',
                    text: `Host (${hostPlayerInRoom.name}) hat die Verbindung wiederhergestellt.`
                });

                socket.join(room.id);
                attachTeamMetadata(room.gameState, room);
                io.to(room.id).emit('game-state-update', room.gameState);
                socket.emit('gameState', room.gameState);
                return;
            }
        }

        // Verbesserte Reconnection-Logik: Suche nach einem disconnected Player mit gleichem Namen
        const rejoiningPlayer = room.players.find(p => p.disconnected && p.name === socket.handshake.query?.userName);
        
        if (rejoiningPlayer) {
            const oldId = rejoiningPlayer.id;
            rejoiningPlayer.id = socket.id;
            rejoiningPlayer.disconnected = false;
            delete rejoiningPlayer.disconnectedAt;
            
            moveTeamAssignment(room, oldId, socket.id);
            socket.join(room.id);

            io.to(room.id).emit('receiveMessage', {
                user: 'System',
                text: `${rejoiningPlayer.name} ist wieder da.`
            });

            if (room.gameState && room.gameState.players) {
                const gamePlayer = room.gameState.players.find(p => p.id === oldId);
                if (gamePlayer) {
                    gamePlayer.id = socket.id;
                    gamePlayer.disconnected = false;
                }
            }
            
            if (room.hostId === oldId) {
                room.hostId = socket.id;
                if (room.gameState) room.gameState.hostId = socket.id;
            }

            attachTeamMetadata(room.gameState, room);
            io.to(room.id).emit('game-state-update', room.gameState);
            socket.emit('gameState', room.gameState);
            socket.emit('roomJoined', { roomId: room.id });
            return;
        }

        if (existingPlayerIndex !== -1) {
            let starterId = room.hostId;
            if (room.whoStarts === 'opponent') {
                const opponent = room.players.find(p => p.id !== room.hostId);
                starterId = opponent ? opponent.id : 'waiting_for_opponent';
            }

            const gameState = room.gameState || {
                mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                players: room.players,
                gameStatus: 'waiting',
                hostId: room.hostId,
                whoStarts: room.whoStarts,
                gameOptions: room.gameOptions,
                gameMode: room.gameMode
            };

            attachTeamMetadata(gameState, room);
            gameState.activePlayer = starterId;
            socket.emit('gameState', gameState);
            if (!room.gameState) room.gameState = gameState;
            return;
        }

        if (room.players.length < room.maxPlayers) {
            const gameOptions = room.gameOptions || {};
            const startScore = parseInt(gameOptions.startingScore, 10) || 501;

            const newPlayer = {
                id: socket.id,
                name: `Player ${Math.floor(Math.random() * 1000)}`,
                score: startScore
            };
            room.players.push(newPlayer);
            assignPlayerToTeam(room, newPlayer, data.teamKey);
            socket.join(room.id);

            io.to(room.id).emit('receiveMessage', {
                user: 'System',
                text: `${newPlayer.name} ist dem Raum beigetreten.`
            });

            socket.emit('roomJoined', { roomId: room.id });

            if (room.game) {
                attachTeamMetadata(room.gameState, room);
                socket.emit('game-started', room.gameState);
            }

            let starterId = room.hostId;
            if (room.whoStarts === 'opponent') {
                const opponent = room.players.find(p => p.id !== room.hostId);
                starterId = opponent ? opponent.id : 'waiting_for_opponent';
            }

            const waitingState = room.gameState || {
                mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                players: room.players,
                gameStatus: 'waiting',
                hostId: room.hostId,
                whoStarts: room.whoStarts,
                gameOptions: room.gameOptions
            };

            attachTeamMetadata(waitingState, room);
            waitingState.activePlayer = starterId;
            waitingState.players = room.players;
            room.gameState = waitingState;

            io.to(room.id).emit('game-state-update', waitingState);
            io.to(room.id).emit('gameState', waitingState);
            io.emit('updateRooms', state.rooms);
            return;
        }

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
        attachTeamMetadata(room.gameState, room);
        socket.emit('game-state-update', room.gameState);
    });

    socket.on('switchTeam', (data) => {
        const { roomId, teamKey, playerId } = data || {};
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) {
            socket.emit('gameError', { error: 'Raum nicht gefunden.' });
            return;
        }

        ensureTeamData(room);

        if (room.teamMode !== 'doubles') {
            socket.emit('gameError', { error: 'Teamwechsel ist nur im Doppelmodus möglich.' });
            return;
        }

        const normalizedTeam = teamKey === 'teamB' ? 'teamB' : 'teamA';
        
        // Wenn playerId mitgegeben wurde, prüfen ob der ausführende User Host ist
        const targetPlayerId = (playerId && room.hostId === socket.id) ? playerId : socket.id;
        const player = room.players.find(p => p.id === targetPlayerId);

        if (!player) {
            socket.emit('gameError', { error: 'Spieler nicht im Raum.' });
            return;
        }

        const status = room.gameState?.gameStatus;
        if (status && status !== 'waiting') {
            socket.emit('gameError', { error: 'Teamwechsel nach Spielstart nicht möglich.' });
            return;
        }

        const currentTeam = room.teamAssignments?.[player.id];
        if (currentTeam === normalizedTeam) {
            socket.emit('teamSwitchAck', { teamKey: currentTeam, teamName: room.teamNames?.[currentTeam] });
            return;
        }

        const perTeamLimit = getPerTeamLimit(room);
        const counts = getTeamCounts(room);
        if (counts[normalizedTeam] >= perTeamLimit) {
            socket.emit('gameError', { error: 'Dieses Team ist bereits voll.' });
            return;
        }

        room.teamAssignments[player.id] = normalizedTeam;
        applyTeamMeta(player, normalizedTeam, room.teamNames);
        syncPlayerTeams(room);

        if (!room.gameState) {
            room.gameState = {
                mode: room.gameMode === 'CricketGame' ? 'cricket' : 'x01',
                players: room.players,
                gameStatus: 'waiting',
                hostId: room.hostId,
                whoStarts: room.whoStarts,
                gameOptions: room.gameOptions
            };
        }

        attachTeamMetadata(room.gameState, room);

        io.to(room.id).emit('receiveMessage', {
            user: 'System',
            text: `${player.name} spielt jetzt für ${room.teamNames?.[normalizedTeam] || normalizedTeam}.`
        });

        io.to(room.id).emit('game-state-update', room.gameState);
        io.emit('updateRooms', state.rooms);
    });

    socket.on('renameTeam', (data) => {
        const { roomId, teamKey, newName } = data || {};
        const room = state.rooms.find(r => r.id === roomId);
        if (!room || room.hostId !== socket.id) return;

        ensureTeamData(room);
        const normalizedKey = teamKey === 'teamB' ? 'teamB' : 'teamA';
        room.teamNames[normalizedKey] = newName.trim();

        // Alle Spieler in diesem Team aktualisieren
        room.players.forEach(p => {
            if (room.teamAssignments[p.id] === normalizedKey) {
                applyTeamMeta(p, normalizedKey, room.teamNames);
            }
        });

        if (room.gameState) {
            attachTeamMetadata(room.gameState, room);
        }

        io.to(room.id).emit('receiveMessage', {
            user: 'System',
            text: `Team ${normalizedKey === 'teamA' ? 'A' : 'B'} wurde in "${newName}" umbenannt.`
        });

        io.to(room.id).emit('game-state-update', room.gameState);
        io.emit('updateRooms', state.rooms);
    });

    socket.on('changePlayerName', (data) => {
        const { roomId, userId, newName } = data;
        if (!newName || newName.trim().length < 3 || newName.trim().length > 15) {
            socket.emit('gameError', { error: 'Name muss zwischen 3 und 15 Zeichen lang sein.' });
            return;
        }

        const room = state.rooms.find(r => r.id === roomId);
        if (!room) {
            socket.emit('gameError', { error: 'Raum nicht gefunden.' });
            return;
        }

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
        attachTeamMetadata(room.gameState, room);
        io.to(room.id).emit('game-state-update', room.gameState);
    });

    socket.on('kickPlayer', (data) => {
        const { roomId, playerIdToKick } = data;
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) {
            socket.emit('gameError', { error: 'Raum nicht gefunden.' });
            return;
        }

        if (room.hostId !== socket.id) {
            socket.emit('gameError', { error: 'Nur der Host kann Spieler kicken.' });
            return;
        }

        const playerToKick = room.players.find(p => p.id === playerIdToKick);
        if (!playerToKick) {
            socket.emit('gameError', { error: 'Spieler nicht im Raum gefunden.' });
            return;
        }

        const kickedSocket = io.sockets.sockets.get(playerIdToKick);
        if (kickedSocket) {
            kickedSocket.leave(roomId);
            kickedSocket.emit('youHaveBeenKicked', { message: 'Du wurdest vom Host aus dem Raum entfernt.' });
        }

        room.players = room.players.filter(p => p.id !== playerIdToKick);
        syncPlayerTeams(room);
        attachTeamMetadata(room.gameState, room);
        io.to(roomId).emit('receiveMessage', { user: 'System', text: `${playerToKick.name} wurde vom Host entfernt.` });
        io.to(roomId).emit('game-state-update', { ...room.gameState, players: room.players });
        io.emit('updateRooms', state.rooms);
    });

    socket.on('sendMessage', (message) => {
        if (message.roomId) {
            io.to(message.roomId).emit('receiveMessage', message);
            return;
        }
        const lobbyMessage = {
            ...message,
            user: `User_${socket.id.substring(0, 4)}`
        };
        io.emit('receiveMessage', lobbyMessage);
    });
}

module.exports = registerLobbyEvents;
