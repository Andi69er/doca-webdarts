import React, { useState, useEffect, useRef, useCallback, memo, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
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
        this.setState({ error: error, errorInfo: errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="lobby-error-container">
                    <h1>Fehler in der Lobby</h1>
                    <button onClick={() => window.location.reload()} className="lobby-button">
                        Seite neu laden
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const Lobby = memo(() => {
    const { socket, socketConnected } = useSocket();
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [roomName, setRoomName] = useState('');
    const [gameMode, setGameMode] = useState('X01Game');
    const [startingScore, setStartingScore] = useState('501');
    const [sets, setSets] = useState('0');
    const [legs, setLegs] = useState('1');
    const [winType, setWinType] = useState('firstTo');
    const [inMode, setInMode] = useState('single');
    const [outMode, setOutMode] = useState('double');
    const [whoStartsUI, setWhoStartsUI] = useState('random');
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
                setWinType('firstTo');
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

    // Helper für Raumbeschreibung
    const formatRoomInfo = (room) => {
        if (room.gameMode === 'X01Game' || room.gameMode === 'x01') {
            const score = room.gameOptions?.startingScore || '501';
            const inMode = room.gameOptions?.inMode === 'double' ? 'DO' : 'SI'; // Kurzform
            const outMode = room.gameOptions?.outMode === 'double' ? 'DO' : 
                          room.gameOptions?.outMode === 'master' ? 'MO' : 'SO';
            return `X01 (${score}) • ${inMode}/${outMode} • Sets: ${room.gameOptions?.sets} Legs: ${room.gameOptions?.legs}`;
        } 
        return `Cricket • Sets: ${room.gameOptions?.sets} Legs: ${room.gameOptions?.legs}`;
    };

    return (
        <LobbyErrorBoundary>
            <div className="lobby-wrapper">
                {/* Header Area */}
                <header className="lobby-topbar">
                    <div className="logo-area">
                        <h1>DOCA <span className="highlight">Lobby</span></h1>
                    </div>
                    <div className="status-area">
                       <div className="status-badge">
                            <span className="dot"></span> {onlineUsers} Online
                       </div>
                       <div className={`connection-badge ${socketConnected ? 'connected' : 'disconnected'}`}>
                            {socketConnected ? 'Verbunden' : 'Verbinde...'}
                       </div>
                    </div>
                </header>

                <div className="lobby-grid">
                    {/* LEFT COLUMN: Social (Users & Chat) */}
                    <aside className="lobby-sidebar-left">
                        <div className="panel user-panel">
                            <h3>👥 Online ({onlineUsers})</h3>
                            <div className="scrollable-content user-list-container">
                                <OnlineUsers />
                            </div>
                        </div>

                        <div className="panel chat-panel">
                            <h3>💬 Lobby Chat</h3>
                            <div className="messages-area">
                                {messages.map((msg, index) => (
                                    <div key={index} className="chat-message">
                                        <span className="chat-user">{msg.user || 'System'}:</span>
                                        <span className="chat-text">{msg.text}</span>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <form onSubmit={handleSendMessage} className="chat-input-area">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Nachricht..."
                                />
                                <button type="submit" disabled={!socketConnected}>➤</button>
                            </form>
                        </div>
                    </aside>

                    {/* CENTER COLUMN: Create & Play */}
                    <main className="lobby-main">
                        <section className="panel create-room-panel">
                            <div className="panel-header">
                                <h3>⚡ Schnelles Spiel starten</h3>
                            </div>
                            <form onSubmit={handleCreateRoom} className="compact-form">
                                <div className="form-grid">
                                    <div className="input-group">
                                        <label>Raumname</label>
                                        <input
                                            type="text"
                                            value={roomName}
                                            onChange={(e) => setRoomName(e.target.value)}
                                            placeholder="z.B. Darts Arena"
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Modus</label>
                                        <select value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                                            <option value="X01Game">X01</option>
                                            <option value="CricketGame">Cricket</option>
                                        </select>
                                    </div>
                                    
                                    {gameMode === 'X01Game' && (
                                        <>
                                            <div className="input-group">
                                                <label>Score</label>
                                                <select value={startingScore} onChange={(e) => setStartingScore(e.target.value)}>
                                                    <option value="301">301</option>
                                                    <option value="501">501</option>
                                                    <option value="701">701</option>
                                                </select>
                                            </div>
                                            <div className="input-group">
                                                <label>Check Out</label>
                                                <select value={outMode} onChange={(e) => setOutMode(e.target.value)}>
                                                    <option value="single">Single Out</option>
                                                    <option value="double">Double Out</option>
                                                    <option value="master">Master Out</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    <div className="input-group small">
                                        <label>Sets</label>
                                        <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
                                    </div>
                                    <div className="input-group small">
                                        <label>Legs</label>
                                        <input type="number" value={legs} onChange={(e) => setLegs(e.target.value)} />
                                    </div>
                                </div>
                                
                                <button type="submit" className="action-button primary-btn" disabled={!socketConnected}>
                                    Raum erstellen
                                </button>
                            </form>
                        </section>

                        <section className="panel rooms-list-panel">
                            <h3>🎯 Offene Räume</h3>
                            <div className="scrollable-content">
                                {rooms.length === 0 ? (
                                    <div className="empty-state">Keine offenen Räume. Erstelle einen!</div>
                                ) : (
                                    <div className="rooms-grid">
                                        {rooms.map(room => (
                                            <div key={room.id} className="room-card">
                                                <div className="room-card-header">
                                                    <span className="room-title">{room.name || room.roomName}</span>
                                                    <span className="room-badge">{room.players?.length || 0}/2</span>
                                                </div>
                                                <div className="room-details">
                                                    {formatRoomInfo(room)}
                                                </div>
                                                <button 
                                                    onClick={() => handleJoinRoom(room.id)} 
                                                    className="join-btn"
                                                    disabled={!socketConnected || (room.players?.length || 0) >= 2}
                                                >
                                                    Beitreten
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    </main>

                    {/* RIGHT COLUMN: Info & History */}
                    <aside className="lobby-sidebar-right">
                        <div className="panel running-panel">
                            <h3>🔥 Live Spiele</h3>
                            <ul className="simple-list">
                                {runningGames.length === 0 && <li className="empty-item">Keine Spiele aktiv</li>}
                                {runningGames.map(game => (
                                    <li key={game.id} className="list-item clickable" onClick={() => navigate(`/game/${game.id}`)}>
                                        <span className="game-vs">
                                            {game.players?.[0]?.name || '?'} <span className="vs">VS</span> {game.players?.[1]?.name || '?'}
                                        </span>
                                        <span className="watch-tag">Zuschauen</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="panel history-panel">
                            <h3>🏆 Letzte Ergebnisse</h3>
                            <ul className="simple-list">
                                {finishedGames.length === 0 && <li className="empty-item">Keine Historie</li>}
                                {finishedGames.map(game => (
                                    <li key={game.id} className="list-item clickable" onClick={() => setSelectedGame(game)}>
                                        <div className="winner-row">
                                            <span>👑 {game.winner?.name || 'Unbekannt'}</span>
                                        </div>
                                        <div className="game-subtext">
                                            {game.roomName || game.name}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </div>

                {/* Modal for Game Details */}
                {selectedGame && (
                    <div className="modal-overlay" onClick={() => setSelectedGame(null)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Spielbericht</h2>
                                <button className="close-btn" onClick={() => setSelectedGame(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <div className="detail-row">
                                    <label>Gewinner:</label>
                                    <span className="winner-text">{selectedGame.winner?.name}</span>
                                </div>
                                <div className="detail-row">
                                    <label>Raum:</label>
                                    <span>{selectedGame.roomName}</span>
                                </div>
                                <div className="detail-row">
                                    <label>Modus:</label>
                                    <span>{selectedGame.gameMode}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </LobbyErrorBoundary>
    );
});

export default Lobby;