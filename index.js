const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
// const mysql = require('mysql2'); // <-- DEAKTIVIERT FÜR DEN TEST-MODUS
const { generateJWT, verifyJWT, mockOAuthLogin, mockOAuthCallback, refreshJWT } = require('./auth');

// Load environment variables
dotenv.config();

// --- Platzhalter-Klassen (bleiben wie sie sind) ---
class X01Game { initializePlayers(players) { this.players = players; this.turns = {}; } getGameState() { return { message: "X01 Game State" }; } processThrow(userId, throwData) { return { valid: true }; } }
class CricketGame { initializePlayers(players) { this.players = players; this.turns = {}; } getGameState() { return { message: "Cricket Game State" }; } processThrow(userId, throwData) { return { valid: true }; } }
class BullOffGame { initializePlayers(players) { this.players = players; this.turns = {}; } getGameState() { return { message: "Bull-Off State" }; } }
class RoomManager { constructor() { this.rooms = new Map(); } createRoom(roomData) { const roomId = Math.random().toString(36).substring(2, 9); const room = { id: roomId, ...roomData, players: [], host: null, gameStarted: false, gameEnded: false, gameState: null }; this.rooms.set(roomId, room); return room; } getRooms() { return Array.from(this.rooms.values()); } getRoom(roomId) { return this.rooms.get(roomId); } joinRoom(roomId, userId, password) { const room = this.getRoom(roomId); if (!room) return { success: false, message: 'Room not found' }; if (room.password && room.password !== password) return { success: false, message: 'Invalid password' }; if (room.players.length >= 2) return { success: false, message: 'Room is full' }; room.players.push(userId); if (!room.host) { room.host = userId; } return { success: true, room }; } leaveRoom(roomId, userId) { const room = this.getRoom(roomId); if (room) { room.players = room.players.filter(p => p !== userId); if (room.players.length === 0) { this.rooms.delete(roomId); } else if (room.host === userId) { room.host = room.players[0]; } } } }
class GameManager { constructor() { this.roomManager = new RoomManager(); this.games = new Map(); } createRoom(roomData) { return this.roomManager.createRoom(roomData); } getRooms() { return this.roomManager.getRooms(); } getRoom(roomId) { return this.roomManager.getRoom(roomId); } joinRoom(roomId, userId, password) { return this.roomManager.joinRoom(roomId, userId, password); } leaveRoom(roomId, userId) { const room = this.getRoom(roomId); if (room && room.gameStarted && !room.gameEnded) { room.gameEnded = true; room.gameWinner = room.players.filter(p => p !== userId).length === 1 ? room.players.filter(p => p !== userId)[0] : null; } this.roomManager.leaveRoom(roomId, userId); if (!this.roomManager.getRoom(roomId)) { this.games.delete(roomId); } } startGame(roomId, userId) { const room = this.getRoom(roomId); if (!room || room.host !== userId || room.players.length < 2) { return { success: false, message: 'Cannot start game' }; } const bullOffGame = new BullOffGame(); bullOffGame.initializePlayers(room.players); this.games.set(roomId, bullOffGame); room.gameStarted = true; room.gameState = bullOffGame.getGameState(); return { success: true, gameState: room.gameState, mode: 'bull-off' }; } startActualGame(roomId, userId, bullOffWinner) { const room = this.getRoom(roomId); if (!room || room.host !== userId || !room.players.includes(bullOffWinner)) { return { success: false, message: 'Cannot start actual game' }; } if (bullOffWinner === room.players[1]) { room.players.reverse(); } let gameInstance; switch (room.gameMode) { case 'x01': gameInstance = new X01Game(room.gameOptions); break; case 'cricket': gameInstance = new CricketGame(room.gameOptions); break; default: return { success: false, message: 'Invalid game mode' }; } gameInstance.initializePlayers(room.players); this.games.set(roomId, gameInstance); room.gameState = gameInstance.getGameState(); room.bullOffWinner = bullOffWinner; return { success: true, gameState: room.gameState }; } processThrow(roomId, userId, throwData) { const game = this.games.get(roomId); const room = this.getRoom(roomId); if (!game || !room || room.gameEnded) { return { valid: false, reason: 'Game not active' }; } const result = game.processThrow(userId, throwData); room.gameState = game.getGameState(); if (game.gameWinner) { room.gameEnded = true; room.gameWinner = game.gameWinner; this.saveGameResult(roomId, room); } return result; } setCheckoutDarts(roomId, darts) { return { success: true }; } rematch(roomId, userId) { const room = this.getRoom(roomId); if (!room) return { success: false }; room.players.reverse(); room.gameStarted = false; room.gameEnded = false; room.gameWinner = null; return { success: true, players: room.players }; } async saveGameResult(roomId, room) { console.log(`Simulating: Game result for room ${roomId} would be saved to the database now.`); return; } }

