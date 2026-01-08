const { X01Game, CricketGame } = require('./gameModes');
const state = require('./socket/state');
const { createFullGameStateUpdate, updateBestLegAfterLegEnd, canCheckoutFrom } = require('./socket/utils/gameStateUtils');
const registerLobbyEvents = require('./socket/events/registerLobbyEvents');
const registerGameLifecycleEvents = require('./socket/events/registerGameLifecycleEvents');
const registerGameplayEvents = require('./socket/events/registerGameplayEvents');
const registerMediaEvents = require('./socket/events/registerMediaEvents');
const registerDisconnectHandler = require('./socket/events/registerDisconnectHandler');

function initializeSocket(io) {
    io.on('connection', (socket) => {
        const user = { id: socket.id, name: `User_${socket.id.substring(0, 4)}` };
        state.connectedUsers.push(user);

        state.onlineUsers++;
        io.emit('updateOnlineUsers', state.onlineUsers);
        io.emit('connectedUsers', state.connectedUsers);
        console.log(`User connected: ${socket.id}, Online Users: ${state.onlineUsers}`);

        const context = {
            io,
            socket,
            state,
            games: { X01Game, CricketGame },
            utils: { createFullGameStateUpdate, updateBestLegAfterLegEnd, canCheckoutFrom }
        };

        registerLobbyEvents(context);
        registerGameLifecycleEvents(context);
        registerGameplayEvents(context);
        registerMediaEvents(context);
        registerDisconnectHandler(context);
    });
}

module.exports = initializeSocket;
