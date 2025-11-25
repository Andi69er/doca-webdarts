// backend/gameModes.js

const gameModes = {
    'X01': {
        name: 'X01',
        description: 'Spiele wie die Profis. Wähle deinen Start-Score.',
        options: {
            startScore: [301, 401, 501, 601, 701, 801, 901, 1001],
            sets: [0, 1, 2, 3, 4, 5],
            legs: [1, 2, 3, 4, 5],
            outMode: ['Double Out', 'Single Out', 'Master Out'],
            inMode: ['Single In', 'Double In'],
            winType: ['First to', 'Best of'],
            whoStarts: ['Player', 'Opponent', 'Random']
        }
    },
    'Cricket': {
        name: 'Cricket',
        description: 'Schließe die Zahlen von 20 bis 15 und das Bullseye.',
        options: {
            // Cricket hat weniger anpassbare Optionen
        }
    }
    // Füge hier bei Bedarf weitere Haupt-Spielmodi hinzu
};

// Diese GameManager-Klasse bleibt als Vorlage für die Zukunft, wird aber beim Start nicht mehr aufgerufen.
class GameManager {
    constructor(gameMode) {
        if (!gameModes[gameMode]) {
            throw new Error(`Invalid game mode selected: ${gameMode}`);
        }
        this.gameMode = gameModes[gameMode];
        this.scores = {};
        this.currentPlayerIndex = 0;
    }

    updateScore(playerId, score) {
        console.log(`Updating score for ${playerId} in ${this.gameMode.name}`);
    }
}

module.exports = {
  gameModes,
  GameManager
};