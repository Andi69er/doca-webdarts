class X01Game {
    constructor(options = {}) {
      this.startingScore = options.startingScore || 501;
      this.inMode = options.inMode || 'single';
      this.outMode = options.outMode || 'double';
      this.players = [];
      this.scores = {};
      this.currentPlayerIndex = 0;
      this.dartsThrownInTurn = 0;
      this.history = []; // Unified history log
      this.winner = null;
      this.checkoutDarts = null;
    }
  
    initializePlayers(players, startPlayerIndex = 0) {
        this.players = players.map(p => p.id); // Store player IDs
        this.players.forEach(playerId => {
            this.scores[playerId] = this.startingScore;
        });
        this.currentPlayerIndex = startPlayerIndex; // Start with the specified player
    }
  
    processThrow(playerId, score) {
        if (this.winner) {
            return { valid: false, reason: 'Game has already ended' };
        }
        if (playerId !== this.players[this.currentPlayerIndex]) {
            return { valid: false, reason: 'Not your turn' };
        }
    
        const currentScore = this.scores[playerId];
        const scoreValue = typeof score === 'object' ? score.score : score;
        
        console.log(`[X01Game] processThrow - Player: ${playerId}, Score eingegeben: ${scoreValue}, Aktueller Score: ${currentScore}`);
        
        // Bust check - wenn der Score zu hoch ist oder genau 1 übrig bleibt
        if (scoreValue > currentScore || (currentScore - scoreValue === 1)) {
            this.history.push({ playerId, score: scoreValue, bust: true, remainingScore: currentScore });
            console.log(`[X01Game] BUST! Score bleibt bei ${currentScore}, nächster Spieler`);
            this.nextTurn();
            console.log(`[X01Game] Nächster Spieler Index: ${this.currentPlayerIndex}`);
            return { valid: true, bust: true, winner: null };
        }
    
        // Berechne den neuen Score
        const newScore = currentScore - scoreValue;
        this.scores[playerId] = newScore;
        this.history.push({ playerId, score: scoreValue, bust: false, remainingScore: newScore });
    
        console.log(`[X01Game] Score aktualisiert - Alter Score: ${currentScore}, Abzug: ${scoreValue}, Neuer Score: ${newScore}`);
    
        // Prüfe auf Gewinner
        if (newScore === 0) {
            this.winner = playerId;
            console.log(`[X01Game] GEWINNER: ${playerId}!`);
            return { valid: true, bust: false, winner: this.winner };
        }
    
        // Nach jeder Eingabe zum nächsten Spieler wechseln (da Gesamtscore eingegeben wird, nicht einzelne Darts)
        this.nextTurn();
        console.log(`[X01Game] Zug beendet, nächster Spieler Index: ${this.currentPlayerIndex}`);
    
        return { valid: true, bust: false, winner: null };
    }
  
    nextTurn() {
        this.dartsThrownInTurn = 0;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }
  
    getGameState() {
        return {
            scores: this.scores,
            currentPlayer: this.players[this.currentPlayerIndex],
            winner: this.winner,
            history: this.history,
            checkoutDarts: this.checkoutDarts,
        };
    }

    setCheckoutDarts(dartCount) {
        this.checkoutDarts = dartCount;
    }
}
const gameModes = {
    X01Game: {
        name: 'X01',
    }
};
module.exports = {
    gameModes,
    X01Game
};