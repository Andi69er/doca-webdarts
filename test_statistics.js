const io = require('socket.io-client');

// Verbinde mit dem Backend
const socket = io('http://localhost:3001');

let roomId;
let playerStats = {};

socket.on('connect', () => {
    console.log('Verbunden mit Backend');

    // Raum erstellen
    socket.emit('createRoom', {
        roomName: 'Statistics Test Room',
        gameMode: 'X01Game',
        gameOptions: { startingScore: 501 }
    });
});

socket.on('roomCreated', (data) => {
    roomId = data.roomId;
    console.log('Raum erstellt:', roomId);

    // Spiel starten
    socket.emit('start-game', { roomId, userId: socket.id });
});

socket.on('game-started', (gameState) => {
    console.log('Spiel gestartet');
    playerStats = gameState.players[0]; // Initial stats
    console.log('Initiale Statistiken:', {
        scores60plus: playerStats.scores60plus || 0,
        scores100plus: playerStats.scores100plus || 0,
        scores140plus: playerStats.scores140plus || 0,
        scores180: playerStats.scores180 || 0,
        doublesHit: playerStats.doublesHit || 0,
        finishes: playerStats.finishes || 0
    });

    // Testwürfe: verschiedene Bereiche testen
    const testThrows = [
        { score: 40, expected: { scores60plus: 0, scores100plus: 0, scores140plus: 0, scores180: 0 } }, // Unter 60
        { score: 60, expected: { scores60plus: 1, scores100plus: 0, scores140plus: 0, scores180: 0 } }, // Genau 60
        { score: 100, expected: { scores60plus: 2, scores100plus: 1, scores140plus: 0, scores180: 0 } }, // 100
        { score: 121, expected: { scores60plus: 3, scores100plus: 2, scores140plus: 0, scores180: 0 } }, // 121
        { score: 140, expected: { scores60plus: 4, scores100plus: 3, scores140plus: 1, scores180: 0 } }, // 140
        { score: 160, expected: { scores60plus: 5, scores100plus: 4, scores140plus: 2, scores180: 0 } }, // 160
        { score: 180, expected: { scores60plus: 5, scores100plus: 4, scores140plus: 2, scores180: 1 } }, // Genau 180 - sollte NICHT 60+/100+/140+ erhöhen
        { score: 60, expected: { scores60plus: 6, scores100plus: 4, scores140plus: 2, scores180: 1 } }, // Wieder 60 - sollte 60+ erhöhen
        { score: 179, expected: { scores60plus: 7, scores100plus: 5, scores140plus: 3, scores180: 1 } }, // 179 - sollte alle erhöhen
        { score: 180, expected: { scores60plus: 7, scores100plus: 5, scores140plus: 3, scores180: 2 } }, // Zweiter 180 - sollte NICHT andere erhöhen
        { score: 3, expected: { scores60plus: 7, scores100plus: 5, scores140plus: 3, scores180: 2, doublesHit: 1, finishes: 1 } } // Finish (Doppel-Finish angenommen)
    ];

    let throwIndex = 0;
    const sendNextThrow = () => {
        if (throwIndex < testThrows.length) {
            const throwData = testThrows[throwIndex];
            socket.emit('score-input', { roomId, score: throwData.score, userId: socket.id });
            console.log(`\n--- Wurf ${throwIndex + 1}: ${throwData.score} Punkte ---`);
            throwIndex++;
        } else {
            console.log('\n=== Test abgeschlossen ===');
            socket.disconnect();
        }
    };

    // Ersten Wurf senden
    setTimeout(sendNextThrow, 1000);

    // Nach jedem Update nächsten Wurf senden
    socket.on('game-state-update', (updateData) => {
        const currentPlayer = updateData.players.find(p => p.id === socket.id);
        if (currentPlayer) {
            const currentStats = {
                scores60plus: currentPlayer.scores60plus || 0,
                scores100plus: currentPlayer.scores100plus || 0,
                scores140plus: currentPlayer.scores140plus || 0,
                scores180: currentPlayer.scores180 || 0,
                doublesHit: currentPlayer.doublesHit || 0,
                finishes: currentPlayer.finishes || 0
            };

            const expected = testThrows[throwIndex - 1]?.expected;
            if (expected) {
                console.log('Aktuelle Statistiken:', currentStats);
                console.log('Erwartet:', expected);

                const passed = (
                    currentStats.scores60plus === expected.scores60plus &&
                    currentStats.scores100plus === expected.scores100plus &&
                    currentStats.scores140plus === expected.scores140plus &&
                    currentStats.scores180 === expected.scores180 &&
                    (expected.doublesHit === undefined || currentStats.doublesHit === expected.doublesHit) &&
                    (expected.finishes === undefined || currentStats.finishes === expected.finishes)
                );

                if (passed) {
                    console.log('✅ Test bestanden');
                } else {
                    console.log('❌ Test fehlgeschlagen!');
                    console.log('Unterschiede:');
                    if (currentStats.scores60plus !== expected.scores60plus) {
                        console.log(`  60+: ${currentStats.scores60plus} (erwartet: ${expected.scores60plus})`);
                    }
                    if (currentStats.scores100plus !== expected.scores100plus) {
                        console.log(`  100+: ${currentStats.scores100plus} (erwartet: ${expected.scores100plus})`);
                    }
                    if (currentStats.scores140plus !== expected.scores140plus) {
                        console.log(`  140+: ${currentStats.scores140plus} (erwartet: ${expected.scores140plus})`);
                    }
                    if (currentStats.scores180 !== expected.scores180) {
                        console.log(`  180: ${currentStats.scores180} (erwartet: ${expected.scores180})`);
                    }
                }
            }

            // Nächsten Wurf senden nach kurzer Verzögerung
            setTimeout(sendNextThrow, 500);
        }
    });
});

socket.on('disconnect', () => {
    console.log('Disconnected');
    process.exit(0);
});

// Timeout nach 30 Sekunden
setTimeout(() => {
    console.log('Test-Timeout erreicht');
    socket.disconnect();
}, 30000);
