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
};

class X01Game {
  constructor(options = {}) {
    this.startingScore = options.startingScore || 501;
    this.inMode = options.inMode || 'single'; // 'single', 'double', 'master'
    this.outMode = options.outMode || 'double'; // 'single', 'double', 'master'
    this.distance = options.distance || 'leg'; // 'leg', 'set'
    this.length = options.length || { type: 'firstTo', value: 1 }; // { type: 'firstTo'|'bestOf', value: number }
    this.scores = {}; // playerId -> remaining score
    this.turns = {}; // playerId -> array of turn scores
    this.currentPlayerIndex = 0;
    this.players = [];
    this.dartsThrownInTurn = 0;
    this.legsWon = {}; // playerId -> legs won
    this.setsWon = {}; // if distance is set
    this.currentLeg = 1;
    this.currentSet = 1;
    this.gameWinner = null;
    this.checkoutDarts = null; // to be set after win
  }

  initializePlayers(players) {
    this.players = players;
    players.forEach(player => {
      this.scores[player.id] = this.startingScore;
      this.turns[player.id] = [];
      this.legsWon[player.id] = 0;
      this.setsWon[player.id] = 0;
    });
  }

  validateThrow(throwData) {
    const score = throwData;
    const remaining = this.scores[this.players[this.currentPlayerIndex].id];
    // Basic validation, can be expanded
    if (score < 0 || score > 180) return false;
    
    const newScore = remaining - score;

    if (newScore < 0) return false; // Busted
    if (newScore === 1) return false; // Busted (cannot leave 1)

    if (this.outMode === 'double' && newScore === 0) {
        // This is tricky without knowing the exact darts.
        // We'll accept the checkout and assume the client validated it.
        // A more robust solution would require detailed throw data (e.g., {value: 20, multiplier: 2})
        return true;
    }
    
    return true;
  }

  processThrow(playerId, throwData) {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (playerId !== currentPlayer.id) return { valid: false, reason: 'Not your turn' };
    if (this.dartsThrownInTurn >= 3) return { valid: false, reason: 'Turn over' };

    const score = throwData; // Assuming throwData is just the score for now

    if (!this.validateThrow(score)) {
      // On invalid throw (bust), the turn ends, and score reverts.
      console.log(`Player ${playerId} busted.`);
      this.nextTurn();
      return { valid: false, reason: 'Bust', remaining: this.scores[playerId], dartsThrown: this.dartsThrownInTurn };
    }
    
    this.scores[playerId] -= score;
    
    // This is a simplified turn history
    if(!this.turns[playerId]) this.turns[playerId] = [];
    this.turns[playerId].push(score);

    this.dartsThrownInTurn++;

    if (this.scores[playerId] === 0) {
      // Player won the leg
      console.log(`Player ${playerId} won the leg.`);
      this.gameWinner = playerId; // Simplified win condition for now
      // In a real game, you'd check set/leg win conditions here
      this.nextTurn(); // Still need to advance the turn
      return { valid: true, remaining: 0, dartsThrown: this.dartsThrownInTurn, winner: this.gameWinner };
    }

    if (this.dartsThrownInTurn >= 3) {
      this.nextTurn();
    }

    return { valid: true, remaining: this.scores[playerId], dartsThrown: this.dartsThrownInTurn };
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.dartsThrownInTurn = 0;
  }

  getGameState() {
    return {
      mode: 'X01',
      startingScore: this.startingScore,
      inMode: this.inMode,
      outMode: this.outMode,
      distance: this.distance,
      length: this.length,
      scores: this.scores,
      turns: this.turns,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      dartsThrownInTurn: this.dartsThrownInTurn,
      legsWon: this.legsWon,
      setsWon: this.setsWon,
      currentLeg: this.currentLeg,
      currentSet: this.currentSet,
      gameWinner: this.gameWinner,
      checkoutDarts: this.checkoutDarts
    };
  }
}

class CricketGame {
  // ... (Keeping the class structure but implementation can be added later)
}

class BullOffGame {
  constructor(options = {}) {
    this.players = [];
    this.currentPlayerIndex = 0;
    this.dartsThrownInTurn = 0;
    this.gameWinner = null;
    this.throwHistory = {}; // playerId -> array of throws [{score, multiplier, hitBull}]
  }

  initializePlayers(players) {
    this.players = players;
    players.forEach(player => {
      this.throwHistory[player.id] = [];
    });
  }

  // Simple validation for Bull-Off: only allow bull (25) and double bull (50) scores
  validateThrow(throwData) {
    const score = throwData;
    return score === 25 || score === 50; // Only bull hits count
  }

  processThrow(playerId, throwData) {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (playerId !== currentPlayer.id) return { valid: false, reason: 'Not your turn' };
    if (this.dartsThrownInTurn >= 3) return { valid: false, reason: 'Turn over' };

    const score = throwData; // Assuming throwData is just the score for now

    if (!this.validateThrow(score)) {
      // Non-bull throw: just consume the dart, no win
      this.throwHistory[playerId].push({ score, hitBull: false });
      this.dartsThrownInTurn++;
      if (this.dartsThrownInTurn >= 3) {
        this.nextTurn();
      }
      return { valid: true, hitBull: false, dartsThrown: this.dartsThrownInTurn };
    }

    // Bull hit! Win immediately
    this.throwHistory[playerId].push({ score, hitBull: true });
    this.gameWinner = playerId;
    this.dartsThrownInTurn++;

    return { valid: true, hitBull: true, winner: this.gameWinner, dartsThrown: this.dartsThrownInTurn };
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.dartsThrownInTurn = 0;
  }

  getGameState() {
    return {
      mode: 'BullOff',
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      dartsThrownInTurn: this.dartsThrownInTurn,
      gameWinner: this.gameWinner,
      throwHistory: this.throwHistory
    };
  }

  setCheckoutDarts(darts) {
    // Not applicable for Bull-Off
  }
}


module.exports = {
  gameModes,
  X01Game,
  CricketGame,
  BullOffGame
};
