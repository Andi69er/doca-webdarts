const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path'); 

const { generateJWT, verifyJWT, mockOAuthLogin, mockOAuthCallback, refreshJWT } = require('./auth');

dotenv.config();

// =================================================================
// 1. ECHTE SPIEL-LOGIK (X01)
// =================================================================
class X01Game {
    constructor(options = {}) {
        this.startScore = options.startingScore || 501;
        this.players = [];
        this.currentPlayerIndex = 0;
        this.history = [];
        this.gameWinner = null;
    }

    initializePlayers(playerIds) {
        this.players = playerIds.map(id => ({
            id: id,
            score: this.startScore,
            sets: 0,
            legs: 0,
            name: "Spieler " + id.substr(0, 4)
        }));
        this.currentPlayerIndex = 0;
    }

    getGameState() {
        return {
            players: this.players,
            gameState: {
                currentPlayerIndex: this.currentPlayerIndex,
                throwHistory: this.history,
                gameWinner: this.gameWinner
            },
            gameStatus: this.gameWinner ? 'finished' : 'playing'
        };
    }

    processScore(userId, points) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== userId) {
            return { valid: false, message: "Nicht dein Zug" };
        }

        const newScore = currentPlayer.score - points;
        let turnResult = "continue";

        if (newScore === 0) {
            currentPlayer.score = 0;
            currentPlayer.legs += 1;
            this.gameWinner = userId;
            turnResult = "win";
        } else if (newScore <= 1) {
            turnResult = "bust";
        } else {
            currentPlayer.score = newScore;
        }

        this.history.push({
            userId,
            score: points,
            remaining: currentPlayer.score,
            result: turnResult,
            timestamp: new Date()
        });

        if (turnResult !== "win") {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }

        return { valid: true, gameState: this.getGameState() };
    }
}

class CricketGame { initializePlayers(p) { this.p = p; } getGameState() { return {}; } }
class BullOffGame { initializePlayers(p) { this.p = p; } getGameState() { return {}; } }

// =================================================================
// 2. ROOM & GAME MANAGER
// =================================================================
class RoomManager {
    constructor() { this.rooms = new Map(); }
    
    createRoom(roomData) {
        const roomId = Math.random().toString(36).substring(2, 6).toLowerCase();
        const room = {
            id: roomId,
            ...roomData,
            players: [],
            host: null,
            gameInstance: null
        };
        this.rooms.set(roomId, room);
        return room;
    }

    getRooms() { return Array.from(this.rooms.values()); }
    getRoom(roomId) { return this.rooms.get(roomId); }

    joinRoom(roomId, userId) {
        const room = this.getRoom(roomId);
        if (!room) return { success: false, message: 'Raum nicht gefunden' };
        
        if (!room.players.includes(userId)) {
            if (room.players.length >= 2) return { success: false, message: 'Raum voll' };
            room.players.push(userId);
        }
        
        if (!room.host) room.host = userId;
        return { success: true, room };
    }
    
    startGame(roomId, hostId) {
        const room = this.getRoom(roomId);
        if (!room) return { success: false };
        const game = new X01Game(room.gameOptions);
        game.initializePlayers(room.players);
        room.gameInstance = game;
        room.gameStarted = true;
        return { success: true, gameState: game.getGameState() };
    }

    processInput(roomId, userId, score) {
        const room = this.getRoom(roomId);
        if (!room || !room.gameInstance) return { success: false };
        return room.gameInstance.processScore(userId, score);
    }
    
    leaveRoom(roomId, userId) {
        const room = this.getRoom(roomId);
        if (room) {
            room.players = room.players.filter(p => p !== userId);
            if (room.players.length === 0) this.rooms.delete(roomId);
            else if (room.host === userId) room.host = room.players[0];
        }
    }
}

// =================================================================
// 3. SERVER SETUP
// =================================================================
const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "https://heroic-banoffee-4c3f4f.netlify.app", 
  "https://doca-webdarts.onrender.com",
  "https://doca-webdarts-1.onrender.com",
  "http://localhost:3000",
  "http://localhost:3001"
];