const app = express();
const server = http.createServer(app);

// =================================================================
// FINALE KORREKTUR: CORS-Einstellungen
// =================================================================
const allowedOrigins = [
  "https://heroic-banoffee-4c3f4f.netlify.app", // Deine Live-Frontend-URL
  "https://doca-webdarts.onrender.com" // Für lokale Entwicklung
];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: allowedOrigins }));
// =================================================================

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

console.log("Datenbankverbindung ist für den Test-Modus deaktiviert.");

const gameManager = new GameManager();

// --- Der Rest der Datei bleibt exakt gleich ---
// --- User authentication routes ---
app.post('/api/auth/login', (req, res) => { const redirectUrl = mockOAuthLogin(); res.json({ redirectUrl }); });
app.post('/api/auth/callback', (req, res) => { try { const user = mockOAuthCallback(req.body.code); const token = generateJWT(user); res.json({ token, user }); } catch (err) { res.status(400).json({ error: err.message }); } });
app.get('/api/auth/me', (req, res) => { const authHeader = req.headers.authorization; if (!authHeader || !authHeader.startsWith('Bearer ')) { return res.status(401).json({ error: 'No token provided' }); } const token = authHeader.split(' ')[1]; const user = verifyJWT(token); if (!user) { return res.status(401).json({ error: 'Invalid token' }); } res.json(user); });
app.post('/api/auth/refresh', (req, res) => { try { const newToken = refreshJWT(req.body.token); res.json({ token: newToken }); } catch (err) { res.status(401).json({ error: err.message }); } });
app.post('/api/auth/logout', (req, res) => { res.json({ message: 'Logout endpoint placeholder' }); });
// --- Dummy Statistik-Endpunkte ---
app.get('/api/stats/:userId', (req, res) => { console.log(`Anfrage für Dummy-Statistiken für User ${req.params.userId}`); res.json({ total_games: 42, wins: 25, losses: 17, match_avg: 75.43, first_9_avg: 88.12, checkout_percentage: 35.5, highest_finish: 156, total_180s: 5, win_rate: 59.52 }); });
app.get('/api/stats/:userId/history', (req, res) => { console.log(`Anfrage für Dummy-Spielverlauf für User ${req.params.userId}`); res.json([ { match_id: 1, played_at: new Date(), game_type: '501', opponent_name: 'Bot_Level_5', result: 'Sieg', player_score: 501, opponent_score: 340, player_avg: 90.1, player_180s: 1 }, { match_id: 2, played_at: new Date(), game_type: '501', opponent_name: 'Player_Two', result: 'Niederlage', player_score: 420, opponent_score: 501, player_avg: 70.5, player_180s: 0 } ]); });
app.get('/api/stats/:userId/achievements', (req, res) => { console.log(`Anfrage für Dummy-Achievements für User ${req.params.userId}`); res.json([ { name: 'First Game', description: 'Played your first game', icon: '🎯' }, { name: 'Winning Streak', description: 'Won 10 games', icon: '🏆' } ]); });
// --- Platzhalter-Routen ---
app.post('/api/rooms', (req, res) => { res.json({ message: 'Create room endpoint placeholder' }); });
app.get('/api/rooms', (req, res) => { res.json({ message: 'List rooms endpoint placeholder' }); });
app.post('/api/rooms/:roomId/join', (req, res) => { res.json({ message: 'Join room endpoint placeholder' }); });
app.post('/api/games', (req, res) => { res.json({ message: 'Start game endpoint placeholder' }); });
app.post('/api/games/:gameId/throw', (req, res) => { res.json({ message: 'Record throw endpoint placeholder' }); });
// --- Socket.io Event Handlers ---
io.on('connection', (socket) => { console.log('User connected:', socket.id); socket.on('sendMessage', (data) => { socket.to(data.roomId).emit('receiveMessage', data); }); socket.on('createRoom', (data) => { const room = gameManager.createRoom(data); socket.join(room.id); socket.emit('roomCreated', room); io.emit('roomsUpdated', gameManager.getRooms()); }); socket.on('joinRoom', (data) => { const result = gameManager.joinRoom(data.roomId, socket.id, data.password); if (result.success) { socket.join(data.roomId); io.to(data.roomId).emit('roomUpdated', gameManager.getRoom(data.roomId)); socket.emit('joinedRoom', result); } else { socket.emit('joinRoomError', result); } }); socket.on('startGame', (data) => { const result = gameManager.startGame(data.roomId, socket.id); if (result.success) { io.to(data.roomId).emit('gameStarted', result.gameState); } else { socket.emit('startGameError', result); } }); socket.on('startActualGame', (data) => { const result = gameManager.startActualGame(data.roomId, socket.id, data.bullOffWinner); if (result.success) { io.to(data.roomId).emit('gameStarted', result.gameState); } else { socket.emit('startGameError', result); } }); socket.on('throwDart', (data) => { const result = gameManager.processThrow(data.roomId, socket.id, data.throw); io.to(data.roomId).emit('throwResult', result); const room = gameManager.getRoom(data.roomId); if (room && room.gameEnded) { io.to(data.roomId).emit('gameEnded', { winner: room.gameWinner, gameState: room.gameState }); } }); socket.on('setCheckoutDarts', (data) => { const result = gameManager.setCheckoutDarts(data.roomId, data.darts); if (result.success) { io.to(data.roomId).emit('checkoutConfirmed', data.darts); } }); socket.on('rematch', (data) => { const result = gameManager.rematch(data.roomId, socket.id); if (result.success) { io.to(data.roomId).emit('rematchStarted', result.players); } else { socket.emit('rematchError', result); } }); socket.on('auth:login', (data) => { const user = verifyJWT(data.token); if (user) { socket.emit('auth:validated', user); } else { socket.emit('auth:error', { message: 'Invalid token' }); } }); socket.on('camera-offer', (data) => { socket.to(data.roomId).emit('camera-offer', data); }); socket.on('camera-answer', (data) => { socket.to(data.roomId).emit('camera-answer', data); }); socket.on('camera-ice', (data) => { socket.to(data.roomId).emit('camera-ice', data); }); socket.on('leaveRoom', (data) => { socket.leave(data.roomId); gameManager.leaveRoom(data.roomId, socket.id); io.to(data.roomId).emit('roomUpdated', gameManager.getRoom(data.roomId)); io.emit('roomsUpdated', gameManager.getRooms()); }); socket.on('disconnect', () => { console.log('User disconnected:', socket.id); if (gameManager && gameManager.roomManager && gameManager.roomManager.rooms) { gameManager.roomManager.rooms.forEach((room, roomId) => { if (room.players.includes(socket.id)) { gameManager.leaveRoom(roomId, socket.id); io.to(roomId).emit('roomUpdated', room); } }); io.emit('roomsUpdated', gameManager.getRooms()); } }); });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io, gameManager };