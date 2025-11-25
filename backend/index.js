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
class X01Game {
  constructor(options) {
    this.options = options;
    this.players = [];
    this.scores = {};
    this.currentPlayerIndex = 0;
    this.throwsHistory = [];
    this.statistics = {}; // Per player statistics
    this.checkoutQuery = false;
    this.checkoutPlayer = null;
  }

  initializePlayers(players) {
    this.players = players;
    const startingScore = this.options.startingScore || 501;
    players.forEach(p => {
      this.scores[p.id] = startingScore;
      this.statistics[p.id] = {
        sets: 0,
        legs: 0,
        average: 0,
        doubles: 0,
        highScore: 0,
        oneEighties: 0,
        firstNineDarts: [],
        legsPlayed: [],
        highestFinish: 0,
        tonPlusFinishes: 0,
        scoreDistribution: { '19-': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-99': 0, '100-119': 0, '120-139': 0, '140-159': 0, '160-180': 0, '180+': 0 },
        totalDarts: 0,
        totalScore: 0,
        shortLeg: null,
        checkoutAttempts: 0,
        checkoutSuccesses: 0,
        checkoutDarts: [],
        checkoutPercentage: 0
      };
    });
  }

  getGameState() {
    return {
      players: this.players,
      scores: this.scores,
      currentPlayer: this.currentPlayerIndex,
      gameWinner: this.gameWinner || null,
      throws: this.throwsHistory,
      statistics: this.statistics
    };
  }

  processThrow(userId, throwData) {
    if (this.players[this.currentPlayerIndex].id !== userId) return { valid: false, reason: 'Not your turn' };

    // If checkout query active, don't allow throws until selection
    if (this.checkoutQuery) return { valid: false, reason: 'Checkout selection required' };

    const darts = throwData.darts || []; // Array of {score: number, multiplier: 1|2|3}
    let totalScore = 0;
    let validThrow = true;

    darts.forEach(dart => {
      if (dart.score && dart.multiplier) {
        totalScore += dart.score * dart.multiplier;
      } else {
        validThrow = false;
      }
    });

    if (!validThrow || darts.length !== 3) return { valid: false, reason: 'Invalid throw data' };

    const playerStats = this.statistics[userId];
    playerStats.totalDarts += 3;
    playerStats.totalScore += totalScore;

    // First 9 darts average
    if (playerStats.firstNineDarts.length < 9) {
      playerStats.firstNineDarts.push(totalScore);
    }

    // High score (turn score)
    if (totalScore > playerStats.highScore) {
      playerStats.highScore = totalScore;
    }

    // 180s
    if (totalScore === 180) {
      playerStats.oneEighties++;
    }

    // Score distribution
    if (totalScore < 20) playerStats.scoreDistribution['19-']++;
    else if (totalScore < 40) playerStats.scoreDistribution['20-39']++;
    else if (totalScore < 60) playerStats.scoreDistribution['40-59']++;
    else if (totalScore < 80) playerStats.scoreDistribution['60-79']++;
    else if (totalScore < 100) playerStats.scoreDistribution['80-99']++;
    else if (totalScore < 120) playerStats.scoreDistribution['100-119']++;
    else if (totalScore < 140) playerStats.scoreDistribution['120-139']++;
    else if (totalScore < 160) playerStats.scoreDistribution['140-159']++;
    else if (totalScore < 180) playerStats.scoreDistribution['160-180']++;
    else playerStats.scoreDistribution['180+']++;

    // Update average
    playerStats.average = playerStats.totalScore / (playerStats.totalDarts / 3);

    this.scores[userId] -= totalScore;
    this.throwsHistory.push({ userId, darts, totalScore, timestamp: Date.now() });

    if (this.scores[userId] <= 0) {
      // Check if double out
      // Assume for simplicity, but actually need to check last dart is double
      // For now, assume valid finish
      this.gameWinner = userId;
      // Highest finish
      if (totalScore > playerStats.highestFinish) {
        playerStats.highestFinish = totalScore;
      }
      // Ton+ finishes
      if (totalScore >= 100) {
        playerStats.tonPlusFinishes++;
      }
      // Legs
      playerStats.legs++;
      // Checkout success if they finished
      if (this.checkoutPlayer === userId) {
        playerStats.checkoutSuccesses++;
        playerStats.checkoutPercentage = playerStats.checkoutAttempts > 0 ? (playerStats.checkoutSuccesses / playerStats.checkoutAttempts) * 100 : 0;
      }
      // Short leg: track leg durations, but for now, simplify
      // Assume each leg is one turn for simplicity, but actually need to track per leg
    } else if (this.scores[userId] <= 170) { // Checkout range (typically <= 170)
      // Trigger checkout query
      this.checkoutQuery = true;
      this.checkoutPlayer = userId;
    } else {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }
    return { valid: true };
  }

  selectCheckoutDarts(userId, dartCount) {
    if (!this.checkoutQuery || this.checkoutPlayer !== userId) return { success: false, reason: 'No checkout query active or not your turn' };
    if (dartCount < 1 || dartCount > 3) return { success: false, reason: 'Invalid dart count' };

    const playerStats = this.statistics[userId];
    playerStats.checkoutAttempts++;
    playerStats.checkoutDarts.push(dartCount);
    playerStats.checkoutPercentage = playerStats.checkoutAttempts > 0 ? (playerStats.checkoutSuccesses / playerStats.checkoutAttempts) * 100 : 0;

    this.checkoutQuery = false;
    this.checkoutPlayer = null;

    // If they selected 1-3 darts and finish with that, count as success later in finish logic
    // For now, just proceed to next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

    return { success: true };
  }

  undoLastThrow(userId) {
    const lastThrow = this.throwsHistory[this.throwsHistory.length - 1];
    if (!lastThrow || lastThrow.userId !== userId || Date.now() - lastThrow.timestamp > 5000) return { success: false, reason: 'Cannot undo' };
    this.scores[userId] += lastThrow.totalScore;
    // Remove from stats
    const playerStats = this.statistics[userId];
    playerStats.totalDarts -= 3;
    playerStats.totalScore -= lastThrow.totalScore;
    playerStats.average = playerStats.totalDarts > 0 ? playerStats.totalScore / (playerStats.totalDarts / 3) : 0;
    // Remove from first nine if applicable
    if (playerStats.firstNineDarts.length > 0 && playerStats.firstNineDarts[playerStats.firstNineDarts.length - 1] === lastThrow.totalScore) {
      playerStats.firstNineDarts.pop();
    }
    this.throwsHistory.pop();
    this.currentPlayerIndex = (this.currentPlayerIndex - 1 + this.players.length) % this.players.length;
    this.gameWinner = null;
    return { success: true };
  }
}
class CricketGame {
  constructor(options) {
    this.options = options;
    this.players = [];
    this.scores = {};
    this.currentPlayerIndex = 0;
    this.throwsHistory = [];
    this.statistics = {};
  }

