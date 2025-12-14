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
        this.maxDartsPerTurn = 3; // Cricket allows 3 darts per turn
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

        this.dartsThrownInTurn++;

        // Cricket-relevante Zahlen
        const cricketNumbers = [15, 16, 17, 18, 19, 20, 25];

        let number, multiplier;
        let pointsScored = 0;
        
        // --- Eingabe verarbeiten ---
        if (typeof score === 'object' && score.number !== undefined) {
            number = score.number;
            multiplier = score.multiplier;
        } else {
            // Diese Art der Eingabe sollte für Cricket nicht verwendet werden.
            this.dartsThrownInTurn--; // Wurf nicht zählen
            return { valid: false, reason: 'Invalid score format for Cricket' };
        }

        // --- Miss / Wurf ohne Wert ---
        if (number === 0 || !cricketNumbers.includes(number)) {
            this.history.push({ playerId, number, multiplier, points: 0, dart: this.dartsThrownInTurn });
            if (this.dartsThrownInTurn >= this.maxDartsPerTurn) {
                this.nextTurn();
            }
            return { valid: true, winner: null, dartsThrownInTurn: this.dartsThrownInTurn };
        }

        // --- Logik für Treffer ---
        const opponentId = this.players.find(p => p !== playerId);
        const playerMarks = this.marks[playerId];
        const opponentMarks = opponentId ? this.marks[opponentId] : null;

        const currentMarks = playerMarks[number];

        // Nur punkten, wenn der Gegner das Feld noch nicht zu hat
        const canScorePoints = opponentMarks ? opponentMarks[number] < 3 : true;

        if (currentMarks < 3) {
            const marksNeeded = 3 - currentMarks;
            const marksToAdd = multiplier;
            
            playerMarks[number] += marksToAdd;

            if (playerMarks[number] >= 3) {
                // Feld wurde geschlossen oder war schon zu, Rest sind Punkte
                const overflowMarks = playerMarks[number] - 3;
                playerMarks[number] = 3; // Auf 3 begrenzen
                
                if (canScorePoints && overflowMarks > 0) {
                    pointsScored = overflowMarks * number;
                }
            }
        } else {
            // Feld ist bereits zu, alle Treffer sind Punkte
            if (canScorePoints) {
                pointsScored = multiplier * number;
            }
        }

        if (pointsScored > 0) {
            this.scores[playerId] += pointsScored;
        }

        this.history.push({ playerId, number, multiplier, points: pointsScored, dart: this.dartsThrownInTurn });

        // --- Siegerprüfung ---
        const allPlayerNumbersClosed = cricketNumbers.every(num => playerMarks[num] >= 3);
        if (allPlayerNumbersClosed) {
            const currentPlayerScore = this.scores[playerId];
            const opponentPlayerScore = opponentId ? this.scores[opponentId] : -1;

            if (currentPlayerScore >= opponentPlayerScore) {
                this.winner = playerId;
            }
        }

        // --- Nächster Zug ---
        if (!this.winner && this.dartsThrownInTurn >= this.maxDartsPerTurn) {
            this.nextTurn();
        }

        return { 
            valid: true, 
            winner: this.winner, 
            dartsThrownInTurn: this.dartsThrownInTurn,
        };
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
