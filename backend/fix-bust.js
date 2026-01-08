const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'socketHandler.js');
let content = fs.readFileSync(filePath, 'utf-8');

const searchStr = `            const updateData = createFullGameStateUpdate(room);
            
            if (room.gameState) {
                delete room.gameState.doubleAttemptsQuery;
                delete room.gameState.checkoutQuery;
            }

            room.gameState = { ...room.gameState, ...updateData };
            io.to(roomId).emit('game-state-update', { ...updateData, doubleAttemptsQuery: null, checkoutQuery: null });`;

const replaceStr = `            // Nach Bust/Verpasst: nächster Spieler kommt dran (nur bei Bust/Attempts, nicht bei checkout)
            if (queryType === 'bust' || queryType === 'attempts') {
                room.game.currentPlayerIndex = (room.game.currentPlayerIndex + 1) % room.players.length;
            }

            const updateData = createFullGameStateUpdate(room);
            
            if (room.gameState) {
                delete room.gameState.doubleAttemptsQuery;
                delete room.gameState.checkoutQuery;
            }

            room.gameState = { ...room.gameState, ...updateData };
            io.to(roomId).emit('game-state-update', { ...updateData, doubleAttemptsQuery: null, checkoutQuery: null });`;

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content);
    console.log('✅ Spieler wechselt jetzt nach Bust/Verpasst zum nächsten!');
} else {
    console.log('❌ Pattern nicht gefunden');
    console.log('Versuche kürzere Version...');
    
    if (content.includes('io.to(roomId).emit(\'game-state-update\', { ...updateData, doubleAttemptsQuery: null, checkoutQuery: null });')) {
        const idx = content.indexOf('io.to(roomId).emit(\'game-state-update\', { ...updateData, doubleAttemptsQuery: null, checkoutQuery: null });');
        const lineStart = content.lastIndexOf('\n', idx - 100) + 1;
        const context = content.substring(lineStart, idx + 50);
        console.log('Kontext:', context);
    }
}
