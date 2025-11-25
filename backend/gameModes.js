// backend/gameModes.js

const gameModes = {
    '501': {
        name: '501',
        startScore: 501,
        description: 'Standard 501, Double-Out.',
        rules: {
            doubleOut: true,
            // Weitere Regeln hier
        }
    },
    '301': {
        name: '301',
        startScore: 301,
        description: 'Standard 301, Double-Out.',
        rules: {
            doubleOut: true,
            // Weitere Regeln hier
        }
    },
    'Cricket': {
        name: 'Cricket',
        startScore: 0, // Cricket zählt anders
        description: 'Cricket - Ziele 20 bis 15 und Bull schließen.',
        rules: {
            // Cricket-spezifische Regeln
        }
    }
};

// GameManager-Klasse (Beispielhaft, falls hier der Fehler lag)
class GameManager {
    constructor(gameMode) {
        if (!gameModes[gameMode]) {
            throw new Error('Invalid game mode selected');
        }
        this.gameMode = gameModes[gameMode];
        this.scores = {};
        this.currentPlayerIndex = 0;
    }

    // Beispielmethode
    updateScore(playerId, score) {
        // Logik zur Punkteverarbeitung
        console.log(`Updating score for ${playerId} in ${this.gameMode.name}`);
    }
}

// Wichtig: Beide exportieren
module.exports = gameModes;

// Hinweis: Wenn GameManager in einer eigenen Datei war, ist dieser Teil überflüssig,
// aber zur Sicherheit fügen wir hier eine saubere Version ein.
// Wenn der Fehler weiterhin besteht, müssen wir den GameManager-Aufruf in der server.js prüfen.
// Fürs Erste ist dies der sicherste Fix.