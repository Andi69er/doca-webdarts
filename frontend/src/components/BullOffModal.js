import React, { useState, useEffect } from 'react';
import './BullOffModal.css';

const BullOffModal = ({ isOpen, onClose, players, onBullOffComplete, socket, roomId, user }) => {
    const [throws, setThrows] = useState({
        [players[0]?.id]: [0, 0, 0],
        [players[1]?.id]: [0, 0, 0]
    });
    const [submitted, setSubmitted] = useState({
        [players[0]?.id]: false,
        [players[1]?.id]: false
    });
    const [winner, setWinner] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal closes
            setThrows({
                [players[0]?.id]: [0, 0, 0],
                [players[1]?.id]: [0, 0, 0]
            });
            setSubmitted({
                [players[0]?.id]: false,
                [players[1]?.id]: false
            });
            setWinner(null);
        }
    }, [isOpen, players]);

    useEffect(() => {
        if (!socket) return;

        socket.on('bull-off-throws', (data) => {
            setThrows(prev => ({
                ...prev,
                [data.playerId]: data.throws
            }));
            setSubmitted(prev => ({
                ...prev,
                [data.playerId]: true
            }));
        });

        return () => {
            socket.off('bull-off-throws');
        };
    }, [socket]);

    useEffect(() => {
        // Check for winner when both players have submitted
        if (submitted[players[0]?.id] && submitted[players[1]?.id]) {
            const winnerId = determineWinner();
            setWinner(winnerId);
        }
    }, [submitted, throws, players]);

    const determineWinner = () => {
        const p1Throws = throws[players[0]?.id];
        const p2Throws = throws[players[1]?.id];

        for (let i = 0; i < 3; i++) {
            const p1Hit = p1Throws[i] > 0;
            const p2Hit = p2Throws[i] > 0;

            if (p1Hit && !p2Hit) return players[0]?.id;
            if (p2Hit && !p1Hit) return players[1]?.id;
            // If both hit or both miss, continue to next dart
        }

        // If still tied after 3 darts, sudden death - but for now, return null to indicate tie
        // In a real implementation, you might want to continue until someone wins
        return null;
    };

    const handleThrowChange = (playerId, dartIndex, value) => {
        const numValue = parseInt(value, 10);
        if (![0, 25, 50].includes(numValue)) return;

        setThrows(prev => ({
            ...prev,
            [playerId]: prev[playerId].map((t, i) => i === dartIndex ? numValue : t)
        }));
    };

    const handleSubmit = () => {
        if (socket && roomId) {
            socket.emit('bull-off-submit', {
                roomId,
                playerId: user.id,
                throws: throws[user.id]
            });
            setSubmitted(prev => ({
                ...prev,
                [user.id]: true
            }));
        }
    };

    const handleConfirmWinner = () => {
        if (winner) {
            onBullOffComplete(winner);
            onClose();
        }
    };

    if (!isOpen) return null;

    const bothSubmitted = submitted[players[0]?.id] && submitted[players[1]?.id];
    const isMyTurn = !submitted[user.id];

    return (
        <div className="bull-off-modal-overlay">
            <div className="bull-off-modal">
                <h2>Ausbullen - Wer beginnt?</h2>
                <p>Jeder Spieler wirft 3 Darts auf das Bullseye. Der erste Treffer (25 oder 50) gewinnt!</p>

                <div className="bull-off-players">
                    {players.map(player => (
                        <div key={player.id} className="bull-off-player">
                            <h3>{player.name}</h3>
                            <div className="throws-grid">
                                {[0, 1, 2].map(dartIndex => (
                                    <div key={dartIndex} className="throw-input">
                                        <label>Dart {dartIndex + 1}:</label>
                                        {player.id === user.id ? (
                                            <select
                                                value={throws[player.id][dartIndex]}
                                                onChange={(e) => handleThrowChange(player.id, dartIndex, e.target.value)}
                                                disabled={submitted[player.id]}
                                            >
                                                <option value={0}>0 (Miss)</option>
                                                <option value={25}>25 (Single Bull)</option>
                                                <option value={50}>50 (Bullseye)</option>
                                            </select>
                                        ) : (
                                            <span className="opponent-throw">
                                                {submitted[player.id] ? throws[player.id][dartIndex] : '?'}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {submitted[player.id] && <div className="submitted-check">✓ Eingereicht</div>}
                        </div>
                    ))}
                </div>

                {isMyTurn && (
                    <button
                        className="submit-throws-btn"
                        onClick={handleSubmit}
                        disabled={submitted[user.id]}
                    >
                        Würfe einreichen
                    </button>
                )}

                {bothSubmitted && !winner && (
                    <div className="tie-message">
                        Unentschieden! Beide Spieler müssen erneut werfen.
                        <button onClick={() => {
                            setSubmitted({ [players[0]?.id]: false, [players[1]?.id]: false });
                        }}>
                            Erneut werfen
                        </button>
                    </div>
                )}

                {winner && (
                    <div className="winner-announcement">
                        <h3>{players.find(p => p.id === winner)?.name} gewinnt das Ausbullen!</h3>
                        <button className="confirm-winner-btn" onClick={handleConfirmWinner}>
                            Spiel starten
                        </button>
                    </div>
                )}

                <button className="close-modal-btn" onClick={onClose}>Abbrechen</button>
            </div>
        </div>
    );
};

export default BullOffModal;
