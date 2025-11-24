// Game mode implementations with placeholders

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
      this.scores[player] = this.startingScore;
      this.turns[player] = [];
      this.legsWon[player] = 0;
      this.setsWon[player] = 0;
    });
  }

  validateThrow(throwData) {
    const points = throwData.score * throwData.multiplier;
    const remaining = this.scores[this.players[this.currentPlayerIndex]];
    // Check bust: if points > remaining, unless it's exactly remaining and out mode allows
    if (this.outMode === 'double' && remaining - points < 0 && remaining - points !== 0) return false;
    if (this.outMode === 'double' && remaining - points === 0 && throwData.multiplier !== 2) return false;
    // For master, any or double
    if (this.outMode === 'master' && remaining - points === 0 && throwData.multiplier === 1 && throwData.score % 2 !== 0) return false; // can't finish on odd single if master
    return true;
  }

  processThrow(playerId, throwData) {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (playerId !== currentPlayer) return { valid: false, reason: 'Not your turn' };
    if (this.dartsThrownInTurn >= 3) return { valid: false, reason: 'Turn over' };

    if (!this.validateThrow(throwData)) {
      this.dartsThrownInTurn++;
      return { valid: false, reason: 'Invalid throw', remaining: this.scores[playerId], dartsThrown: this.dartsThrownInTurn };
    }

    const points = throwData.score * throwData.multiplier;
    this.scores[playerId] -= points;
    this.turns[playerId].push(points);
    this.dartsThrownInTurn++;

    if (this.dartsThrownInTurn >= 3) {
      this.nextTurn();
    }

    return { valid: true, remaining: this.scores[playerId], dartsThrown: this.dartsThrownInTurn };
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.dartsThrownInTurn = 0;
  }

  checkWinCondition(playerId) {
    if (this.scores[playerId] === 0) {
      this.legsWon[playerId]++;
      if (this.distance === 'leg') {
        if ((this.length.type === 'firstTo' && this.legsWon[playerId] >= this.length.value) ||
            (this.length.type === 'bestOf' && this.legsWon[playerId] > Math.floor(this.length.value / 2))) {
          this.gameWinner = playerId;
          return true;
        }
      } else if (this.distance === 'set') {
        // After leg win, check if set won
        if (this.legsWon[playerId] >= 3) { // assuming 3 legs per set
          this.setsWon[playerId]++;
          this.legsWon[playerId] = 0; // reset for next set
          if ((this.length.type === 'firstTo' && this.setsWon[playerId] >= this.length.value) ||
              (this.length.type === 'bestOf' && this.setsWon[playerId] > Math.floor(this.length.value / 2))) {
            this.gameWinner = playerId;
            return true;
          }
          this.currentSet++;
          this.currentLeg = 1;
        }
      }
      // Reset scores for next leg
      this.players.forEach(p => this.scores[p] = this.startingScore);
      this.currentLeg++;
      return false; // leg won, not game
    }
    return false;
  }

  setCheckoutDarts(darts) {
    this.checkoutDarts = darts;
  }

  getGameState() {
    return {
      mode: 'x01',
      startingScore: this.startingScore,
      inMode: this.inMode,
      outMode: this.outMode,
      distance: this.distance,
      length: this.length,
      scores: this.scores,
      turns: this.turns,
      currentPlayer: this.players[this.currentPlayerIndex],
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
  constructor(options = {}) {
    this.targets = [15, 16, 17, 18, 19, 20, 25]; // Bullseye is 25
    this.inMode = options.inMode || 'single'; // 'single', 'double', 'master'
    this.outMode = options.outMode || 'double'; // 'single', 'double', 'master'
    this.distance = options.distance || 'leg'; // 'leg', 'set'
    this.length = options.length || { type: 'firstTo', value: 1 }; // { type: 'firstTo'|'bestOf', value: number }
    this.playerMarks = {}; // playerId -> { target: marks (0-3) }
    this.playerPoints = {}; // playerId -> points
    this.players = [];
    this.currentPlayerIndex = 0;
    this.dartsThrownInTurn = 0;
    this.legsWon = {}; // playerId -> legs won
    this.setsWon = {}; // if distance is set
    this.currentLeg = 1;
    this.currentSet = 1;
    this.gameWinner = null;
  }

  initializePlayers(players) {
    this.players = players;
    players.forEach(player => {
      this.playerMarks[player] = {};
      this.playerPoints[player] = 0;
      this.legsWon[player] = 0;
      this.setsWon[player] = 0;
      this.targets.forEach(target => {
        this.playerMarks[player][target] = 0;
      });
    });
  }

  processThrow(playerId, throwData) {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (playerId !== currentPlayer) return { valid: false, reason: 'Not your turn' };
    if (this.dartsThrownInTurn >= 3) return { valid: false, reason: 'Turn over' };

    const target = throwData.target;
    const marks = throwData.multiplier;

    if (this.playerMarks[playerId][target] < 3) {
      this.playerMarks[playerId][target] += marks;
      if (this.playerMarks[playerId][target] > 3) {
        const extraMarks = this.playerMarks[playerId][target] - 3;
        this.playerMarks[playerId][target] = 3;
        this.playerPoints[playerId] += extraMarks * target;
      }
    } else {
      this.playerPoints[playerId] += marks * target;
    }

    this.dartsThrownInTurn++;
    if (this.dartsThrownInTurn >= 3) {
      this.nextTurn();
    }

    return { valid: true, marks: this.playerMarks[playerId][target], points: this.playerPoints[playerId], dartsThrown: this.dartsThrownInTurn };
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.dartsThrownInTurn = 0;
  }

  checkWinCondition(playerId) {
    // Check if player has closed all targets
    const allClosed = this.targets.every(target => this.playerMarks[playerId][target] >= 3);
    if (!allClosed) return false;

    // Check if all other players have also closed or if this player has higher points
    const allOthersClosed = this.players.every(p => p === playerId || this.targets.every(target => this.playerMarks[p][target] >= 3));
    if (!allOthersClosed) return false;

    // If all closed, highest points win
    const maxPoints = Math.max(...this.players.map(p => this.playerPoints[p]));
    if (this.playerPoints[playerId] === maxPoints) {
      this.legsWon[playerId]++;
      if (this.distance === 'leg') {
        if ((this.length.type === 'firstTo' && this.legsWon[playerId] >= this.length.value) ||
            (this.length.type === 'bestOf' && this.legsWon[playerId] > Math.floor(this.length.value / 2))) {
          this.gameWinner = playerId;
        }
      } else if (this.distance === 'set') {
        if (this.legsWon[playerId] >= 3) { // assuming 3 legs per set
          this.setsWon[playerId]++;
          // Reset marks and points for next set
          this.players.forEach(p => {
            this.targets.forEach(target => this.playerMarks[p][target] = 0);
            this.playerPoints[p] = 0;
          });
          if ((this.length.type === 'firstTo' && this.setsWon[playerId] >= this.length.value) ||
              (this.length.type === 'bestOf' && this.setsWon[playerId] > Math.floor(this.length.value / 2))) {
            this.gameWinner = playerId;
          }
          this.currentSet++;
          this.currentLeg = 1;
        }
      }
      // Reset for next leg if not game over
      if (!this.gameWinner) {
        this.players.forEach(p => {
          this.targets.forEach(target => this.playerMarks[p][target] = 0);
          this.playerPoints[p] = 0;
        });
        this.currentLeg++;
      }
      return this.gameWinner !== null;
    }
    return false;
  }

  getGameState() {
    return {
      mode: 'cricket',
      inMode: this.inMode,
      outMode: this.outMode,
      distance: this.distance,
      length: this.length,
      marks: this.playerMarks,
      points: this.playerPoints,
      currentPlayer: this.players[this.currentPlayerIndex],
      dartsThrownInTurn: this.dartsThrownInTurn,
      legsWon: this.legsWon,
      setsWon: this.setsWon,
      currentLeg: this.currentLeg,
      currentSet: this.currentSet,
      gameWinner: this.gameWinner
    };
  }
}

class BullOffGame {
  constructor() {
    this.players = [];
    this.currentPlayerIndex = 0;
    this.dartsThrownInTurn = 0;
    this.rounds = {}; // playerId -> current round (1,2,3,... where round n requires n hits)
    this.bullHits = {}; // playerId -> bull hits in current round
    this.throwHistory = {}; // playerId -> array of throws [{score, multiplier, hitBull}]
    this.winner = null;
    this.gameStarted = false; // Only host can start after Bull-Off
  }

  initializePlayers(players) {
    this.players = players;
    players.forEach(player => {
      this.rounds[player] = 1;
      this.bullHits[player] = 0;
      this.throwHistory[player] = [];
    });
  }

  processThrow(playerId, throwData) {
    if (!this.gameStarted) return { valid: false, reason: 'Game not started' };
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (playerId !== currentPlayer) return { valid: false, reason: 'Not your turn' };
    if (this.dartsThrownInTurn >= 3) return { valid: false, reason: 'Turn over' };

    // Bull hit if score is 25 or 50 (bull or double bull)
    const hitBull = throwData.score === 25 || throwData.score === 50;
    this.throwHistory[playerId].push({ ...throwData, hitBull, round: this.rounds[playerId] });

    if (hitBull) {
      this.bullHits[playerId]++;
      if (this.bullHits[playerId] >= this.rounds[playerId]) {
        // Round complete, advance to next round
        this.rounds[playerId]++;
        this.bullHits[playerId] = 0;
        this.dartsThrownInTurn++;
        if (this.dartsThrownInTurn >= 3) {
          this.nextTurn();
        }
        return { valid: true, hitBull: true, roundComplete: true, newRound: this.rounds[playerId], dartsThrown: this.dartsThrownInTurn };
      }
    }

    this.dartsThrownInTurn++;
    if (this.dartsThrownInTurn >= 3) {
      this.nextTurn();
    }

    return { valid: true, hitBull, hits: this.bullHits[playerId], dartsThrown: this.dartsThrownInTurn };
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.dartsThrownInTurn = 0;
  }

  checkWinCondition(playerId) {
    // Win if first to hit bull in a round
    // But in Bull-Off, it's the first to hit bullseye from their throws
    // Actually, from spec: "Wer anfängt: ausbullen" where players take turns throwing at the bull, first to hit wins.
    // So first player to hit bull (25) wins, no tiebreaker.
    const playerThrows = this.throwHistory[playerId];
    return playerThrows.some(throwData => throwData.hitBull);
  }

  startGame() {
    this.gameStarted = true;
  }

  getGameState() {
    return {
      mode: 'bull-off',
      players: this.players,
      currentPlayer: this.players[this.currentPlayerIndex],
      dartsThrownInTurn: this.dartsThrownInTurn,
      rounds: this.rounds,
      bullHits: this.bullHits,
      throwHistory: this.throwHistory,
      winner: this.winner,
      gameStarted: this.gameStarted
    };
  }
}

module.exports = { X01Game, CricketGame, BullOffGame };