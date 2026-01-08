const BOGEY_SCORES = new Set([169, 168, 166, 165, 163, 162, 159]);

function createFullGameStateUpdate(room) {
    if (!room || !room.game) return null;
    const internalState = room.game.getGameState();

    const updatedPlayers = room.players.map((p, idx) => ({
        ...p,
        score: internalState.scores[p.id],
        avg: p.avg || "0.00",
        dartsThrown: p.dartsThrown || 0,
        bestLeg: p.bestLeg || null,
        highestFinish: p.highestFinish || 0,
        doublesHit: p.doublesHit || 0,
        doublesThrown: p.doublesThrown || 0,
        isActive: internalState.currentPlayerIndex === idx
    }));

    let winner = null;
    if (internalState.winner) {
        winner = updatedPlayers.find(p => p.id === internalState.winner);
    }

    return {
        ...internalState,
        currentPlayerIndex: room.game.currentPlayerIndex,
        players: updatedPlayers,
        winner,
        gameStatus: internalState.winner ? 'finished' : 'active',
        turns: internalState.turns || [],
        legsWon: room.game.legsWon,
        setsWon: room.game.setsWon,
        gameOptions: room.gameOptions
    };
}

function updateBestLegAfterLegEnd(room, previousLegsWon) {
    if (!room || !room.game) return;

    const currentLegsWon = room.game.legsWon || {};

    room.players.forEach(player => {
        const prevLegs = previousLegsWon?.[player.id] || 0;
        const currentLegs = currentLegsWon[player.id] || 0;

        if (currentLegs > prevLegs) {
            const legDartsThrown = player.dartsThrown || 0;
            if (!player.bestLeg || (legDartsThrown > 0 && legDartsThrown < player.bestLeg)) {
                player.bestLeg = legDartsThrown;
            }
        }
    });
}

function canCheckoutFrom(score) {
    if (score > 170) return false;
    return !BOGEY_SCORES.has(score);
}

module.exports = {
    createFullGameStateUpdate,
    updateBestLegAfterLegEnd,
    canCheckoutFrom
};
