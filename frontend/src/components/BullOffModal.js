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

        socket.on('bull-off-restart', (data) => {
            // Reset state when sudden death phase starts
            setThrows({
                [players[0]?.id]: [0, 0, 0],
                [players[1]?.id]: [0, 0, 0]
            });
            setSubmitted({
                [players[0]?.id]: false,
                [players[1]?.id]: false
            });
            setWinner(null);
        });

        return () => {
            socket.off('bull-off-throws');
            socket.off('bull-off-restart');
        };
    }, [socket, players]);

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

        // Jeder Spieler wirft 3 Darts - wer als erster Bull (25 oder 50) trifft gewinnt
        for (let i = 0; i < 3; i++) {
            const p1Hit = p1Throws[i] === 25 || p1Throws[i] === 50; // Bull-Treffer
            const p2Hit = p2Throws[i] === 25 || p2Throws[i] === 50; // Bull-Treffer

            if (p1Hit && !p2Hit) {
                // P1 trifft Bull, P2 nicht -> P1 gewinnt
                return players[0]?.id;
            }
            if (p2Hit && !p1Hit) {
                // P2 trifft Bull, P1 nicht -> P2 gewinnt
                return players[1]?.id;
            }
            if (p1Hit && p2Hit) {
                // BEIDE treffen Bull -> wer hat den höheren Wert?
                if (p1Throws[i] > p2Throws[i]) {
                    // P1 hat höheren Wert (50 > 25) -> P1 gewinnt
                    return players[0]?.id;
                } else if (p2Throws[i] > p1Throws[i]) {
                    // P2 hat höheren Wert (50 > 25) -> P2 gewinnt
                    return players[1]?.id;
                }
                // Beide haben gleichen Wert (beide 25 oder beide 50) -> weiter zum nächsten Dart
            }
            // Wenn beide verfehlen, weiter zum nächsten Dart
        }

        // Wenn nach 3 Darts noch unentschieden (beide haben gleiche Treffer oder beide missen)
        // Dann geht es in die Sudden Death Phase - weiter werfen bis jemand gewinnt
        return null; // Unentschieden - beide müssen erneut werfen
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
                <p>Jeder Spieler wirft 3 Darts auf das Bullseye. Wer als erster Bull (25 oder 50) trifft, beginnt das Spiel!</p>

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
                        <p><strong>Unentschieden!</strong></p>
                        <p>Beide Spieler haben das gleiche Ergebnis. Es geht in die Sudden Death Phase!</p>
                        <p>Wer als erster Bull trifft, gewinnt das Ausbullen.</p>
                        <button 
                            className="retry-bull-off-btn"
                            onClick={() => {
                                // Reset throws für Sudden Death Phase
                                setThrows({
                                    [players[0]?.id]: [0, 0, 0],
                                    [players[1]?.id]: [0, 0, 0]
                                });
                                setSubmitted({ 
                                    [players[0]?.id]: false, 
                                    [players[1]?.id]: false 
                                });
                                setWinner(null);
                                
                                // Informiere Backend über Neustart der Sudden Death Phase
                                if (socket && roomId) {
                                    socket.emit('bull-off-restart', {
                                        roomId,
                                        playerId: user.id
                                    });
                                }
                            }}
                        >
                            Sudden Death - Erneut werfen
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
