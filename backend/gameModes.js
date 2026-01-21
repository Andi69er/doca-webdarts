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
  
    getTeamId(playerId) {
        if (this.gameOptions.teamMode === 'doubles' && this.gameOptions.teamAssignments) {
            return this.gameOptions.teamAssignments[playerId] || playerId;
        }
        return playerId;
    }

    initializePlayers(playerIds, startPlayerIndex = 0) {
        this.players = playerIds; // Store player IDs
        this.players.forEach(playerId => {
            const teamId = this.getTeamId(playerId);
            this.scores[teamId] = this.startingScore;
            this.legsWon[teamId] = 0;
            this.setsWon[teamId] = 0;
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
    
        const teamId = this.getTeamId(playerId);
        const currentScore = this.scores[teamId];
        const scoreValue = parseInt(score, 10);
        
        console.log(`[X01Game] processThrow - Player: ${playerId} (Team: ${teamId}), Score eingegeben: ${scoreValue}, Aktueller Score: ${currentScore}`);
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
            this.scores[teamId] = newScoreAfterThrow;
        }
        
        // FIX: Wurf zur Historie hinzufügen
        this.history.push({
            playerId: playerId,
            teamId: teamId,
            score: scoreValue,
            remainingScore: isBust ? currentScore : newScoreAfterThrow,
            isBust: isBust,
            dartsThrown: this.dartsThrownInTurn + 1
        });

        // Prüfe auf Gewinner
        if (newScoreAfterThrow === 0) {
            this.legWinner = playerId;
            this.legsWon[teamId] = (this.legsWon[teamId] || 0) + 1;
            console.log(`[X01Game] LEG GEWONNEN: ${playerId} (Team: ${teamId})!`);

            // Prüfen, ob das ganze Spiel gewonnen wurde (mit "Best Of" / "First To" Logik)
            let gameHasBeenWon = false;
            if (this.distance === 'legs') {
                if (this.length.type === 'firstTo' && this.legsWon[teamId] >= this.length.value) {
                    gameHasBeenWon = true;
                } else if (this.length.type === 'bestOf' && this.legsWon[teamId] > Math.floor(this.length.value / 2)) {
                    gameHasBeenWon = true;
                }
            } else if (this.distance === 'sets') {
                // Set-Logik: Prüfen, ob ein Set gewonnen wurde
                if (this.legsWon[teamId] >= (this.gameOptions?.legsPerSet || 3)) {
                    this.setsWon[teamId] = (this.setsWon[teamId] || 0) + 1;
                    console.log(`[X01Game] SET GEWONNEN: ${playerId} (Team: ${teamId})!`);

                    // Prüfen, ob das ganze Spiel durch den Set-Gewinn gewonnen wurde
                    if (this.length.type === 'firstTo' && this.setsWon[teamId] >= this.length.value) {
                        gameHasBeenWon = true;
                    } else if (this.length.type === 'bestOf' && this.setsWon[teamId] > Math.floor(this.length.value / 2)) {
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
                console.log(`[X01Game] SPIEL GEWONNEN: ${playerId} (Team: ${teamId})!`);
                return { valid: true, bust: false, winner: this.gameWinner, legWinner: playerId, dartsThrownInTurn: this.dartsThrownInTurn + 1, scoreValue };
            }
            
            // Speichere legWinner BEVOR wir startNextLeg() aufrufen
            const winnerOfThisLeg = this.legWinner;
            
            // Wenn kein Set gewonnen wurde, aber ein Leg, starte das nächste Leg
            if (!this.winner) {
                this.startNextLeg();
            }
            return { valid: true, bust: false, winner: null, legWinner: winnerOfThisLeg, dartsThrownInTurn: this.dartsThrownInTurn + 1, scoreValue };
        }
    
        // Nach jeder Eingabe (Turn) zum nächsten Spieler wechseln
        const dartsThrown = this.dartsThrownInTurn + 1;
        this.nextTurn();
        console.log(`[X01Game] Zug beendet, nächster Spieler Index: ${this.currentPlayerIndex}`);
    
        return { valid: true, bust: false, winner: null, dartsThrownInTurn: dartsThrown, scoreValue };
    }

    startNextLeg() {
        console.log("[X01Game] Starte nächstes Leg...");
        // Scores für alle Teams zurücksetzen
        Object.keys(this.scores).forEach(teamId => {
            this.scores[teamId] = this.startingScore;
        });

        // Den Startspieler für das nächste Leg wechseln (Verlierer beginnt)
        // Bei Teams: Welches Team hat verloren?
        const losingTeamId = Object.keys(this.legsWon).find(tid => tid !== this.getTeamId(this.legWinner));
        const nextStarterIndex = this.players.findIndex(pid => this.getTeamId(pid) === losingTeamId);
        
        if (nextStarterIndex !== -1) {
            this.currentPlayerIndex = nextStarterIndex;
        }

        this.legWinner = null;
        this.history.push({ type: 'new_leg' });
    }

    startNextSet() {
        console.log("[X01Game] Starte nächstes Set...");
        // Setze Leg-Zähler für alle Teams zurück
        Object.keys(this.legsWon).forEach(teamId => {
            this.legsWon[teamId] = 0;
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
        const { playerId, teamId, score, bust, remainingScore } = lastThrow;
        const targetId = teamId || playerId;

        // Setze den Score des Teams auf den Stand vor dem Wurf zurück
        this.scores[targetId] = bust ? remainingScore : remainingScore + score;

        // Setze den aktiven Spieler auf den Spieler zurück, der den Wurf gemacht hat
        this.currentPlayerIndex = this.players.findIndex(p => p === playerId);

        // Entferne den letzten Wurf aus der Historie
        this.history.splice(lastThrowIndex, 1);

        return { success: true, lastThrow };
    }

    getGameState() {
        const scores = {};
        const legsWon = {};
        const setsWon = {};
        
        this.players.forEach(pid => {
            const tid = this.getTeamId(pid);
            scores[pid] = this.scores[tid];
            legsWon[pid] = this.legsWon[tid];
            setsWon[pid] = this.setsWon[tid];
        });

        const gameState = {
            scores,
            legsWon,
            setsWon,
            currentPlayerIndex: this.currentPlayerIndex,
            winner: this.winner,
            legWinner: this.legWinner,
            history: this.history,
            turns: this.history, // FIX: Frontend erwartet 'turns', wir mappen history darauf
            checkoutDarts: this.checkoutDarts,
            gameOptions: this.gameOptions, // KRITISCH: Game Options für Frontend-Display
        };
        
        // DEBUG: Logge was wir zurückgeben
        console.log('[DEBUG] X01Game.getGameState() - Returning:', {
            gameOptions: gameState.gameOptions,
            startingScore: gameState.gameOptions?.startingScore,
            mode: 'x01',
            legWinner: gameState.legWinner
        });
        
        return gameState;
    }

    setCheckoutDarts(dartCount) {
        this.checkoutDarts = dartCount;
    }

    checkWinCondition(playerId) {
        const teamId = this.getTeamId(playerId);
        // If leg was already won and scores reset, we might be calling this after checkout confirmed
        // or if processThrow already handled it.
        // We check if the score IS 0 OR if the legWinner was just set.
        
        // Since processThrow already increments legsWon, we should be careful.
        // If this.legWinner is already set to this playerId, it means processThrow already handled it.
        if (this.legWinner === playerId) {
            return !!this.winner;
        }

        if (this.scores[teamId] !== 0) {
            return false;
        }

        this.legWinner = playerId;
        this.legsWon[teamId] = (this.legsWon[teamId] || 0) + 1;
        console.log(`[X01Game] LEG GEWONNEN: ${playerId} (Team: ${teamId})!`);

        let gameHasBeenWon = false;
        if (this.distance === 'legs') {
            if (this.length.type === 'firstTo' && this.legsWon[teamId] >= this.length.value) {
                gameHasBeenWon = true;
            } else if (this.length.type === 'bestOf' && this.legsWon[teamId] > Math.floor(this.length.value / 2)) {
                gameHasBeenWon = true;
            }
        } else if (this.distance === 'sets') {
            if (this.legsWon[teamId] >= (this.gameOptions?.legsPerSet || 3)) {
                this.setsWon[teamId] = (this.setsWon[teamId] || 0) + 1;
                console.log(`[X01Game] SET GEWONNEN: ${playerId} (Team: ${teamId})!`);

                if (this.length.type === 'firstTo' && this.setsWon[teamId] >= this.length.value) {
                    gameHasBeenWon = true;
                } else if (this.length.type === 'bestOf' && this.setsWon[teamId] > Math.floor(this.length.value / 2)) {
                    gameHasBeenWon = true;
                }

                if (!gameHasBeenWon) {
                    this.startNextSet();
                }
            }
        }

        if (gameHasBeenWon) {
            this.gameWinner = playerId;
            this.winner = playerId;
            console.log(`[X01Game] SPIEL GEWONNEN: ${playerId} (Team: ${teamId})!`);
            return true;
        }

        if (!this.winner) {
            this.startNextLeg();
        }
        return false;
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

    getTeamId(playerId) {
        if (this.gameOptions.teamMode === 'doubles' && this.gameOptions.teamAssignments) {
            return this.gameOptions.teamAssignments[playerId] || playerId;
        }
        return playerId;
    }

    initializePlayers(playerIds, startPlayerIndex = 0) {
        this.players = playerIds;
        this.players.forEach(playerId => {
            const teamId = this.getTeamId(playerId);
            this.scores[teamId] = 0;
            this.legsWon[teamId] = 0;
            this.setsWon[teamId] = 0;
            this.marks[teamId] = {
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

        const teamId = this.getTeamId(playerId);

        // Cricket scoring logic - score ist ein Objekt { number, multiplier }
        let number, multiplier;

        if (typeof score === 'object') {
            number = score.number;
            multiplier = score.multiplier;
        } else {
            return { valid: false, reason: 'Invalid score format for Cricket' };
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

        const marksBefore = this.marks[teamId][number];
        let pointsAdded = 0;

        const currentMarks = this.marks[teamId][number];
        
        if (currentMarks < 3) {
            const marksToAdd = Math.min(3 - currentMarks, multiplier);
            this.marks[teamId][number] += marksToAdd;

            const overflow = multiplier - marksToAdd;
            if (overflow > 0) {
                // Punkte für den Spieler selbst, wenn er mehr als 3 Treffer hat
                pointsAdded = number * overflow;
                this.scores[teamId] += pointsAdded;
            }
        } else {
            // Spieler hat das Feld schon zu, also Punkte für ihn, wenn der Gegner es noch nicht zu hat.
            const allOpponentsClosed = this.players.every(p => {
                const otherTeamId = this.getTeamId(p);
                return otherTeamId === teamId || this.marks[otherTeamId][number] >= 3;
            });
            if (!allOpponentsClosed) {
                pointsAdded = number * multiplier;
                this.scores[teamId] += pointsAdded;
            }
        }

        this.history.push({
            playerId,
            teamId,
            number,
            multiplier,
            marksBefore: marksBefore,
            pointsAdded: pointsAdded,
        });

        // Increment darts thrown in this turn
        this.dartsThrownInTurn++;

        // Check for winner - all numbers closed and higher or equal points
        const allNumbers = [15, 16, 17, 18, 19, 20, 25];
        const playerHasClosedAll = allNumbers.every(num => this.marks[teamId][num] >= 3);

        if (playerHasClosedAll) {
            const highestScore = Math.max(...Object.values(this.scores));
            if (this.scores[teamId] >= highestScore) {
                // Leg gewonnen
                this.legWinner = playerId;
                this.legsWon[teamId] = (this.legsWon[teamId] || 0) + 1;
                console.log(`[CricketGame] LEG GEWONNEN: ${playerId} (Team: ${teamId})!`);

                let gameHasBeenWon = false;
                if (this.distance === 'legs') {
                     if (this.length.type === 'firstTo' && this.legsWon[teamId] >= this.length.value) {
                        gameHasBeenWon = true;
                    } else if (this.length.type === 'bestOf' && this.legsWon[teamId] > Math.floor(this.length.value / 2)) {
                        gameHasBeenWon = true;
                    }
                } else if (this.distance === 'sets') {
                    if (this.legsWon[teamId] >= (this.gameOptions?.legsPerSet || 3)) {
                        this.setsWon[teamId] = (this.setsWon[teamId] || 0) + 1;
                        console.log(`[CricketGame] SET GEWONNEN: ${playerId} (Team: ${teamId})!`);

                        if (this.length.type === 'firstTo' && this.setsWon[teamId] >= this.length.value) {
                            gameHasBeenWon = true;
                        } else if (this.length.type === 'bestOf' && this.setsWon[teamId] > Math.floor(this.length.value / 2)) {
                            gameHasBeenWon = true;
                        }

                        if (!gameHasBeenWon) {
                            this.startNextSet();
                        }
                    }
                }

                const winnerOfThisLeg = playerId;
                if (gameHasBeenWon) {
                    this.winner = playerId;
                    console.log(`[CricketGame] SPIEL GEWONNEN: ${playerId} (Team: ${teamId})!`);
                } else if (!this.winner) {
                    // Nächstes Leg vorbereiten
                    this.startNextLeg();
                }
                
                return { valid: true, winner: this.winner, legWinner: winnerOfThisLeg, dartsThrownInTurn: this.dartsThrownInTurn, pointsAdded };
            }
        }

        // Only switch turns after 3 darts in Cricket (unlike X01 which switches after 1)
        if (this.dartsThrownInTurn >= this.maxDartsPerTurn) {
            this.nextTurn();
        }

        return { valid: true, winner: this.winner, legWinner: null, dartsThrownInTurn: this.dartsThrownInTurn, pointsAdded };
    }

    startNextLeg() {
        console.log("[CricketGame] Starte nächstes Leg...");
        // Scores und Marks für alle Teams zurücksetzen
        Object.keys(this.scores).forEach(teamId => {
            this.scores[teamId] = 0;
            this.marks[teamId] = {
                15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0
            };
        });

        // Den Startspieler für das nächste Leg wechseln (Verlierer beginnt)
        const losingTeamId = Object.keys(this.legsWon).find(tid => tid !== this.getTeamId(this.legWinner));
        const nextStarterIndex = this.players.findIndex(pid => this.getTeamId(pid) === losingTeamId);
        
        if (nextStarterIndex !== -1) {
            this.currentPlayerIndex = nextStarterIndex;
        }

        this.legWinner = null;
        this.history.push({ type: 'new_leg' });
    }

    startNextSet() {
        console.log("[CricketGame] Starte nächstes Set...");
        // Setze Leg-Zähler für alle Teams zurück
        Object.keys(this.legsWon).forEach(teamId => {
            this.legsWon[teamId] = 0;
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

        const { playerId, teamId, number, pointsAdded, marksBefore } = lastThrow;
        const targetId = teamId || playerId;

        // 1. Punkte zurücksetzen
        this.scores[targetId] -= pointsAdded;

        // 2. Marks zurücksetzen
        this.marks[targetId][number] = marksBefore;

        // 3. Aktiven Spieler und Dart-Zähler zurücksetzen
        this.currentPlayerIndex = this.players.findIndex(p => p === playerId);
        this.dartsThrownInTurn = (this.dartsThrownInTurn - 1 + this.maxDartsPerTurn) % this.maxDartsPerTurn;
        
        this.winner = null; // Ein eventueller Gewinn wird rückgängig gemacht
        return { success: true, lastThrow };
    }

    getGameState() {
        const scores = {};
        const marks = {};
        const legsWon = {};
        const setsWon = {};
        
        this.players.forEach(pid => {
            const tid = this.getTeamId(pid);
            scores[pid] = this.scores[tid];
            marks[pid] = this.marks[tid];
            legsWon[pid] = this.legsWon[tid];
            setsWon[pid] = this.setsWon[tid];
        });

        return {
            scores,
            marks,
            currentPlayerIndex: this.currentPlayerIndex, // This was already correct, ensuring consistency
            legsWon,
            setsWon,
            winner: this.winner,
            legWinner: this.legWinner,
            history: this.history,
            turns: this.history, // FIX: Konsistenz für Frontend
            gameOptions: this.gameOptions, // KRITISCH: Game Options für Frontend-Display
        };
    }

    checkWinCondition(playerId) {
        const teamId = this.getTeamId(playerId);
        
        if (this.legWinner === playerId) {
            return !!this.winner;
        }

        const allNumbers = [15, 16, 17, 18, 19, 20, 25];
        const playerHasClosedAll = allNumbers.every(num => this.marks[teamId][num] >= 3);

        if (!playerHasClosedAll) {
            return false;
        }

        const highestScore = Math.max(...Object.values(this.scores));
        if (this.scores[teamId] < highestScore) {
            return false;
        }

        this.legWinner = playerId;
        this.legsWon[teamId] = (this.legsWon[teamId] || 0) + 1;
        console.log(`[CricketGame] LEG GEWONNEN: ${playerId} (Team: ${teamId})!`);

        let gameHasBeenWon = false;
        if (this.distance === 'legs') {
            if (this.length.type === 'firstTo' && this.legsWon[teamId] >= this.length.value) {
                gameHasBeenWon = true;
            } else if (this.length.type === 'bestOf' && this.legsWon[teamId] > Math.floor(this.length.value / 2)) {
                gameHasBeenWon = true;
            }
        } else if (this.distance === 'sets') {
            if (this.legsWon[teamId] >= (this.gameOptions?.legsPerSet || 3)) {
                this.setsWon[teamId] = (this.setsWon[teamId] || 0) + 1;
                console.log(`[CricketGame] SET GEWONNEN: ${playerId} (Team: ${teamId})!`);

                if (this.length.type === 'firstTo' && this.setsWon[teamId] >= this.length.value) {
                    gameHasBeenWon = true;
                } else if (this.length.type === 'bestOf' && this.setsWon[teamId] > Math.floor(this.length.value / 2)) {
                    gameHasBeenWon = true;
                }

                if (!gameHasBeenWon) {
                    this.startNextSet();
                }
            }
        }

        if (gameHasBeenWon) {
            this.winner = playerId;
            console.log(`[CricketGame] SPIEL GEWONNEN: ${playerId} (Team: ${teamId})!`);
            return true;
        }

        if (!this.winner) {
            this.startNextLeg();
        }
        return false;
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
