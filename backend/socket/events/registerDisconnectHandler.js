function registerDisconnectHandler({ io, socket, state }) {
    socket.on('disconnect', () => {
        state.connectedUsers = state.connectedUsers.filter(user => user.id !== socket.id);
        state.onlineUsers--;
        io.emit('updateOnlineUsers', state.onlineUsers);
        io.emit('connectedUsers', state.connectedUsers);

        state.rooms.forEach(room => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            const spectatorIndex = room.spectators.findIndex(s => s.id === socket.id);

            if (playerIndex !== -1) {
                const disconnectedPlayer = room.players[playerIndex];
                console.log(`Player ${disconnectedPlayer.name} disconnected from room ${room.id}`);

                disconnectedPlayer.disconnected = true;

                io.to(room.id).emit('receiveMessage', { user: 'System', text: `${disconnectedPlayer.name} hat die Verbindung verloren.` });

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
        io.emit('updateRooms', state.rooms);
    });
}

module.exports = registerDisconnectHandler;
