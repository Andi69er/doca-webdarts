function registerDisconnectHandler({ io, socket, state }) {
    socket.on('disconnect', () => {
        const socketId = socket.id;
        state.connectedUsers = state.connectedUsers.filter(user => user.id !== socketId);
        state.onlineUsers = Math.max(0, state.onlineUsers - 1);
        
        io.emit('updateOnlineUsers', state.onlineUsers);
        io.emit('connectedUsers', state.connectedUsers);

        state.rooms.forEach(room => {
            const playerIndex = room.players.findIndex(p => p.id === socketId);
            const spectatorIndex = room.spectators.findIndex(s => s.id === socketId);

            if (playerIndex !== -1) {
                const disconnectedPlayer = room.players[playerIndex];
                console.log(`[Disconnect] Player ${disconnectedPlayer.name} (${socketId}) disconnected from room ${room.id}`);

                disconnectedPlayer.disconnected = true;
                disconnectedPlayer.disconnectedAt = Date.now();

                io.to(room.id).emit('receiveMessage', { 
                    user: 'System', 
                    text: `${disconnectedPlayer.name} hat die Verbindung verloren.` 
                });

                if (room.gameState && room.gameState.players) {
                    const playerInGame = room.gameState.players.find(p => p.id === socketId);
                    if (playerInGame) playerInGame.disconnected = true;
                }
                io.to(room.id).emit('game-state-update', room.gameState);

                // Timeout: Wenn der Spieler nach 60 Sekunden nicht wieder da ist, wird er (falls das Spiel nicht läuft) entfernt
                setTimeout(() => {
                    const r = state.rooms.find(rm => rm.id === room.id);
                    if (!r) return;
                    
                    const p = r.players.find(pl => pl.id === socketId && pl.disconnected);
                    if (p) {
                        const isGameActive = r.gameState && r.gameState.gameStatus === 'active';
                        if (!isGameActive) {
                            r.players = r.players.filter(pl => pl.id !== socketId);
                            console.log(`[Cleanup] Player ${p.name} removed from room ${r.id} after timeout.`);
                            io.to(r.id).emit('game-state-update', r.gameState);
                            io.emit('updateRooms', state.rooms);
                        }
                    }
                }, 60000);

            } else if (spectatorIndex !== -1) {
                const leavingSpectator = room.spectators[spectatorIndex];
                room.spectators.splice(spectatorIndex, 1);
                console.log(`[Disconnect] Spectator ${leavingSpectator.name} (${socketId}) left room ${room.id}`);
                io.to(room.id).emit('receiveMessage', { user: 'System', text: `${leavingSpectator.name} schaut nicht mehr zu.` });
            }
        });
        io.emit('updateRooms', state.rooms);
    });
}

module.exports = registerDisconnectHandler;