const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

const roomManager = new RoomManager();

// --- CLIENT FILES (React App Serving) ---
// WICHTIG: Hier MUSS der Pfad zu Ihrem kompilierten React-Code stehen!
// Da Sie die UI sehen, NEHME ICH AN, dass Ihr Frontend im Ordner 'frontend/build' oder 'frontend/dist' liegt.
// PASSEN SIE DIESEN PFAD AN IHRE VERZEICHNISSTRUKTUR AN!
app.use(express.static(path.join(__dirname, 'frontend', 'build'))); 
// FALLBACK: Wenn die obige Zeile fehlschlägt, versuchen Sie es mit 'public' oder 'dist'
// app.use(express.static(path.join(__dirname, 'public'))); 


// --- ROUTES ---
app.get('/', (req, res) => {
    // Sende die index.html der React App für alle nicht-API-Anfragen, damit das Routing funktioniert
    res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

app.post('/api/auth/login', (req, res) => res.json({ redirectUrl: mockOAuthLogin() }));
app.post('/api/auth/callback', (req, res) => res.json({ token: generateJWT({id: 'test'}), user: {id: 'test'} }));
app.get('/api/auth/me', (req, res) => res.json({ user: 'guest' }));
app.get('/api/stats/:userId', (req, res) => res.json({ wins: 0 }));
app.get('/api/rooms', (req, res) => res.json(roomManager.getRooms()));
app.post('/api/rooms', (req, res) => res.json({ message: 'OK' }));

// --- SOCKETS ---
io.on('connection', (socket) => { 
    console.log('User connected:', socket.id); 
    
    // *** AUTOMATISCHER RELOAD TRIGGER BEI NEUER VERBINDUNG (nach Nodemon Neustart) ***
    socket.emit('server_reload_trigger'); 
    // **********************************************************************************
    
    socket.on('createRoom', (data) => { 
        const room = roomManager.createRoom(data); 
        socket.join(room.id); 
        socket.emit('roomCreated', room); 
        io.emit('roomsUpdated', roomManager.getRooms()); 
    }); 
    
    socket.on('joinRoom', (data) => { 
        const result = roomManager.joinRoom(data.roomId, socket.id); 
        if (result.success) { 
            socket.join(data.roomId); 
            const room = roomManager.getRoom(data.roomId);
            if (room.gameInstance) {
                socket.emit('game-state-update', room.gameInstance.getGameState());
            }
            socket.emit('joinedRoom', result); 
        } 
    }); 
    
    socket.on('getGameState', (roomId) => {
        const room = roomManager.getRoom(roomId);
        if (room && room.gameInstance) {
            socket.emit('game-state-update', room.gameInstance.getGameState());
        }
    });

    const handleStart = (data) => {
        console.log("Starte Spiel:", data.roomId);
        const result = roomManager.startGame(data.roomId, socket.id);
        if (result.success) {
            io.to(data.roomId).emit('game-state-update', result.gameState);
        }
    };
    socket.on('startGame', handleStart);
    socket.on('start-game', handleStart);
    socket.on('start', handleStart);

    socket.on('score-input', (data) => { 
        console.log(`Score: ${data.score} von ${data.userId}`);
        const result = roomManager.processInput(data.roomId, data.userId, data.score);
        if (result && result.valid) {
            io.to(data.roomId).emit('game-state-update', result.gameState);
        }
    });

    socket.on('camera-offer', (data) => socket.to(data.roomId).emit('camera-offer', data)); 
    socket.on('camera-answer', (data) => socket.to(data.roomId).emit('camera-answer', data)); 
    socket.on('camera-ice', (data) => socket.to(data.roomId).emit('camera-ice', data)); 
    
    socket.on('leaveRoom', (data) => {
        socket.leave(data.roomId);
        roomManager.leaveRoom(data.roomId, socket.id);
        io.emit('roomsUpdated', roomManager.getRooms());
    });

    socket.on('disconnect', () => { 
        console.log('User disconnected:', socket.id); 
    });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});