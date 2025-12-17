class X01Game {
    constructor(options = {}) {
      this.startingScore = options.startingScore || 501;
      this.inMode = options.inMode || 'single';
      this.outMode = options.outMode || 'double';
      this.distance = options.distance || 'legs'; // 'legs' or 'sets'
      this.length = options.length || { type: 'firstTo', value: 1 }; // { type: 'firstTo'|'bestOf', value: number }
      this.gameOptions = options; // WICHTIG: Optionen speichern für späteren Zugriff
      
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
        console.log(`[X01Game] processThrow called - Player: ${playerId}, Score: ${score}, Current Player Index: ${this.currentPlayerIndex}`);
        
        if (this.winner) {
            console.log(`[X01Game] Game already ended`);
            return { valid: false, reason: 'Game has already ended' };
        }
        if (playerId !== this.players[this.currentPlayerIndex]) {
            console.log(`[X01Game] Not player's turn - Expected: ${this.players[this.currentPlayerIndex]}, Got: ${playerId}`);
            return { valid: false, reason: 'Not your turn' };
        }
    
        const currentScore = this.scores[playerId];
        const scoreValue = parseInt(score, 10);
        
        console.log(`[X01Game] processThrow - Player: ${playerId}, Score eingegeben: ${scoreValue}, Aktueller Score: ${currentScore}`);
        console.log(`[X01Game] Out Mode:`, this.outMode);
        
        // Bust-Logik
        const newScoreAfterThrow = currentScore - scoreValue;

        // Bust-Bedingungen: Score < 0, Score = 1, oder Score = 0 aber nicht mit Double ausgecheckt
        // Für Score = 0 müssen wir prüfen ob es ein gültiges Finish ist
        let isBust = newScoreAfterThrow < 0 || newScoreAfterThrow === 1;

        // Wenn Score = 0 erreicht wird, prüfe ob es ein gültiges Finish ist
        if (newScoreAfterThrow === 0) {
            console.log(`[X01Game] Score reached 0, checking out mode:`, this.outMode);
            if (this.outMode === 'double') {
                // Bei Double-Out muss der letzte Wurf ein Double sein
                // Da wir keine Dart-Details haben, nehmen wir an dass der Client das prüft
                // Für jetzt: Erlaube Finish bei Score = 0 (Client muss das validieren)
                console.log(`[X01Game] Double-out mode - allowing finish`);
                isBust = false;
            } else {
                // Bei Single-Out ist jeder Wurf erlaubt
                console.log(`[X01Game] Single-out mode - allowing finish`);
                isBust = false;
            }
        }

        console.log(`[X01Game] Score aktualisiert - Alter Score: ${currentScore}, Abzug: ${scoreValue}, Neuer Score: ${newScoreAfterThrow}, Is Bust: ${isBust}`);

        // Aktualisiere Score wenn kein Bust
        if (!isBust) {
            this.scores[playerId] = newScoreAfterThrow;
        }

        // Prüfe auf Gewinner
        if (newScoreAfterThrow === 0) {
            this.legWinner = playerId;
            this.legsWon[playerId] = (this.legsWon[playerId] || 0) + 1;
            console.log(`[X01Game] LEG GEWONNEN: ${playerId}!`);

            // Prüfen, ob das ganze Spiel gewonnen wurde (mit "Best Of" / "First To" Logik)
            let gameHasBeenWon = false;
            if (this.distance === 'legs') {
                if (this.length.type === 'firstTo' && this.legsWon[playerId] >= this.length.value) {
                    gameHasBeenWon = true;
                } else if (this.length.type === 'bestOf' && this.legsWon[playerId] > Math.floor(this.length.value / 2)) {
                    gameHasBeenWon = true;
                }
            } else if (this.distance === 'sets') {
                // Set-Logik: Prüfen, ob ein Set gewonnen wurde
                if (this.legsWon[playerId] >= (this.gameOptions?.legsPerSet || 3)) {
                    this.setsWon[playerId] = (this.setsWon[playerId] || 0) + 1;
                    console.log(`[X01Game] SET GEWONNEN: ${playerId}!`);

                    // Prüfen, ob das ganze Spiel durch den Set-Gewinn gewonnen wurde
                    if (this.length.type === 'firstTo' && this.setsWon[playerId] >= this.length.value) {
                        gameHasBeenWon = true;
                    } else if (this.length.type === 'bestOf' && this.setsWon[playerId] > Math.floor(this.length.value / 2)) {
                        gameHasBeenWon = true;
                    }

                    if (!gameHasBeenWon) {
                        // Wenn das Spiel nicht vorbei ist, starte das nächste Set
                        this.startNextSet();
                    }
                }
            }

            if (gameHasBeenWon) {
                this.gameWinner = playerId;
                this.winner = playerId; // Setze den finalen Gewinner
                console.log(`[X01Game] SPIEL GEWONNEN: ${playerId}!`);
                return { valid: true, bust: false, winner: this.gameWinner, legWinner: this.legWinner };
            }
            
            // Wenn kein Set gewonnen wurde, aber ein Leg, starte das nächste Leg
            if (!this.winner) {
                this.startNextLeg();
            }
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

    startNextSet() {
        console.log("[X01Game] Starte nächstes Set...");
        // Setze Leg-Zähler für alle Spieler zurück
        this.players.forEach(playerId => {
            this.legsWon[playerId] = 0;
        });
        this.startNextLeg(); // Ein neues Set startet auch mit einem neuen Leg
    }
  
    nextTurn() {
        this.dartsThrownInTurn = 0;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }
  
    undoLastThrow() {
        if (this.history.length === 0) {
            return { success: false, reason: "Keine Züge zum Rückgängigmachen." };
        }

        // Finde den letzten Zug, der kein "new_leg" Event ist
        const lastThrowIndex = this.history.map(h => h.type !== 'new_leg').lastIndexOf(true);
        if (lastThrowIndex === -1) {
            return { success: false, reason: "Keine Würfe in diesem Leg zum Rückgängigmachen." };
        }

        const lastThrow = this.history[lastThrowIndex];
        const { playerId, score, bust, remainingScore } = lastThrow;

        // Setze den Score des Spielers auf den Stand vor dem Wurf zurück
        this.scores[playerId] = bust ? remainingScore : remainingScore + score;

        // Setze den aktiven Spieler auf den Spieler zurück, der den Wurf gemacht hat
        this.currentPlayerIndex = this.players.findIndex(p => p === playerId);

        // Entferne den letzten Wurf aus der Historie
        this.history.splice(lastThrowIndex, 1);

        return { success: true };
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
        this.distance = options.distance || 'legs'; // 'legs' or 'sets'
        this.length = options.length || { type: 'firstTo', value: 1 }; // { type: 'firstTo'|'bestOf', value: number }
        
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

        const marksBefore = this.marks[playerId][number];
        let pointsAdded = 0;

        const currentMarks = this.marks[playerId][number];
        
        if (currentMarks < 3) {
            const marksToAdd = Math.min(3 - currentMarks, multiplier);
            this.marks[playerId][number] += marksToAdd;

            const overflow = multiplier - marksToAdd;
            if (overflow > 0) {
                // Punkte für den Spieler selbst, wenn er mehr als 3 Treffer hat
                pointsAdded = number * overflow;
                this.scores[playerId] += pointsAdded;
            }
        } else {
            // Spieler hat das Feld schon zu, also Punkte für ihn, wenn der Gegner es noch nicht zu hat.
            const allOpponentsClosed = this.players.every(p => p === playerId || this.marks[p][number] >= 3);
            if (!allOpponentsClosed) {
                pointsAdded = number * multiplier;
                this.scores[playerId] += pointsAdded;
            }
        }

        this.history.push({
            playerId,
            number,
            multiplier,
            marksBefore: marksBefore,
            pointsAdded: pointsAdded,
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

                let gameHasBeenWon = false;
                if (this.distance === 'legs') {
                     if (this.length.type === 'firstTo' && this.legsWon[playerId] >= this.length.value) {
                        gameHasBeenWon = true;
                    } else if (this.length.type === 'bestOf' && this.legsWon[playerId] > Math.floor(this.length.value / 2)) {
                        gameHasBeenWon = true;
                    }
                } else if (this.distance === 'sets') {
                    if (this.legsWon[playerId] >= (this.gameOptions?.legsPerSet || 3)) {
                        this.setsWon[playerId] = (this.setsWon[playerId] || 0) + 1;
                        console.log(`[CricketGame] SET GEWONNEN: ${playerId}!`);

                        if (this.length.type === 'firstTo' && this.setsWon[playerId] >= this.length.value) {
                            gameHasBeenWon = true;
                        } else if (this.length.type === 'bestOf' && this.setsWon[playerId] > Math.floor(this.length.value / 2)) {
                            gameHasBeenWon = true;
                        }

                        if (!gameHasBeenWon) {
                            this.startNextSet();
                        }
                    }
                }

                if (gameHasBeenWon) {
                    this.winner = playerId;
                    console.log(`[CricketGame] SPIEL GEWONNEN: ${playerId}!`);
                } else if (!this.winner) {
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

    startNextSet() {
        console.log("[CricketGame] Starte nächstes Set...");
        // Setze Leg-Zähler für alle Spieler zurück
        this.players.forEach(playerId => {
            this.legsWon[playerId] = 0;
        });
        this.startNextLeg(); // Ein neues Set startet auch mit einem neuen Leg
    }

    nextTurn() {
        this.dartsThrownInTurn = 0;
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    undoLastThrow() {
        if (this.history.length === 0) {
            return { success: false, reason: "Keine Züge zum Rückgängigmachen." };
        }

        const lastThrow = this.history.pop();
        if (!lastThrow || !lastThrow.playerId) {
            return { success: false, reason: "Letzter Zug ungültig." };
        }

        const { playerId, number, pointsAdded, marksBefore } = lastThrow;

        // 1. Punkte zurücksetzen
        this.scores[playerId] -= pointsAdded;

        // 2. Marks zurücksetzen
        this.marks[playerId][number] = marksBefore;

        // 3. Aktiven Spieler und Dart-Zähler zurücksetzen
        this.currentPlayerIndex = this.players.findIndex(p => p === playerId);
        this.dartsThrownInTurn = (this.dartsThrownInTurn - 1 + this.maxDartsPerTurn) % this.maxDartsPerTurn;
        
        this.winner = null; // Ein eventueller Gewinn wird rückgängig gemacht
        return { success: true };
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
