const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

console.log(`Verbinde mit Server auf ${SERVER_URL}...`);

const player1 = { name: 'Player 1', socket: io(SERVER_URL), score: 501 };
const player2 = { name: 'Player 2', socket: io(SERVER_URL), score: 501 };

let roomId;
let activePlayerSocket = null;

player1.socket.on('connect', () => {
    console.log(`${player1.name} (${player1.socket.id}) verbunden.`);

    // Raum erstellen
    console.log(`${player1.name} erstellt einen Raum...`);
    player1.socket.emit('createRoom', {
        roomName: 'Test Room Multiplayer',
        gameMode: 'x01',
        gameOptions: { startingScore: 501 }
    });
});

player1.socket.on('roomCreated', (data) => {
    roomId = data.roomId;
    console.log(`Raum ${roomId} von ${player1.name} erstellt.`);

    // Zweiten Spieler beitreten lassen
    console.log(`${player2.name} tritt dem Raum bei...`);
    player2.socket.emit('joinRoom', { roomId });
});

player2.socket.on('connect', () => {
    console.log(`${player2.name} (${player2.socket.id}) verbunden.`);
});

player2.socket.on('roomJoined', (data) => {
    console.log(`${player2.name} ist Raum ${data.roomId} beigetreten.`);

    // Spiel starten
    console.log(`${player1.name} startet das Spiel...`);
    player1.socket.emit('start-game', { roomId, userId: player1.socket.id });
});

const handleGameStateUpdate = (gameState) => {
    console.log('\n--- GAME STATE UPDATE ---');
    if (!gameState || !gameState.players) {
        console.log("Warte auf Spieler...");
        return;
    }

    const p1 = gameState.players.find(p => p.id === player1.socket.id);
    const p2 = gameState.players.find(p => p.id === player2.socket.id);
    
    console.log(`Scores: ${p1?.name}: ${p1?.score} | ${p2?.name}: ${p2?.score}`);

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    console.log(`Am Zug: ${currentPlayer.name} (${currentPlayer.id})`);

    if (gameState.winner) {
        console.log(`\n🎉 GEWINNER: ${currentPlayer.name} 🎉`);
        player1.socket.disconnect();
        player2.socket.disconnect();
        return;
    }

    // Simuliere einen Wurf vom aktiven Spieler
    if (currentPlayer.id === player1.socket.id) {
        const score = Math.min(p1.score, Math.floor(Math.random() * 180));
        console.log(`>>> ${player1.name} wirft ${score}`);
        player1.socket.emit('score-input', { roomId, score, userId: player1.socket.id });
    } else if (currentPlayer.id === player2.socket.id) {
        const score = Math.min(p2.score, Math.floor(Math.random() * 180));
        console.log(`>>> ${player2.name} wirft ${score}`);
        player2.socket.emit('score-input', { roomId, score, userId: player2.socket.id });
    }
};

player1.socket.on('game-started', (gs) => setTimeout(() => handleGameStateUpdate(gs), 1000));
player1.socket.on('game-state-update', (gs) => setTimeout(() => handleGameStateUpdate(gs), 1000));
player2.socket.on('game-state-update', (gs) => {}); // Player 2 reagiert nicht, nur Player 1 steuert den Test