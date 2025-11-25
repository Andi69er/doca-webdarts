// backend/gameModes.js

const gameModes = {
    'X01': {
        name: 'X01',
        description: 'Spiele wie die Profis. Wähle deinen Start-Score.',
        // WICHTIG: Hier muss der Start-Score direkt verfügbar sein
        startScore: 501, // oder ein anderer Standardwert
        options: {
            startScore: [501, 301, 701, 1001],
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
        startScore: 0, // Wichtig für die Kompatibilität
        description: 'Schließe die Zahlen von 20 bis 15 und das Bullseye.',
        options: {}
    }
};

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