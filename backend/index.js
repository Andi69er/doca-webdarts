const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const { gameModes, GameManager } = require('./gameModes');

console.log('FINALE SERVER VERSION WIRD GESTARTET');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: "https://doca-webdarts-1.onrender.com",
  methods: ["GET", "POST"]
};
app.use(cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions
});

let onlineUsers = 0;
let rooms = [];

io.on('connection', (socket) => {
    onlineUsers++;
    io.emit('updateOnlineUsers', onlineUsers);
    console.log(`User connected: ${socket.id}, Online Users: ${onlineUsers}`);

    socket.on('getRooms', () => {
        socket.emit('updateRooms', rooms);
    });

    socket.on('getOnlineUsers', () => {
        socket.emit('updateOnlineUsers', onlineUsers);
    });

    socket.on('createRoom', (roomData) => {
        // DAS FINALE RAUCHZEICHEN
        console.log('!!! createRoom EVENT VOM CLIENT EMPFANGEN !!! Daten:', roomData);

        const newRoom = {
            id: (Math.random().toString(36).substring(2, 8)),
            name: roomData.roomName,
            gameMode: roomData.gameMode,
            maxPlayers: roomData.maxPlayers,
            players: [{ id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`, score: gameModes[roomData.gameMode].startScore }],
            gameState: {
                currentPlayerIndex: 0,
                scores: {},
            }
        };
        rooms.push(newRoom);
        socket.join(newRoom.id);
        socket.emit('roomCreated', { roomId: newRoom.id });
        io.emit('updateRooms', rooms);
        console.log(`Raum erfolgreich erstellt: ${newRoom.name} (${newRoom.id})`);
    });

    socket.on('joinRoom', (data) => {
        const room = rooms.find(r => r.id === data.roomId);
        if (room && room.players.length < room.maxPlayers) {
            const newPlayer = { id: socket.id, name: `Player ${Math.floor(Math.random() * 1000)}`, score: gameModes[room.gameMode].startScore };
            room.players.push(newPlayer);
            socket.join(room.id);
            io.to(room.id).emit('updateRoom', room);
            io.emit('updateRooms', rooms);
            console.log(`User ${socket.id} joined room ${room.id}`);
        }
    });

    socket.on('sendMessage', (message) => {
        // RAUCHZEICHEN FÜR CHAT
        console.log('!!! sendMessage EVENT VOM CLIENT EMPFANGEN !!! Nachricht:', message);
        io.emit('receiveMessage', { user: socket.id, text: message.text });
    });

    socket.on('disconnect', () => {
        onlineUsers--;
        io.emit('updateOnlineUsers', onlineUsers);
        rooms.forEach(room => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    rooms = rooms.filter(r => r.id !== room.id);
                }
                io.to(room.id).emit('updateRoom', room);
            }
        });
        io.emit('updateRooms', rooms);
        console.log(`User disconnected: ${socket.id}, Online Users: ${onlineUsers}`);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});