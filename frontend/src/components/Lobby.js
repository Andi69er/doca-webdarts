import React, { useState, useEffect, useRef, useCallback, memo, Component } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext'; // HIER WAR DER FEHLER - JETZT KORRIGIERT
import gameModes from '../gameModes';
import OnlineUsers from './OnlineUsers';
import './Lobby.css';

// Error Boundary für Lobby-Rendering-Fehler
class LobbyErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Lobby Rendering Error:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="lobby-container">
                    <header className="lobby-header">
                        <h1 className="lobby-title">Fehler in der Lobby</h1>
                        <button onClick={() => window.location.reload()} className="lobby-button">
                            Seite neu laden
                        </button>
                    </header>
                </div>
            );
        }
        return this.props.children;
    }
}

const Lobby = memo(() => {
    // KORREKTUR: Wir nutzen den Hook, nicht den Context direkt
    const { socket, socketConnected } = useSocket(); 
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [roomName, setRoomName] = useState('');
    const [playerCount, setPlayerCount] = useState('single'); // Einzel / Doppel
    const [gameMode, setGameMode] = useState('X01Game'); // x01, cricket
    const [startingScore, setStartingScore] = useState('501');
    const [sets, setSets] = useState('0');
    const [legs, setLegs] = useState('1');
    const [winType, setWinType] = useState('firstTo'); // Best Of / First to
    const [winNumber, setWinNumber] = useState('1');
    const [inMode, setInMode] = useState('single'); // Single In / Double In
    const [outMode, setOutMode] = useState('double'); // Single Out / Double Out / Master Out
    const [whoStartsUI, setWhoStartsUI] = useState('random'); // Ich, Gegner, ausbullen
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [finishedGames, setFinishedGames] = useState([]);
    const [selectedGame, setSelectedGame] = useState(null);
    const [runningGames, setRunningGames] = useState([]);
    
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (socket) {
            socket.on('updateRooms', (updatedRooms) => setRooms(updatedRooms));
            socket.on('updateOnlineUsers', (count) => setOnlineUsers(count));
            socket.on('receiveMessage', (message) => setMessages(prev => [...prev, message]));
            socket.on('roomCreated', ({ roomId }) => navigate(`/game/${roomId}`));
            socket.on('finishedGames', (games) => setFinishedGames(games));
            socket.on('runningGames', (games) => setRunningGames(games));

            socket.emit('getRooms');
            socket.emit('getOnlineUsers');
            socket.emit('getFinishedGames');
            socket.emit('getRunningGames');

            return () => {
                socket.off('updateRooms');
                socket.off('updateOnlineUsers');
                socket.off('receiveMessage');
                socket.off('roomCreated');
                socket.off('finishedGames');
                socket.off('runningGames');
            };
        }
    }, [socket, navigate]);
    
    useEffect(() => {
        if (gameMode && gameModes[gameMode]) {
            const currentMode = gameModes[gameMode];
            if (gameMode === 'X01Game') {
                setStartingScore('501');
                setSets('0');
                setLegs(winType === 'firstTo' ? '1' : '3');
            } else if (gameMode === 'CricketGame') {
                setWinType('firstTo'); // Default for Cricket
                setSets('0');
                setLegs('1');
            }
            setWhoStartsUI(currentMode.whoStarts ? currentMode.whoStarts[0] : 'random');
        }
    }, [gameMode, winType]);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        try {
            const winNumber = winType === 'firstTo' ? 1 : 3;
            let gameOptions = {};
            if (gameMode === 'X01Game') {
                gameOptions = {
                    startingScore: parseInt(startingScore),
                    sets: parseInt(sets),
                    legs: legs === 'unlimited' ? -1 : parseInt(legs),
                    outMode,
                    inMode,
                    winType,
                    winNumber,
                    length: { type: winType, value: winNumber },
                };
            } else if (gameMode === 'CricketGame') {
                gameOptions = {
                    sets: parseInt(sets),
                    legs: legs === 'unlimited' ? -1 : parseInt(legs),
                    winType,
                    winNumber,
                    length: { type: winType, value: winNumber },
                };
            }
            
            const roomData = {
                roomName,
                gameMode,
                whoStarts: whoStartsUI,
                gameOptions
            };
            
            if (socket) {
                socket.emit('createRoom', roomData);
            } else {
                alert('Keine Verbindung zum Server.');
            }
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    };

    const handleJoinRoom = useCallback((roomId) => {
        if (socket) {
            socket.emit('joinRoom', { roomId });
            navigate(`/game/${roomId}`);
        }
    }, [socket, navigate]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && socket) {
            socket.emit('sendMessage', { text: newMessage });
            setNewMessage('');
        }
    };

    return (
        <LobbyErrorBoundary>
            <div className="lobby-container">
                <header className="lobby-header">
                    <h1 className="lobby-title">DOCA Lobby</h1>
                    <p className="lobby-subtitle">Online: {onlineUsers}</p>
                    <p>Status: <span className={socketConnected ? 'status-connected' : 'status-disconnected'}>{socketConnected ? 'Verbunden' : 'Verbinde...'}</span></p>
                </header>

                <div className="lobby-content">
                    <OnlineUsers />

                    <section className="lobby-section">
                        <h3>Raum erstellen</h3>
                        <form onSubmit={handleCreateRoom} className="room-form">
                            <div className="form-row">
                                <label>Raumname:</label>
                                <input
                                    type="text"
                                    className="lobby-input"
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="Raumname"
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <label>Wer:</label>
                                <select className="lobby-input" value={playerCount} onChange={(e) => setPlayerCount(e.target.value)}>
                                    <option value="single">Einzel</option>
                                    <option value="double">Doppel</option>
                                </select>
                            </div>

                            <div className="form-row">
                                <label>Was:</label>
                                <select className="lobby-input" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                                    <option value="X01Game">x01</option>
                                    <option value="CricketGame">Cricket</option>
                                </select>
                            </div>

                            {gameMode === 'X01Game' && (
                                <div className="form-row">
                                    <label>Anfangswert:</label>
                                    <select className="lobby-input" value={startingScore} onChange={(e) => setStartingScore(e.target.value)}>
                                        <option value="301">301</option>
                                        <option value="401">401</option>
                                        <option value="501">501</option>
                                        <option value="701">701</option>
                                        <option value="801">801</option>
                                        <option value="901">901</option>
                                        <option value="1001">1001</option>
                                    </select>
                                </div>
                            )}

                            {gameMode !== 'CricketGame' && (
                                <>
                                    <div className="form-row">
                                        <label>Best Of / First to:</label>
                                        <select className="lobby-input" value={winType} onChange={(e) => setWinType(e.target.value)}>
                                            <option value="firstTo">First to</option>
                                            <option value="bestOf">Best Of</option>
                                        </select>
                                    </div>

                                    <div className="form-row">
                                        <label>Modus Start:</label>
                                        <select className="lobby-input" value={inMode} onChange={(e) => setInMode(e.target.value)}>
                                            <option value="single">Single In</option>
                                            <option value="double">Double In</option>
                                        </select>
                                    </div>

                                    <div className="form-row">
                                        <label>Modus Ende:</label>
                                        <select className="lobby-input" value={outMode} onChange={(e) => setOutMode(e.target.value)}>
                                            <option value="single">Single Out</option>
                                            <option value="double">Double Out</option>
                                            <option value="master">Master Out</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="form-row">
                                <label>Wer beginnt:</label>
                                <select className="lobby-input" value={whoStartsUI} onChange={(e) => setWhoStartsUI(e.target.value)}>
                                    <option value="me">Ich</option>
                                    <option value="opponent">Gegner</option>
                                    <option value="random">Ausbullen</option>
                                </select>
                            </div>

                            <button type="submit" className="lobby-button" disabled={!socketConnected}>Erstellen</button>
                        </form>
                    </section>

                    <section className="lobby-section">
                        <h3>Erstellte Räume</h3>
                        <ul className="lobby-list">
                            {rooms.map(room => {
                                const formatRoomInfo = () => {
                                    let info = '';
                                    if (room.gameMode === 'X01Game' || room.gameMode === 'x01') {
                                        const score = room.gameOptions?.startingScore || '501';
                                        const inMode = room.gameOptions?.inMode === 'double' ? 'Di' : 'Si';
                                        const outMode = room.gameOptions?.outMode === 'double' ? 'Do' : 
                                                      room.gameOptions?.outMode === 'master' ? 'Mo' : 'So';
                                        const sets = room.gameOptions?.sets || 0;
                                        const legs = room.gameOptions?.legs || 1;
                                        const winType = room.gameOptions?.winType === 'bestOf' ? 'Bo' : 'Ft';
                                        const winNumber = room.gameOptions?.winNumber || 1;
                                        const whoStarts = room.whoStarts === 'random' ? 'ausbullen' :
                                                         room.whoStarts === 'me' ? 'Ich' : 'Gegner';
                                        info = `${score} ${inMode}/${outMode} ${winType} ${winNumber} Sets:${sets} Legs:${legs} – ${whoStarts}`;
                                    } else if (room.gameMode === 'CricketGame' || room.gameMode === 'cricket') {
                                        const inMode = room.gameOptions?.inMode === 'double' ? 'Di' : 'Si';
                                        const outMode = room.gameOptions?.outMode === 'double' ? 'Do' : 
                                                      room.gameOptions?.outMode === 'master' ? 'Mo' : 'So';
                                        const sets = room.gameOptions?.sets || 0;
                                        const legs = room.gameOptions?.legs || 1;
                                        const winType = room.gameOptions?.winType === 'bestOf' ? 'Bo' : 'Ft';
                                        const whoStarts = room.whoStarts === 'random' ? 'ausbullen' : 
                                                         room.whoStarts === 'me' ? 'Ich' : 'Gegner';
                                        info = `Cricket ${inMode}/${outMode} ${winType} Sets:${sets} Legs:${legs} – ${whoStarts}`;
                                    }
                                    return info;
                                };
                                return (
                                    <li key={room.id} className="lobby-list-item">
                                        <div className="room-info">
                                            <span className="room-name">{room.name || room.roomName}</span>
                                            <span className="room-mode">{formatRoomInfo()}</span>
                                            <span className="room-players">({room.players?.length || 0}/2)</span>
                                        </div>
                                        <button onClick={() => handleJoinRoom(room.id)} className="lobby-button" disabled={!socketConnected || (room.players?.length || 0) >= 2}>Beitreten</button>
                                    </li>
                                );
                            })}
                            {rooms.length === 0 && <p>Keine Räume offen.</p>}
                        </ul>
                    </section>

                    <section className="lobby-section">
                        <h3>Laufende Spiele</h3>
                        <ul className="lobby-list">
                            {runningGames.map(game => (
                                <li key={game.id} className="lobby-list-item">
                                    <span>{game.roomName || game.name} - {game.players?.map(p => p.name).join(' vs ') || 'Spiel läuft'}</span>
                                    <button onClick={() => navigate(`/game/${game.id}`)} className="lobby-button" disabled={!socketConnected}>Zuschauen</button>
                                </li>
                            ))}
                            {runningGames.length === 0 && <p>Keine laufenden Spiele.</p>}
                        </ul>
                    </section>

                    <section className="lobby-section">
                        <h3>Letzte Spiele</h3>
                        <ul className="lobby-list">
                            {finishedGames.map(game => (
                                <li key={game.id} className="lobby-list-item">
                                    <span>{game.roomName || game.name} - {game.winner?.name || 'Unbekannt'} gewann</span>
                                    <button onClick={() => setSelectedGame(game)} className="lobby-button">Details</button>
                                </li>
                            ))}
                            {finishedGames.length === 0 && <p>Keine beendeten Spiele.</p>}
                        </ul>
                    </section>
                </div>

                <div className="chat-container">
                    <h3>Allgemeiner Lobby-Chat</h3>
                    <div className="messages-area">
                        {messages.map((msg, index) => (
                            <div key={index} className="message">
                                <strong>{msg.user || 'System'}:</strong> {msg.text}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="message-form">
                        <input
                            type="text"
                            className="lobby-input"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Nachricht eingeben..."
                        />
                        <button type="submit" className="lobby-button" disabled={!socketConnected}>Send</button>
                    </form>
                </div>

                {selectedGame && (
                    <div className="game-details-popup" onClick={() => setSelectedGame(null)}>
                        <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                            <h3>Spieldetails</h3>
                            <div className="game-details">
                                <p><strong>Raum:</strong> {selectedGame.roomName || selectedGame.name}</p>
                                <p><strong>Modus:</strong> {selectedGame.gameMode || 'Unbekannt'}</p>
                                <p><strong>Gewinner:</strong> {selectedGame.winner?.name || 'Unbekannt'}</p>
                                <p><strong>Spieler:</strong> {selectedGame.players?.map(p => p.name).join(' vs ') || 'Unbekannt'}</p>
                                {selectedGame.gameOptions && (
                                    <>
                                        {selectedGame.gameOptions.startingScore && <p><strong>Startwert:</strong> {selectedGame.gameOptions.startingScore}</p>}
                                        <p><strong>Sets:</strong> {selectedGame.gameOptions.sets || 0}</p>
                                        <p><strong>Legs:</strong> {selectedGame.gameOptions.legs || 1}</p>
                                    </>
                                )}
                                {selectedGame.finishedAt && <p><strong>Beendet:</strong> {new Date(selectedGame.finishedAt).toLocaleString('de-DE')}</p>}
                            </div>
                            <button className="lobby-button" onClick={() => setSelectedGame(null)}>Schließen</button>
                        </div>
                    </div>
                )}
            </div>
        </LobbyErrorBoundary>
    );
});

export default Lobby;