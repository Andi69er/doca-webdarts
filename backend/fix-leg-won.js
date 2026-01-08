 -const fs = require('fs');

let content = fs.readFileSync('socketHandler.js', 'utf-8');

// Finde die leg-won Event Sektion
const oldPattern = `const nextPlayer = updateData.players?.[updateData.currentPlayerIndex];
                    console.log('[DEBUG] legWinnerPlayer:', legWinnerPlayer?.name, 'nextPlayer:', nextPlayer?.name);
                    io.to(roomId).emit('leg-won', {
                        legWinner: result.legWinner,
                        legWinnerPlayer: legWinnerPlayer,
                        nextPlayer: nextPlayer,
                        nextPlayerIndex: updateData.currentPlayerIndex`;

const newPattern = `const nextPlayerIndex = (updateData.currentPlayerIndex + 1) % updateData.players.length;
                    const nextPlayer = updateData.players?.[nextPlayerIndex];
                    console.log('[DEBUG] legWinnerPlayer:', legWinnerPlayer?.name, 'nextPlayer:', nextPlayer?.name);
                    io.to(roomId).emit('leg-won', {
                        legWinner: result.legWinner,
                        legWinnerPlayer: legWinnerPlayer,
                        nextPlayer: nextPlayer,
                        nextPlayerIndex: nextPlayerIndex`;

if (content.includes(oldPattern)) {
    content = content.replace(oldPattern, newPattern);
    fs.writeFileSync('socketHandler.js', content);
    console.log('✅ Erfolgreich gefixt: nextPlayer ist jetzt der nächste Spieler!');
} else {
    console.log('❌ Pattern nicht gefunden - möglicherweise schon gefixt?');
    console.log('Versuche manuelles Checken...');
    if (content.includes('const nextPlayerIndex = (updateData.currentPlayerIndex + 1)')) {
        console.log('✅ Code ist bereits gefixt!');
    }
}