  initializePlayers(players) {
    this.players = players;
    players.forEach(p => {
      this.scores[p.id] = { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 };
      this.statistics[p.id] = {
        sets: 0, legs: 0, average: 0, doubles: 0, highScore: 0, oneEighties: 0,
        firstNineDarts: [], legsPlayed: [], highestFinish: 0, tonPlusFinishes: 0,
        scoreDistribution: { '19-': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80-99': 0, '100-119': 0, '120-139': 0, '140-159': 0, '160-180': 0, '180+': 0 },
        totalDarts: 0, totalScore: 0, shortLeg: null
      };
    });
  }

  getGameState() {
    return { players: this.players, scores: this.scores, currentPlayer: this.currentPlayerIndex, gameWinner: this.gameWinner || null, throws: this.throwsHistory, statistics: this.statistics };
  }

  processThrow(userId, throwData) {
    if (this.players[this.currentPlayerIndex].id !== userId) return { valid: false, reason: 'Not your turn' };
    const darts = throwData.darts || [];
    let totalScore = 0;
    darts.forEach(dart => totalScore += dart.score * dart.multiplier);
    const playerStats = this.statistics[userId];
    playerStats.totalDarts += 3;
    playerStats.totalScore += totalScore;
    playerStats.average = playerStats.totalScore / (playerStats.totalDarts / 3);
    if (playerStats.firstNineDarts.length < 9) playerStats.firstNineDarts.push(totalScore);
    if (totalScore > playerStats.highScore) playerStats.highScore = totalScore;
    if (totalScore === 180) playerStats.oneEighties++;
    if (totalScore < 20) playerStats.scoreDistribution['19-']++;
    else if (totalScore < 40) playerStats.scoreDistribution['20-39']++;
    else if (totalScore < 60) playerStats.scoreDistribution['40-59']++;
    else if (totalScore < 80) playerStats.scoreDistribution['60-79']++;
    else if (totalScore < 100) playerStats.scoreDistribution['80-99']++;
    else if (totalScore < 120) playerStats.scoreDistribution['100-119']++;
    else if (totalScore < 140) playerStats.scoreDistribution['120-139']++;
    else if (totalScore < 160) playerStats.scoreDistribution['140-159']++;
    else if (totalScore < 180) playerStats.scoreDistribution['160-180']++;
    else playerStats.scoreDistribution['180+']++;
    this.throwsHistory.push({ userId, darts, totalScore, timestamp: Date.now() });
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    return { valid: true };
  }

  undoLastThrow(userId) {
    const lastThrow = this.throwsHistory[this.throwsHistory.length - 1];
    if (!lastThrow || lastThrow.userId !== userId || Date.now() - lastThrow.timestamp > 5000) return { success: false, reason: 'Cannot undo' };
    const playerStats = this.statistics[userId];
    playerStats.totalDarts -= 3;
    playerStats.totalScore -= lastThrow.totalScore;
    playerStats.average = playerStats.totalDarts > 0 ? playerStats.totalScore / (playerStats.totalDarts / 3) : 0;
    if (playerStats.firstNineDarts.length > 0 && playerStats.firstNineDarts[playerStats.firstNineDarts.length - 1] === lastThrow.totalScore) {
      playerStats.firstNineDarts.pop();
    }
    this.throwsHistory.pop();
    this.currentPlayerIndex = (this.currentPlayerIndex - 1 + this.players.length) % this.players.length;
    this.gameWinner = null;
    return { success: true };
  }
}
class BullOffGame {
  constructor() {
    this.players = [];
    this.currentPlayerIndex = 0;
    this.throws = []; // Array of { playerId, score, timestamp }
    this.winner = null;
  }

