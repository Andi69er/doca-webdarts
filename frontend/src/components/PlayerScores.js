import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import DartsPerLegTable from './DartsPerLegTable';

const getCheckoutText = (score) => {
    if (score === undefined || score === null) return "";
    if (score > 170 || score < 2) return "";

    const checkouts = {
        170: "T20 T20 BULL", 167: "T20 T19 BULL", 164: "T20 T18 BULL", 161: "T20 T17 BULL",
        160: "T20 T20 D20", 158: "T20 T20 D19", 157: "T19 T20 D20", 156: "T20 T20 D18",
        155: "T20 T19 D20", 154: "T20 T18 D20", 153: "T20 T19 D18", 152: "T20 T20 D16",
        151: "T20 T17 D20", 150: "T20 T18 D18", 149: "T20 T19 D16", 148: "T20 T16 D20",
        147: "T19 T18 D18", 146: "T20 T14 D20", 145: "T20 T15 D20", 144: "T20 T20 D12",
        143: "T20 T17 D16", 142: "T20 T14 D20", 141: "T20 T19 D12", 140: "T20 T20 D10",
        139: "T19 T14 D20", 138: "T20 T18 D12", 137: "T19 T16 D16", 136: "T20 T20 D8",
        135: "T20 T15 D15", 134: "T20 T14 D16", 133: "T20 T19 D8", 132: "T20 T20 D6",
        131: "T20 T13 D16", 130: "T20 T20 D5", 129: "T19 T16 D12", 128: "T20 T20 D4",
        127: "T20 T17 D8", 126: "T19 T19 D6", 125: "T20 T15 D10", 124: "T20 T16 D8",
        123: "T19 T14 D12", 122: "T18 T20 D4", 121: "T20 T15 D8", 120: "T20 20 D20",
        119: "T19 12 D20", 118: "T20 18 D20", 117: "T20 17 D20", 116: "T20 16 D20",
        115: "T20 15 D20", 114: "T20 14 D20", 113: "T20 13 D20", 112: "T20 12 D20",
        111: "T20 11 D20", 110: "T20 10 D20", 109: "T19 12 D20", 108: "T20 8 D20",
        107: "T19 10 D20", 106: "T20 6 D20", 105: "T20 5 D20", 104: "T18 10 D20",
        103: "T19 6 D20", 102: "T20 2 D20", 101: "T17 10 D20", 100: "T20 D20",
        99: "T19 10 D16", 98: "T20 D19", 97: "T19 D20", 96: "T20 D18", 95: "T19 D19",
        94: "T18 D20", 93: "T19 D18", 92: "T20 D16", 91: "T17 D20", 90: "T18 D18",
        89: "T19 D16", 88: "T16 D20", 87: "T17 D18", 86: "T18 D16", 85: "T15 D20",
        84: "T20 D12", 83: "T17 D16", 82: "T14 D20", 81: "T19 D12", 80: "T20 D10",
        79: "T13 D20", 78: "T18 D12", 77: "T19 D10", 76: "T20 D8", 75: "T17 D12",
        74: "T14 D16", 73: "T19 D8", 72: "T12 D18", 71: "T13 D16", 70: "T10 D20",
        69: "T19 D6", 68: "T20 D4", 67: "T17 D8", 66: "T10 D18", 65: "T19 D4",
        64: "T16 D8", 63: "T13 D12", 62: "T10 D16", 61: "T15 D8", 60: "20 D20",
        59: "19 D20", 58: "18 D20", 57: "17 D20", 56: "16 D20", 55: "15 D20",
        54: "14 D20", 53: "13 D20", 52: "12 D20", 51: "11 D20", 50: "10 D20",
        49: "9 D20", 48: "8 D20", 47: "7 D20", 46: "6 D20", 45: "5 D20",
        44: "4 D20", 43: "3 D20", 42: "2 D20", 41: "1 D20", 40: "D20",
        39: "7 D16", 38: "D19", 37: "5 D16", 36: "D18", 35: "3 D16", 34: "D17",
        33: "1 D16", 32: "D16", 31: "15 D8", 30: "D15", 29: "13 D8", 28: "D14",
        27: "19 D4", 26: "D13", 25: "17 D4", 24: "D12", 23: "7 D8", 22: "D11",
        21: "13 D4", 20: "D10", 19: "11 D4", 18: "D9", 17: "9 D4", 16: "D8",
        15: "7 D4", 14: "D7", 13: "5 D4", 12: "D6", 11: "3 D4", 10: "D5",
        9: "1 D4", 8: "D4", 7: "S3 D2", 6: "D3", 5: "S1 D2", 4: "D2",
        3: "S1 D1", 2: "D1"
    };
    return checkouts[score] || "";
};

