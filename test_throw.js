const io = require('socket.io-client');

// Verbinde mit dem Backend
const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('Verbunden mit Backend');

    // Raum erstellen
    socket.emit('createRoom', {
        roomName: 'Test Room',
        gameMode: 'X01Game',
        gameOptions: { startingScore: 501 }
    });
});

socket.on('roomCreated', (data) => {
    const roomId = data.roomId;
    console.log('Raum erstellt:', roomId);

    // Spiel starten
    socket.emit('start-game', { roomId, userId: socket.id });

    // Mehrere Würfe simulieren
    const throws = [180, 60, 121, 100, 40]; // Beispiel Würfe
    throws.forEach((score, index) => {
        setTimeout(() => {
            socket.emit('score-input', { roomId, score, userId: socket.id });
            console.log(`Wurf ${index + 1} gesendet: ${score} Punkte`);
        }, 1000 + index * 2000); // 1s Wartezeit, dann jede 2s ein Wurf
    });
});

socket.on('game-state-update', (room) => {
    console.log('Game State Update erhalten:');
    console.log('Scores:', room.gameState ? room.gameState.scores : 'No gameState');
    if (room.gameState && room.gameState.gameWinner) {
        console.log('Gewinner:', room.gameState.gameWinner);
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected');
    process.exit(0);
});

// Timeout nach 10 Sekunden
setTimeout(() => {
    console.log('Test beendet');
    socket.disconnect();
}, 10000);