  initializePlayers(players) {
    this.players = players;
  }

  getGameState() {
    return {
      players: this.players,
      currentPlayer: this.currentPlayerIndex,
      throws: this.throws,
      winner: this.winner,
      isBullOffActive: true,
      bullOffWinner: this.winner
    };
  }

  processThrow(userId, score) {
    if (this.winner) return { valid: false, reason: 'Bull-off already won' };
    if (this.players[this.currentPlayerIndex].id !== userId) return { valid: false, reason: 'Not your turn' };
    if (score !== 25 && score !== 50) return { valid: false, reason: 'Only 25 or 50 allowed for bull-off' };

    this.throws.push({ playerId: userId, score, timestamp: Date.now() });

    if (score === 25 || score === 50) {
      this.winner = userId;
    } else {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    return { valid: true };
  }
}

const app = express();
const server = http.createServer(app);

// =================================================================
// FINALE KORREKTUR: CORS-Einstellungen
// =================================================================
const allowedOrigins = [
  "https://heroic-banoffee-4c3f4f.netlify.app", // Deine Live-Frontend-URL
  "https://doca-webdarts.onrender.com", // Für lokale Entwicklung
  "https://doca-webdarts-1.onrender.com", // Frontend deployed URL
  "https://projekt.doca.at" // Production frontend URL
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

const { GameManager } = require('./gameModes');
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
   socket.on('createRoom', (data) => {
     console.log('createRoom event received from socket:', socket.id, 'with data:', JSON.stringify(data));
     try {
       const room = gameManager.createRoom(data);
       console.log('Room created:', room.id);
       // Automatically add the creator to the room
       const joinResult = gameManager.joinRoom(room.id, socket.id);
       console.log('Join result for creator:', joinResult);
       if (!joinResult.success) {
         console.error('Failed to auto-join room creator:', joinResult.message);
         socket.emit('roomCreationError', { message: 'Failed to join created room' });
         return;
       }
       socket.join(room.id);
       socket.emit('roomCreated', room);
       socket.emit('joinedRoom', joinResult); // Emit joinedRoom for auto-navigation
       io.emit('roomsUpdated', gameManager.getRooms());
       console.log('Room creation completed successfully for room:', room.id);
     } catch (error) {
       console.error('Error creating room:', error);
       socket.emit('roomCreationError', { message: 'Failed to create room' });
     }
   });
io.on('connection', (socket) => { console.log('User connected:', socket.id); socket.on('sendMessage', (data) => { console.log('DEBUG Backend: Received sendMessage from socket', socket.id, 'with data:', JSON.stringify(data)); if (data.roomId) { socket.to(data.roomId).emit('receiveMessage', data); console.log('DEBUG Backend: Emitted receiveMessage to room', data.roomId, 'excluding sender'); } else { socket.broadcast.emit('receiveMessage', data); console.log('DEBUG Backend: Emitted receiveMessage to all clients except sender (lobby chat)'); } }); socket.on('createRoom', (data) => { const room = gameManager.createRoom(data); socket.join(room.id); socket.emit('roomCreated', room); io.emit('roomsUpdated', gameManager.getRooms()); }); socket.on('joinRoom', (data) => { const result = gameManager.joinRoom(data.roomId, socket.id, data.password); if (result.success) { socket.join(data.roomId); io.to(data.roomId).emit('roomUpdated', gameManager.getRoom(data.roomId)); socket.emit('joinedRoom', result); } else { socket.emit('joinRoomError', result); } }); socket.on('startGame', (data) => { const result = gameManager.startGame(data.roomId, socket.id); if (result.success) { io.to(data.roomId).emit('gameStarted', result.gameState); } else { socket.emit('startGameError', result); } }); socket.on('startActualGame', (data) => { const result = gameManager.startActualGame(data.roomId, socket.id, data.bullOffWinner); if (result.success) { io.to(data.roomId).emit('gameStarted', result.gameState); } else { socket.emit('startGameError', result); } }); socket.on('throwDart', (data) => { const result = gameManager.processThrow(data.roomId, socket.id, data.throw); io.to(data.roomId).emit('throwResult', result); const room = gameManager.getRoom(data.roomId); if (room && room.gameEnded) { io.to(data.roomId).emit('gameEnded', { winner: room.gameWinner, gameState: room.gameState }); } }); socket.on('setCheckoutDarts', (data) => { const result = gameManager.setCheckoutDarts(data.roomId, data.darts); if (result.success) { io.to(data.roomId).emit('checkoutConfirmed', data.darts); } }); socket.on('rematch', (data) => { const result = gameManager.rematch(data.roomId, socket.id); if (result.success) { io.to(data.roomId).emit('rematchStarted', result.players); } else { socket.emit('rematchError', result); } }); socket.on('auth:login', (data) => { const user = verifyJWT(data.token); if (user) { socket.emit('auth:validated', user); } else { socket.emit('auth:error', { message: 'Invalid token' }); } }); socket.on('camera-offer', (data) => { socket.to(data.roomId).emit('camera-offer', data); }); socket.on('camera-answer', (data) => { socket.to(data.roomId).emit('camera-answer', data); }); socket.on('camera-ice', (data) => { socket.to(data.roomId).emit('camera-ice', data); }); socket.on('leaveRoom', (data) => { socket.leave(data.roomId); gameManager.leaveRoom(data.roomId, socket.id); io.to(data.roomId).emit('roomUpdated', gameManager.getRoom(data.roomId)); io.emit('roomsUpdated', gameManager.getRooms()); }); socket.on('disconnect', () => { console.log('User disconnected:', socket.id); if (gameManager && gameManager.roomManager && gameManager.roomManager.rooms) { gameManager.roomManager.rooms.forEach((room, roomId) => { if (room.players.includes(socket.id)) { gameManager.leaveRoom(roomId, socket.id); io.to(roomId).emit('roomUpdated', room); } }); io.emit('roomsUpdated', gameManager.getRooms()); } }); });
  socket.on('createRoom', (data) => {
    console.log('createRoom event received from socket:', socket.id, 'with data:', JSON.stringify(data));
    try {
      const room = gameManager.createRoom(data);
      console.log('Room created:', room.id);
      // Automatically add the creator to the room
      const joinResult = gameManager.joinRoom(room.id, socket.id);
      console.log('Join result for creator:', joinResult);
      if (!joinResult.success) {
        console.error('Failed to auto-join room creator:', joinResult.message);
        socket.emit('roomCreationError', { message: 'Failed to join created room' });
        return;
      }
      socket.join(room.id);
      socket.emit('roomCreated', room);
      socket.emit('joinedRoom', joinResult); // Emit joinedRoom for auto-navigation
      io.emit('roomsUpdated', gameManager.getRooms());
      console.log('Room creation completed successfully for room:', room.id);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('roomCreationError', { message: 'Failed to create room' });
    }
  });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io, gameManager };