const PlayerScores = ({ gameState, user, startingPlayerId }) => {
    const { socket } = useSocket();

    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [editingName, setEditingName] = useState('');

    if (!gameState || !gameState.players) return null;

    const players = gameState.players;
    const player1 = players[0];
    const player2 = players[1];

    const handleNameChange = (playerId) => {
        if (editingName.trim().length >= 3 && editingName.trim().length <= 15) {
            if (socket && gameState.id) {
                socket.emit('changePlayerName', {
                    roomId: gameState.id,
                    userId: playerId,
                    newName: editingName
                });
            }
        }
        setEditingPlayerId(null);
    };

    const handleNameKeyDown = (e, playerId) => {
        if (e.key === 'Enter') {
            handleNameChange(playerId);
        } else if (e.key === 'Escape') {
            setEditingPlayerId(null);
        }
    };

    const renderPlayerCard = (player, label, isRightSide = false) => {
        if (!player) {
            return (
                <div className="player-card empty">
                    <h3>{label}</h3>
                    <div className="waiting-text">Warte...</div>
                </div>
            );
        }

const isActive = gameState && 
            gameState.gameStatus === 'active' &&
            gameState.players[gameState.currentPlayerIndex]?.id === player.id;

        // Show starting player indicator before game starts
        const isStartingPlayer = !gameState.gameStatus && startingPlayerId === player.id;
        const isMyPlayer = user && user.id === player.id;
        const isHost = gameState.hostId === user?.id;
        const checkoutText = getCheckoutText(player.score);

        // Ermittle, ob Sets gespielt werden, basierend auf den gameOptions vom Server
        const isSetMode = gameState?.gameOptions?.distance === 'sets';

        const LegsBlock = (
            <div className="legs-section-bild1">
                {isSetMode ? (
                    <>
                        <span className="legs-label-bild1">Sets</span>
                        <span className="legs-count-bild1">{gameState?.gameState?.setsWon?.[player.id] ?? 0}</span>
                    </>
                ) : (
                    <>
                        <span className="legs-label-bild1">Legs</span>
                        <span className="legs-count-bild1">{gameState?.gameState?.legsWon?.[player.id] ?? 0}</span>
                    </>
                )}
            </div>
        );

        // --- Block: Letzter Wurf (Dartscheibe + Punkte) ---
        const LastScoreBlock = (
            <div className="icon-stat-block">
                <span className="icon-stat-icon">🎯</span>
                <span className="icon-stat-value">{player.lastScore || 0}</span>
            </div>
        );

        // --- Block: Anzahl Darts (Pfeil + Zahl) ---
        const DartsThrownBlock = (
            <div className="icon-stat-block">
                <svg className="icon-stat-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.4 19.4L22 22L20.5 23.5L19 22L17.5 23.5L16 22L18.6 19.4C18.6 19.4 19 19 19.4 19.4Z" fill="#ef4444"/>
                    <path d="M22 16L23.5 17.5L22 19L23.5 20.5L22 22L19.4 19.4L22 16Z" fill="#ef4444"/>
                    <path d="M12.8 2.2L2.2 12.8L4 16L11.5 14L10 12.5L20 2.5L21.5 4L19.4 19.4L13.4 13.4L6 14.5L12.8 2.2Z" fill="#cbd5e1"/>
                    <path d="M2.2 12.8L2 16L4 16L12.8 2.2L2.2 12.8Z" fill="#64748b"/>
                </svg>
                <span className="icon-stat-value">{player.dartsThrown || 0}</span>
            </div>
        );

return (
            <div className={`player-card ${isActive ? 'active-player' : ''}`} style={{ 
                border: isActive ? '2px solid yellow' : isStartingPlayer ? '2px solid #4CAF50' : '1px solid #333'
            }}>
                {/* Roter Punkt für aktiven Spieler */}
                {isActive && <div className="active-dot"></div>}
                {isHost && !isMyPlayer && (
                    <button
                        onClick={() => {
                            if (window.confirm(`Möchtest du ${player.name} wirklich aus dem Raum entfernen?`)) {
                                socket.emit('kickPlayer', { roomId: gameState.id, playerIdToKick: player.id });
                            }
                        }}
                        className="kick-player-button"
                    >
                        ✖
                    </button>
                )}
                {isMyPlayer && editingPlayerId === player.id ? (
                    <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleNameChange(player.id)}
                        onKeyDown={(e) => handleNameKeyDown(e, player.id)}
                        autoFocus
                        className="player-name-input"
                    />
                ) : (
                    <h3 
                        className="player-name-title"
                        onClick={() => {
                            if (isMyPlayer) {
                                setEditingPlayerId(player.id);
                                setEditingName(player.name);
                            }
                        }}
                        style={{ cursor: isMyPlayer ? 'pointer' : 'default' }}
                    >{player.name} {isMyPlayer ? '(Du)' : ''}</h3>
                )}

                <div className="score-details-bild1">
                    {isRightSide ? (
                        <>
                            {DartsThrownBlock}
                            {LastScoreBlock}
                        </>
                    ) : LegsBlock}
                    <div className="main-score-wrapper-bild1">
                        <div className="main-score-bild1">{player.score}</div>
                    </div>
                    {isRightSide ? LegsBlock : (
                        <>
                            {LastScoreBlock}
                            {DartsThrownBlock}
                        </>
                    )}
                </div>

                {/* Checkout Anzeige */}
                <div className="checkout-path">{checkoutText}</div>
            </div>
        );
    };

    return (
        <div className="player-scores-container">
            {/* Linker Spieler */}
            <div className="player-score-section">
                {renderPlayerCard(player1, "Player 1", false)}
            </div>

            {/* Mitte: Tabelle */}
            <div className="player-history-section">
                <div className="history-wrapper">
                    <DartsPerLegTable gameState={gameState} />
                </div>
            </div>

            {/* Rechter Spieler */}
            <div className="player-score-section">
                {renderPlayerCard(player2, "Player 2", true)}
            </div>
        </div>
    );
};

export default PlayerScores;