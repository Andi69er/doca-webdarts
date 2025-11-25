// backend/gameModes.js

const gameModes = {
    '501': {
        name: '501',
        startScore: 501,
        description: 'Standard 501, Double-Out.',
        rules: {
            doubleOut: true,
        }
    },
    '301': {
        name: '301',
        startScore: 301,
        description: 'Standard 301, Double-Out.',
        rules: {
            doubleOut: true,
        }
    },
    'Cricket': {
        name: 'Cricket',
        startScore: 0,
        description: 'Cricket - Ziele 20 bis 15 und Bull schließen.',
        rules: {}
    }
};

class GameManager {
    constructor(gameMode) {
        if (!gameModes[gameMode]) {
            throw new Error('Invalid game mode selected');
        }
        this.gameMode = gameModes[gameMode];
        this.scores = {};
        this.currentPlayerIndex = 0;
    }

    updateScore(playerId, score) {
        console.log(`Updating score for ${playerId} in ${this.gameMode.name}`);
    }
}

// NEU & KORREKT: Exportiere ein Objekt, das beides enthält
module.exports = {
  gameModes,
  GameManager
};