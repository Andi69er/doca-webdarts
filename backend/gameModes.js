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

class CricketGame {
    constructor(options = {}) {
        this.players = [];
        this.scores = {}; // Points for each player
        this.marks = {}; // Marks for each number (15,16,17,18,19,20,25)
        this.currentPlayerIndex = 0;
        this.dartsThrownInTurn = 0;
        this.history = [];
        this.winner = null;
        this.gameOptions = options;
    }

    initializePlayers(players, startPlayerIndex = 0) {
        this.players = players.map(p => p.id);
        this.players.forEach(playerId => {
            this.scores[playerId] = 0;
            this.marks[playerId] = {
                15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0
            };
        });
        this.currentPlayerIndex = startPlayerIndex;
    }

    processThrow(playerId, score) {
        if (this.winner) {
            return { valid: false, reason: 'Game has already ended' };
        }
        if (playerId !== this.players[this.currentPlayerIndex]) {
            return { valid: false, reason: 'Not your turn' };
        }

        // Cricket scoring logic - parse score number into number and multiplier
        let number, multiplier;

        if (typeof score === 'object') {
            number = score.number;
            multiplier = score.multiplier;
        } else {
            // Parse number score (e.g., 20 = single 20, 40 = double 20, 60 = triple 20)
            const scoreNum = parseInt(score);
            if (scoreNum <= 20 || scoreNum === 25) {
                number = scoreNum;
                multiplier = 1;
            } else if (scoreNum <= 40) {
                number = scoreNum / 2;
                multiplier = 2;
            } else if (scoreNum <= 60) {
                number = scoreNum / 3;
                multiplier = 3;
            } else {
                return { valid: false, reason: 'Invalid score for Cricket' };
            }
        }

        if (!this.marks[playerId][number]) {
            this.marks[playerId][number] = 0;
        }

        // Check if number is closed for this player
        const isClosed = this.marks[playerId][number] >= 3;

        // Add marks
        if (!isClosed) {
            this.marks[playerId][number] = Math.min(3, this.marks[playerId][number] + multiplier);
        }

        // Add points if number is closed for opponent but not for this player
        const opponentId = this.players.find(p => p !== playerId);
        const opponentClosed = this.marks[opponentId][number] >= 3;

        if (opponentClosed && !isClosed) {
            this.scores[playerId] += number * multiplier;
        }

        this.history.push({
            playerId,
            number,
            multiplier,
            points: opponentClosed && !isClosed ? number * multiplier : 0,
            marks: this.marks[playerId][number]
        });

        // Check for winner - all numbers closed and higher or equal points
        const allNumbers = [15, 16, 17, 18, 19, 20, 25];
        const playerClosedAll = allNumbers.every(num => this.marks[playerId][num] >= 3);
        const opponentClosedAll = allNumbers.every(num => this.marks[opponentId][num] >= 3);

        if (playerClosedAll) {
            if (opponentClosedAll) {
                // Both closed - higher points win
                if (this.scores[playerId] > this.scores[opponentId]) {
                    this.winner = playerId;
                } else if (this.scores[playerId] < this.scores[opponentId]) {
                    this.winner = opponentId;
                }
                // If equal points, continue playing
            } else {
                // Player closed all, opponent hasn't
                this.winner = playerId;
            }
        }

        this.nextTurn();
        return { valid: true, winner: this.winner };
    }

    nextTurn() {
        this.dartsThrownInTurn = 0;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    getGameState() {
        return {
            scores: this.scores,
            marks: this.marks,
            currentPlayer: this.players[this.currentPlayerIndex],
            winner: this.winner,
            history: this.history
        };
    }
}

const gameModes = {
    X01Game: {
        name: 'X01',
    },
    CricketGame: {
        name: 'Cricket',
    }
};
module.exports = {
    gameModes,
    X01Game,
    CricketGame
};
