class X01Game {
    constructor(options = {}) {
      this.startingScore = options.startingScore || 501;
      this.inMode = options.inMode || 'single';
      this.outMode = options.outMode || 'double';
      this.legsToWin = options.legs || 1;
      this.setsToWin = options.sets || 1;

      this.players = [];
      this.scores = {};
      this.currentPlayerIndex = 0;
      this.dartsThrownInTurn = 0;
      this.history = []; // Unified history log
      this.winner = null;
      this.legWinner = null;
      this.gameWinner = null;

      this.legsWon = {};
      this.setsWon = {};

      this.checkoutDarts = null;
    }
  
    initializePlayers(playerIds, startPlayerIndex = 0) {
        this.players = playerIds; // Store player IDs
        this.players.forEach(playerId => {
            this.scores[playerId] = this.startingScore;
            this.legsWon[playerId] = 0;
            this.setsWon[playerId] = 0;
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
        const scoreValue = parseInt(score, 10);
        
        console.log(`[X01Game] processThrow - Player: ${playerId}, Score eingegeben: ${scoreValue}, Aktueller Score: ${currentScore}`);
        
        // Bust-Logik
        const newScoreAfterThrow = currentScore - scoreValue;

        const isBust = newScoreAfterThrow < 0 || newScoreAfterThrow === 1 || (newScoreAfterThrow === 0 && this.outMode === 'double' /* Hier müsste die Dart-Info geprüft werden, was wir nicht haben. Vereinfachung: Wir nehmen an, der Client prüft das. */);

        if (isBust) {
            this.history.push({ playerId, score: scoreValue, bust: true, remainingScore: currentScore });
            console.log(`[X01Game] BUST! Score bleibt bei ${currentScore}, nächster Spieler`);
            // Score wird nicht geändert
            this.nextTurn();
            console.log(`[X01Game] Nächster Spieler Index: ${this.currentPlayerIndex}`);
            return { valid: true, bust: true, winner: null };
        }
    
        // Berechne den neuen Score
        this.scores[playerId] = newScoreAfterThrow;
        this.history.push({ playerId, score: scoreValue, bust: false, remainingScore: newScoreAfterThrow });
    
        console.log(`[X01Game] Score aktualisiert - Alter Score: ${currentScore}, Abzug: ${scoreValue}, Neuer Score: ${newScoreAfterThrow}`);
    
        // Prüfe auf Gewinner
        if (newScoreAfterThrow === 0) {
            this.legWinner = playerId;
            this.legsWon[playerId] = (this.legsWon[playerId] || 0) + 1;
            console.log(`[X01Game] LEG GEWONNEN: ${playerId}!`);

            // Prüfen, ob das ganze Spiel gewonnen wurde
            if (this.legsWon[playerId] >= this.legsToWin) {
                this.gameWinner = playerId;
                this.winner = playerId; // Setze den finalen Gewinner
                console.log(`[X01Game] SPIEL GEWONNEN: ${playerId}!`);
                return { valid: true, bust: false, winner: this.gameWinner, legWinner: this.legWinner };
            }

            // Nächstes Leg vorbereiten
            this.startNextLeg();
            return { valid: true, bust: false, winner: null, legWinner: this.legWinner };
        }
    
        // Nach jeder Eingabe (Turn) zum nächsten Spieler wechseln
        this.nextTurn();
        console.log(`[X01Game] Zug beendet, nächster Spieler Index: ${this.currentPlayerIndex}`);
    
        return { valid: true, bust: false, winner: null };
    }

    startNextLeg() {
        console.log("[X01Game] Starte nächstes Leg...");
        // Scores für alle Spieler zurücksetzen
        this.players.forEach(playerId => {
            this.scores[playerId] = this.startingScore;
        });

        // Den Startspieler für das nächste Leg wechseln (Verlierer beginnt)
        const legLoserIndex = this.players.findIndex(p => p !== this.legWinner);
        if (legLoserIndex !== -1) {
            this.currentPlayerIndex = legLoserIndex;
        }

        this.legWinner = null;
        this.history.push({ type: 'new_leg' });
    }
  
    nextTurn() {
        this.dartsThrownInTurn = 0;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }
  
    getGameState() {
        return {
            scores: this.scores,
            currentPlayerIndex: this.currentPlayerIndex,
            winner: this.winner,
            legsWon: this.legsWon,
            setsWon: this.setsWon,
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
        this.legsToWin = options.legs || 1;
        this.setsToWin = options.sets || 1;

        this.scores = {}; // Points for each player
        this.marks = {}; // Marks for each number (15,16,17,18,19,20,25)
        this.currentPlayerIndex = 0;
        this.dartsThrownInTurn = 0;
        this.history = [];
        this.winner = null;
        this.legWinner = null;
        this.legsWon = {};
        this.setsWon = {};
        this.gameOptions = options;
        this.maxDartsPerTurn = 3; // Cricket allows 3 darts per turn
    }

    initializePlayers(playerIds, startPlayerIndex = 0) {
        this.players = playerIds;
        this.players.forEach(playerId => {
            this.scores[playerId] = 0;
            this.legsWon[playerId] = 0;
            this.setsWon[playerId] = 0;
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

        // Cricket scoring logic - score ist ein Objekt { number, multiplier }
        let number, multiplier;

        if (typeof score === 'object') {
            number = score.number;
            multiplier = score.multiplier;
        } else {
            return { valid: false, reason: 'Invalid score format for Cricket' };
            /*
            // Fallback, falls doch eine Zahl kommt
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
            */
        }

        // Nur relevante Zahlen zählen
        const validTargets = [15, 16, 17, 18, 19, 20, 25];
        if (!validTargets.includes(number)) {
            // Wurf auf eine nicht-relevante Zahl
            this.dartsThrownInTurn++;
            if (this.dartsThrownInTurn >= this.maxDartsPerTurn) {
                this.nextTurn();
            }
            return { valid: true, winner: null, dartsThrownInTurn: this.dartsThrownInTurn };
        }

        const currentMarks = this.marks[playerId][number];
        
        if (currentMarks < 3) {
            const marksToAdd = Math.min(3 - currentMarks, multiplier);
            this.marks[playerId][number] += marksToAdd;

            const overflow = multiplier - marksToAdd;
            if (overflow > 0) {
                // Punkte für den Spieler selbst, wenn er mehr als 3 Treffer hat
                this.scores[playerId] += number * overflow;
            }
        } else {
            // Spieler hat das Feld schon zu, also Punkte für ihn, wenn der Gegner es noch nicht zu hat.
            const allOpponentsClosed = this.players.every(p => p === playerId || this.marks[p][number] >= 3);
            if (!allOpponentsClosed) {
                this.scores[playerId] += number * multiplier;
            }
        }

        this.history.push({
            playerId,
            number,
            multiplier,
        });

        // Increment darts thrown in this turn
        this.dartsThrownInTurn++;

        // Check for winner - all numbers closed and higher or equal points
        const allNumbers = [15, 16, 17, 18, 19, 20, 25];
        const playerHasClosedAll = allNumbers.every(num => this.marks[playerId][num] >= 3);

        if (playerHasClosedAll) {
            const highestScore = Math.max(...this.players.map(p => this.scores[p]));
            if (this.scores[playerId] >= highestScore) {
                // Leg gewonnen
                this.legWinner = playerId;
                this.legsWon[playerId] = (this.legsWon[playerId] || 0) + 1;
                console.log(`[CricketGame] LEG GEWONNEN: ${playerId}!`);

                if (this.legsWon[playerId] >= this.legsToWin) {
                    this.winner = playerId;
                    console.log(`[CricketGame] SPIEL GEWONNEN: ${playerId}!`);
                } else {
                    // Nächstes Leg vorbereiten
                    this.startNextLeg();
                }
            }
        }

        // Only switch turns after 3 darts in Cricket (unlike X01 which switches after 1)
        if (this.dartsThrownInTurn >= this.maxDartsPerTurn) {
            this.nextTurn();
        }

        return { valid: true, winner: this.winner, legWinner: this.legWinner, dartsThrownInTurn: this.dartsThrownInTurn };
    }

    startNextLeg() {
        console.log("[CricketGame] Starte nächstes Leg...");
        // Scores und Marks für alle Spieler zurücksetzen
        this.players.forEach(playerId => {
            this.scores[playerId] = 0;
            this.marks[playerId] = {
                15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0
            };
        });

        // Den Startspieler für das nächste Leg wechseln (Verlierer beginnt)
        const legLoserIndex = this.players.findIndex(p => p !== this.legWinner);
        if (legLoserIndex !== -1) {
            this.currentPlayerIndex = legLoserIndex;
        }

        this.legWinner = null;
        this.history.push({ type: 'new_leg' });
    }

    nextTurn() {
        this.dartsThrownInTurn = 0;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    getGameState() {
        return {
            scores: this.scores,
            marks: this.marks,
            currentPlayerIndex: this.currentPlayerIndex, // This was already correct, ensuring consistency
            legsWon: this.legsWon,
            setsWon: this.setsWon,
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
