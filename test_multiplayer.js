const io = require('socket.io-client');

// Erstelle zwei Socket-Clients für zwei Spieler
const socket1 = io('http://localhost:3001');
const socket2 = io('http://localhost:3001');

let roomId;

socket1.on('connect', () => {
    console.log('Socket1 verbunden');

    // Raum erstellen
    socket1.emit('createRoom', {
        roomName: 'Test Room Multiplayer',
        gameMode: 'X01Game',
        gameOptions: { startingScore: 501 }
    });
});

socket1.on('roomCreated', (data) => {
    roomId = data.roomId;
    console.log('Raum erstellt:', roomId);

    // Zweiten Spieler beitreten lassen
    socket2.emit('joinRoom', { roomId, userId: socket2.id });
});

socket2.on('connect', () => {
    console.log('Socket2 verbunden');
});

socket2.on('roomJoined', (data) => {
    console.log('Socket2 beigetreten zum Raum:', data.roomId);

    // Spiel starten
    socket1.emit('start-game', { roomId, userId: socket1.id });

    // Simuliere Würfe: Spieler1 wirft 3, dann Spieler2 wirft 3, usw.
    const throws = [
        { player: socket1, score: 180 },
        { player: socket1, score: 60 },
        { player: socket1, score: 121 },
        { player: socket2, score: 100 },
        { player: socket2, score: 40 },
        { player: socket2, score: 20 },
    ];

    throws.forEach((item, index) => {
        setTimeout(() => {
            item.player.emit('score-input', { roomId, score: item.score, userId: item.player.id });
            console.log(`Wurf ${index + 1} von Spieler${item.player === socket1 ? 1 : 2} gesendet: ${item.score} Punkte`);
        }, 1000 + index * 2000);
    });
});

socket1.on('game-state-update', (room) => {
    console.log('Game State Update von Socket1:');
    console.log('Scores:', room.gameState ? room.gameState.scores : 'No gameState');
    console.log('Current Player:', room.gameState ? room.gameState.currentPlayer : 'N/A');
    if (room.gameState && room.gameState.gameWinner) {
        console.log('Gewinner:', room.gameState.gameWinner);
    }
});

socket2.on('game-state-update', (room) => {
    console.log('Game State Update von Socket2:');
    console.log('Scores:', room.gameState ? room.gameState.scores : 'No gameState');
    console.log('Current Player:', room.gameState ? room.gameState.currentPlayer : 'N/A');
    if (room.gameState && room.gameState.gameWinner) {
        console.log('Gewinner:', room.gameState.gameWinner);
    }
});

socket1.on('disconnect', () => {
    console.log('Socket1 disconnected');
});

socket2.on('disconnect', () => {
    console.log('Socket2 disconnected');
});

// Timeout nach 20 Sekunden
setTimeout(() => {
    console.log('Test beendet');
    socket1.disconnect();
    socket2.disconnect();
}, 20000);