const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

const initializeSocket = require('./socketHandler');
const { generateJWT, verifyJWT, mockOAuthLogin, mockOAuthCallback, refreshJWT } = require('./auth');

dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: [
        'https://heroic-banoffee-4c3f4f.netlify.app',
        'https://doca-webdarts.onrender.com',
        'https://doca-webdarts-1.onrender.com',
        'http://localhost:3000',
        'http://localhost:3002'
    ],
    methods: ['GET', 'POST']
};
app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

console.log('Datenbankverbindung ist für den Test-Modus deaktiviert.');

app.post('/api/auth/login', (req, res) => { const redirectUrl = mockOAuthLogin(); res.json({ redirectUrl }); });
app.post('/api/auth/callback', (req, res) => { try { const user = mockOAuthCallback(req.body.code); const token = generateJWT(user); res.json({ token, user }); } catch (err) { res.status(400).json({ error: err.message }); } });
app.get('/api/auth/me', (req, res) => { const authHeader = req.headers.authorization; if (!authHeader || !authHeader.startsWith('Bearer ')) { return res.status(401).json({ error: 'No token provided' }); } const token = authHeader.split(' ')[1]; const user = verifyJWT(token); if (!user) { return res.status(401).json({ error: 'Invalid token' }); } res.json(user); });
app.post('/api/auth/refresh', (req, res) => { try { const newToken = refreshJWT(req.body.token); res.json({ token: newToken }); } catch (err) { res.status(401).json({ error: err.message }); } });
app.post('/api/auth/logout', (req, res) => { res.json({ message: 'Logout endpoint placeholder' }); });
app.get('/api/stats/:userId', (req, res) => { console.log(`Anfrage für Dummy-Statistiken für User ${req.params.userId}`); res.json({ total_games: 42, wins: 25, losses: 17, match_avg: 75.43, first_9_avg: 88.12, checkout_percentage: 35.5, highest_finish: 156, total_180s: 5, win_rate: 59.52 }); });
app.get('/api/stats/:userId/history', (req, res) => { console.log(`Anfrage für Dummy-Spielverlauf für User ${req.params.userId}`); res.json([{ match_id: 1, played_at: new Date(), game_type: '501', opponent_name: 'Bot_Level_5', result: 'Sieg', player_score: 501, opponent_score: 340, player_avg: 90.1, player_180s: 1 }, { match_id: 2, played_at: new Date(), game_type: '501', opponent_name: 'Player_Two', result: 'Niederlage', player_score: 420, opponent_score: 501, player_avg: 70.5, player_180s: 0 }]); });
app.get('/api/stats/:userId/achievements', (req, res) => { console.log(`Anfrage für Dummy-Achievements für User ${req.params.userId}`); res.json([{ name: 'First Game', description: 'Played your first game', icon: '🎯' }, { name: 'Winning Streak', description: 'Won 10 games', icon: '🏆' }]); });
app.post('/api/rooms', (req, res) => { res.json({ message: 'Create room endpoint placeholder' }); });
app.get('/api/rooms', (req, res) => { res.json({ message: 'List rooms endpoint placeholder' }); });
app.post('/api/rooms/:roomId/join', (req, res) => { res.json({ message: 'Join room endpoint placeholder' }); });
app.post('/api/games', (req, res) => { res.json({ message: 'Start game endpoint placeholder' }); });
app.post('/api/games/:gameId/throw', (req, res) => { res.json({ message: 'Record throw endpoint placeholder' }); });

app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));
app.get('/:path(*)', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
});

const io = new Server(server, {
    cors: corsOptions
});
initializeSocket(io, null, { generateJWT, verifyJWT });

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const keepAliveUrl = process.env.KEEPALIVE_URL || 'https://doca-webdarts.onrender.com';
const keepAliveIntervalMs = parseInt(process.env.KEEPALIVE_INTERVAL_MS || '840000', 10);
const keepAliveEnabled = process.env.DISABLE_KEEPALIVE !== 'true';

if (keepAliveEnabled && keepAliveUrl && Number.isFinite(keepAliveIntervalMs) && keepAliveIntervalMs > 0) {
    setInterval(async () => {
        try {
            await axios.get(`${keepAliveUrl}/healthz`, { timeout: 5000 });
            console.log('[KeepAlive] Ping erfolgreich');
        } catch (error) {
            console.warn('[KeepAlive] Ping fehlgeschlagen:', error.message);
        }
    }, keepAliveIntervalMs);
}

module.exports = { app, server, io, generateJWT, verifyJWT, mockOAuthLogin, mockOAuthCallback, refreshJWT };
