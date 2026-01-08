const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'socketHandler.js');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix: Popups behalten alte Werte statt sofort auf null zu setzen
const oldPattern = `                    doubleAttemptsQuery: updateData.doubleAttemptsQuery || null, // Explizit null wenn nicht gesetzt
                    checkoutQuery: updateData.checkoutQuery || null, // Explizit null wenn nicht gesetzt`;

const newPattern = `                    doubleAttemptsQuery: updateData.doubleAttemptsQuery !== undefined ? updateData.doubleAttemptsQuery : room.gameState?.doubleAttemptsQuery || null,
                    checkoutQuery: updateData.checkoutQuery !== undefined ? updateData.checkoutQuery : room.gameState?.checkoutQuery || null,`;

if (content.includes(oldPattern)) {
    content = content.replace(oldPattern, newPattern);
    fs.writeFileSync(filePath, content);
    console.log('✅ Popups bleiben jetzt länger sichtbar!');
} else {
    console.log('❌ Pattern nicht gefunden');
    
    // Versuche mit kürzeren Pattern
    if (content.includes('doubleAttemptsQuery: updateData.doubleAttemptsQuery || null,')) {
        console.log('Versuche kürzeres Pattern...');
        const alt = 'doubleAttemptsQuery: updateData.doubleAttemptsQuery || null,';
        const neu = 'doubleAttemptsQuery: updateData.doubleAttemptsQuery !== undefined ? updateData.doubleAttemptsQuery : room.gameState?.doubleAttemptsQuery || null,';
        content = content.replace(alt, neu);
        
        const alt2 = 'checkoutQuery: updateData.checkoutQuery || null,';
        const neu2 = 'checkoutQuery: updateData.checkoutQuery !== undefined ? updateData.checkoutQuery : room.gameState?.checkoutQuery || null,';
        content = content.replace(alt2, neu2);
        
        fs.writeFileSync(filePath, content);
        console.log('✅ Popups bleiben jetzt länger sichtbar (kurzes Pattern)!');
    }
}
