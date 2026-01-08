function registerGameplayEvents({ io, socket, state, utils }) {
    const { createFullGameStateUpdate, updateBestLegAfterLegEnd, canCheckoutFrom } = utils;

    socket.on('score-input', (data) => {
        const { roomId, score, userId } = data;
        const room = state.rooms.find(r => r.id === roomId);

        if (!room || !room.game) {
            socket.emit('gameError', { error: 'Spiel nicht gestartet oder Raum nicht gefunden' });
            return;
        }

        const currentPlayerIndex = room.game.currentPlayerIndex || 0;
        const currentPlayer = room.players[currentPlayerIndex];

        if (currentPlayer?.id !== userId) {
            socket.emit('gameError', { error: 'Nicht dein Zug' });
            return;
        }

        try {
            const preThrowGameState = room.game.getGameState();
            const previousLegsWon = JSON.parse(JSON.stringify(room.game.legsWon || {}));
            const scoreBeforeThrow = preThrowGameState.scores[userId] || 0;

            const result = room.game.processThrow(userId, score);

            if (!result.valid) {
                socket.emit('gameError', { error: result.reason });
                return;
            }

            const newGameStateFromGame = room.game.getGameState();
            updateBestLegAfterLegEnd(room, previousLegsWon);

            const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
            const playerToUpdate = room.players[currentPlayerIndex];

            if (playerToUpdate) {
                playerToUpdate.dartsThrown = (playerToUpdate.dartsThrown || 0) + (room.gameMode === 'CricketGame' ? 1 : 3);
                playerToUpdate.scores = [...(playerToUpdate.scores || []), score];
                playerToUpdate.lastScore = score;
                playerToUpdate.lastThrownScore = score;

                if (room.gameMode !== 'CricketGame' && playerToUpdate.dartsThrown > 0) {
                    const pointsScored = startScore - (newGameStateFromGame.scores[playerToUpdate.id] || startScore);
                    const turnsPlayed = playerToUpdate.dartsThrown / 3;
                    playerToUpdate.avg = turnsPlayed > 0 ? (pointsScored / turnsPlayed).toFixed(2) : '0.00';
                }

                playerToUpdate.matchDartsThrown = (playerToUpdate.matchDartsThrown || 0) + (room.gameMode === 'CricketGame' ? 1 : 3);
                playerToUpdate.matchPointsScored = (playerToUpdate.matchPointsScored || 0) + score;

                if (score === 180) {
                    playerToUpdate.scores180 = (playerToUpdate.scores180 || 0) + 1;
                }
                if (score >= 140 && score < 180) {
                    playerToUpdate.scores140plus = (playerToUpdate.scores140plus || 0) + 1;
                }
                if (score >= 100 && score < 180) {
                    playerToUpdate.scores100plus = (playerToUpdate.scores100plus || 0) + 1;
                }
                if (score >= 60 && score < 100) {
                    playerToUpdate.scores60plus = (playerToUpdate.scores60plus || 0) + 1;
                }

                if (newGameStateFromGame.scores[playerToUpdate.id] === 0) {
                    playerToUpdate.finishes = [...(playerToUpdate.finishes || []), score];
                    if (score > (playerToUpdate.highestFinish || 0)) {
                        playerToUpdate.highestFinish = score;
                    }
                }
            }

            const currentScore = newGameStateFromGame.scores[userId];
            console.log('[DEBUG-BUST-CHECK] currentScore:', currentScore, 'scoreBeforeThrow:', scoreBeforeThrow, 'userId:', userId);

            const inFinishRange = canCheckoutFrom(scoreBeforeThrow);
            let updateData = createFullGameStateUpdate(room);

            console.log('[DEBUG] result.legWinner:', result.legWinner);
            console.log('[DEBUG] result.winner:', result.winner);
            console.log('[DEBUG] updateData.legWinner BEFORE:', updateData.legWinner);

            if (result.legWinner) {
                updateData.legWinner = result.legWinner;
                console.log('[DEBUG] Setting legWinner from result:', result.legWinner);
            }
            console.log('[DEBUG] updateData.legWinner AFTER:', updateData.legWinner);

            if (room.gameMode !== 'CricketGame') {
                if (currentScore === 0) {
                    const player = playerToUpdate;
                    updateData.checkoutQuery = {
                        player,
                        score,
                        startScore: scoreBeforeThrow
                    };
                } else if (inFinishRange && currentScore > 1) {
                    updateData.doubleAttemptsQuery = {
                        type: 'attempts',
                        playerId: userId,
                        question: 'Versuche auf Doppel?',
                        options: ['0', '1', '2', '3'],
                        score,
                        startScore: scoreBeforeThrow
                    };
                    console.log('[DEBUG] Setting doubleAttemptsQuery (attempts):', updateData.doubleAttemptsQuery);
                } else if (currentScore < 0 || currentScore === 1) {
                    updateData.doubleAttemptsQuery = {
                        type: 'bust',
                        playerId: userId,
                        question: 'Versuche auf Doppel vor Überwerfen?',
                        options: ['0', '1', '2', '3'],
                        score,
                        startScore: scoreBeforeThrow
                    };
                    console.log('[DEBUG] Setting doubleAttemptsQuery (bust):', updateData.doubleAttemptsQuery);
                }
            }

            updateData.lastThrow = { playerId: userId, score };
            updateData.dartsThrownInTurn = result.dartsThrownInTurn || 0;

            if (updateData.checkoutQuery || updateData.doubleAttemptsQuery) {
                updateData.winner = null;
                updateData.gameStatus = 'active';
            }

            room.gameState = {
                ...room.gameState,
                ...updateData,
                doubleAttemptsQuery: updateData.doubleAttemptsQuery !== undefined ? updateData.doubleAttemptsQuery : room.gameState?.doubleAttemptsQuery || null,
                checkoutQuery: updateData.checkoutQuery !== undefined ? updateData.checkoutQuery : room.gameState?.checkoutQuery || null,
                gameOptions: room.gameOptions,
                whoStarts: room.whoStarts,
                hostId: room.hostId
            };
            console.log('[DEBUG] Emitting game-state-update with:', {
                legWinner: updateData.legWinner,
                doubleAttemptsQuery: updateData.doubleAttemptsQuery,
                checkoutQuery: updateData.checkoutQuery ? 'set' : 'null'
            });
            io.to(roomId).emit('game-state-update', updateData);

            console.log('[DEBUG] LEG WON CONDITION CHECK:', {
                hasLegWinner: !!result.legWinner,
                gameStatus: updateData.gameStatus,
                shouldEmit: result.legWinner && updateData.gameStatus !== 'finished'
            });

            if (result.legWinner && updateData.gameStatus !== 'finished') {
                console.log('[DEBUG] LEG WON EVENT EMITTING:', result.legWinner);
                const legWinnerPlayer = updateData.players?.find(p => p.id === result.legWinner);
                const nextPlayerIndex = (updateData.currentPlayerIndex + 1) % updateData.players.length;
                const nextPlayer = updateData.players?.[nextPlayerIndex];
                console.log('[DEBUG] legWinnerPlayer:', legWinnerPlayer?.name, 'nextPlayer:', nextPlayer?.name);
                io.to(roomId).emit('leg-won', {
                    legWinner: result.legWinner,
                    legWinnerPlayer,
                    nextPlayer,
                    nextPlayerIndex
                });
            } else {
                console.log('[DEBUG] LEG WON EVENT NOT EMITTED - condition not met');
            }
        } catch (error) {
            console.error(`[UNDO] Fehler:`, error);
            socket.emit('gameError', { error: 'Interner Serverfehler beim Rückgängigmachen.' });
        }
    });

    socket.on('checkout-selection', (data) => {
        const { roomId, dartCount } = data;
        const room = state.rooms.find(r => r.id === roomId);
        if (!room || !room.game) return;

        const actualDartsUsed = parseInt(dartCount, 10);
        const playerIdx = room.game.currentPlayerIndex;
        const player = room.players[playerIdx];

        const previousLegsWon = JSON.parse(JSON.stringify(room.game.legsWon || {}));

        if (actualDartsUsed === 0) {
            console.log('[DEBUG] Checkout rejected (0): keeping currentPlayerIndex at', room.game.currentPlayerIndex);
            if (room.game.setCheckoutDarts) {
                room.game.setCheckoutDarts(null);
            }
        } else {
            if (player) {
                player.dartsThrown = (player.dartsThrown - 3) + actualDartsUsed;

                const startScore = parseInt(room.gameOptions.startingScore, 10) || 501;
                const pointsScored = startScore;
                if (player.dartsThrown > 0) {
                    player.avg = (pointsScored / (player.dartsThrown / 3)).toFixed(2);
                }

                player.doublesHit = (player.doublesHit || 0) + 1;
                player.doublesThrown = (player.doublesThrown || 0) + 1;

                if (player.lastScore > (player.highestFinish || 0)) {
                    player.highestFinish = player.lastScore;
                }
            }

            if (room.game.setCheckoutDarts) {
                room.game.setCheckoutDarts(dartCount);
            }
        }

        if (player?.id) {
            room.game.checkWinCondition(player.id);
            updateBestLegAfterLegEnd(room, previousLegsWon);
        }

        const updateData = createFullGameStateUpdate(room);
        const payload = { ...updateData, checkoutQuery: null, doubleAttemptsQuery: null };
        room.gameState = payload;
        io.to(room.id).emit('game-state-update', payload);
    });

    socket.on('double-attempts-response', (data) => {
        console.log('[BUST-HANDLER-START] double-attempts-response received with:', data);
        const { roomId, userId, response, queryType, score, startScore } = data;
        const room = state.rooms.find(r => r.id === roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === userId);
        if (!player) return;

        let hitsToAdd = 0;
        let attemptsToAdd = 0;

        if (queryType === 'checkout') {
            const actualDartsUsed = parseInt(response) + 1;
            player.dartsThrown = (player.dartsThrown - 3) + actualDartsUsed;

            const startScoreGame = parseInt(room.gameOptions.startingScore, 10) || 501;
            const pointsScored = startScoreGame;
            if (player.dartsThrown > 0) {
                player.avg = (pointsScored / (player.dartsThrown / 3)).toFixed(2);
            }
            hitsToAdd = 1;
            attemptsToAdd = 1;

            if (score > (player.highestFinish || 0)) {
                player.highestFinish = score;
            }
        } else if (queryType === 'attempts' || queryType === 'bust') {
            hitsToAdd = 0;
            attemptsToAdd = parseInt(response);
        }

        player.doublesHit = (player.doublesHit || 0) + hitsToAdd;
        player.doublesThrown = (player.doublesThrown || 0) + attemptsToAdd;


        const updateData = createFullGameStateUpdate(room);

        if (room.gameState) {
            delete room.gameState.doubleAttemptsQuery;
            delete room.gameState.checkoutQuery;
        }

        room.gameState = { ...room.gameState, ...updateData };
        console.log('[DEBUG] Emitting after double-attempts:', { currentPlayerIndex: updateData.currentPlayerIndex, player: updateData.players?.[updateData.currentPlayerIndex]?.name });
        io.to(roomId).emit('game-state-update', { ...updateData, checkoutQuery: null, doubleAttemptsQuery: null });
    });
}

module.exports = registerGameplayEvents;
