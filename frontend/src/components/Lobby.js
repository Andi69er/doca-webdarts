import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import gameModes from '../gameModes';
import './Lobby.css';

const Lobby = memo(() => {
    console.log('DEBUG: Lobby component rendered');
    console.log('DEBUG: gameModes imported:', gameModes);
    console.log('DEBUG: Object.keys(gameModes):', Object.keys(gameModes));
    const { socket, socketConnected } = useSocket(); // NEU: socketConnected hier abrufen
    const [rooms, setRooms] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [roomName, setRoomName] = useState('');
    const [gameMode, setGameMode] = useState(Object.keys(gameModes)[0]);
    const [startingScore, setStartingScore] = useState('501');
    const [sets, setSets] = useState('0');
    const [legs, setLegs] = useState('1');
    const [outMode, setOutMode] = useState('double');
    const [inMode, setInMode] = useState('single');
    const [winType, setWinType] = useState('firstTo');
    const [winNumber, setWinNumber] = useState('1');
    const [whoStartsUI, setWhoStartsUI] = useState('random');
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (socket) {
            socket.on('updateRooms', (updatedRooms) => {
                setRooms(updatedRooms);
            });
    
            socket.on('updateOnlineUsers', (count) => {
                setOnlineUsers(count);
            });
    
            socket.on('receiveMessage', (message) => {
                setMessages(prevMessages => [...prevMessages, message]);
            });
    
            socket.on('roomCreated', ({ roomId }) => {
                navigate(`/game/${roomId}`);
            });
    
            socket.emit('getRooms');
            socket.emit('getOnlineUsers');
    
            return () => {
                socket.off('updateRooms');
                socket.off('updateOnlineUsers');
                socket.off('receiveMessage');
                socket.off('roomCreated');
            };
        }
    }, [socket, navigate]);
    
    useEffect(() => {
        if (gameMode) {
            const currentMode = gameModes[gameMode];
            if (currentMode) {
                // Set defaults based on game mode
                if (gameMode === 'X01Game') {
                    setStartingScore('501');
                    setSets('0');
                    setLegs('1');
                    setOutMode('double');
                    setInMode('single');
                    setWinType('firstTo');
                    setWinNumber('1');
                } else if (gameMode === 'CricketGame') {
                    setStartingScore(''); // Cricket doesn't have starting score
                    setSets('0');
                    setLegs('1');
                    setOutMode('double');
                    setInMode('single');
                    setWinType('firstTo');
                    setWinNumber('1');
                } else if (gameMode === 'BullOffGame') {
                    setStartingScore(''); // BullOff doesn't have these
                    setSets('');
                    setLegs('');
                    setOutMode('');
                    setInMode('');
                    setWinType('');
                    setWinNumber('');
                }
                setWhoStartsUI(currentMode.whoStarts[0] || 'random');
            }
        }
    }, [gameMode]);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        let gameOptions = {};
        if (gameMode === 'X01Game') {
            const parsedStartingScore = parseInt(startingScore);
            if (isNaN(parsedStartingScore)) {
                alert("Ungültiger Starting Score");
                return;
            }
            gameOptions = {
                startingScore: parsedStartingScore,
                sets: parseInt(sets),
                legs: legs === 'unlimited' ? -1 : parseInt(legs),
                outMode,
                inMode,
                winType,
                winNumber: parseInt(winNumber),
            };
        } else if (gameMode === 'CricketGame') {
            gameOptions = {
                sets: parseInt(sets),
                legs: legs === 'unlimited' ? -1 : parseInt(legs),
                winType,
                winNumber: parseInt(winNumber),
            };
        } else if (gameMode === 'BullOffGame') {
            gameOptions = {};
        }
        const roomData = {
            roomName,
            gameMode,
            whoStarts: whoStartsUI,
            gameOptions
        };
        console.log('DEBUG: roomData to emit:', roomData);
        if (socket && socketConnected) {
            socket.emit('createRoom', roomData);
        } else {
            console.error('Socket not connected, cannot create room.');
            alert('Verbindung zum Server wird hergestellt, bitte kurz warten.');
        }
    };

    const handleJoinRoom = useCallback((roomId) => {
        if (socket && socketConnected) {
            socket.emit('joinRoom', { roomId });
            navigate(`/game/${roomId}`);
        } else {
            console.error('Socket not connected, cannot join room.');
            alert('Verbindung zum Server wird hergestellt, bitte kurz warten.');
        }
    }, [socket, socketConnected, navigate]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() && socket && socketConnected) {
            const messageData = { text: newMessage };
            socket.emit('sendMessage', messageData);
            setNewMessage('');
        } else {
              console.error('Socket not connected or message empty, cannot send message.');
        }
    };

    // Component renders

    return (
        <div className="lobby-container">
            <header className="lobby-header">
                <h1 className="lobby-title">Willkommen in der Lobby</h1>
                <p className="lobby-subtitle">Online: {onlineUsers}</p>
                  {/* NEU: Visueller Indikator für Verbindungsstatus */}
                <p>Server-Status: <span className={socketConnected ? 'status-connected' : 'status-disconnected'}>{socketConnected ? 'Verbunden' : 'Verbinde...'}</span></p>
            </header>

            <div className="lobby-content">
                <section className="lobby-section">
                    <h3>Neuen Spielraum erstellen</h3>
                    <form onSubmit={handleCreateRoom}>
                        <input
                            type="text"
                            className="lobby-input"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="Name des Raums"
                            required
                        />
                        <label>Game Mode:</label>
                        <select className="lobby-input" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                            {Object.keys(gameModes).map(mode => (
                                <option key={mode} value={mode}>{gameModes[mode].name}</option>
                            ))}
                        </select>
                        {gameMode === 'X01Game' && (
                            <>
                                <label>Starting Score:</label>
                                <select className="lobby-input" value={startingScore} onChange={(e) => setStartingScore(e.target.value)}>
                                    <option value="301">301</option>
                                    <option value="401">401</option>
                                    <option value="501">501</option>
                                    <option value="601">601</option>
                                    <option value="701">701</option>
                                    <option value="801">801</option>
                                    <option value="901">901</option>
                                    <option value="1001">1001</option>
                                </select>
                                <label>Sets:</label>
                                <select className="lobby-input" value={sets} onChange={(e) => setSets(e.target.value)}>
                                    {Array.from({ length: 11 }, (_, i) => (
                                        <option key={i} value={i.toString()}>{i}</option>
                                    ))}
                                </select>
                                <label>Legs:</label>
                                <select className="lobby-input" value={legs} onChange={(e) => setLegs(e.target.value)}>
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <option key={i + 1} value={(i + 1).toString()}>{i + 1}</option>
                                    ))}
                                    <option value="unlimited">Unlimited</option>
                                </select>
                                <label>Out Mode:</label>
                                <select className="lobby-input" value={outMode} onChange={(e) => setOutMode(e.target.value)}>
                                    <option value="single">Single Out</option>
                                    <option value="double">Double Out</option>
                                    <option value="master">Master Out</option>
                                </select>
                                <label>In Mode:</label>
                                <select className="lobby-input" value={inMode} onChange={(e) => setInMode(e.target.value)}>
                                    <option value="single">Single In</option>
                                    <option value="double">Double In</option>
                                    <option value="master">Master In</option>
                                </select>
                            </>
                        )}
                        {(gameMode === 'X01Game' || gameMode === 'CricketGame') && (
                            <>
                                <label>Win Type:</label>
                                <select className="lobby-input" value={winType} onChange={(e) => setWinType(e.target.value)}>
                                    <option value="bestOf">Best of</option>
                                    <option value="firstTo">First to</option>
                                </select>
                                <label>Win Number:</label>
                                <select className="lobby-input" value={winNumber} onChange={(e) => setWinNumber(e.target.value)}>
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <option key={i + 1} value={(i + 1).toString()}>{i + 1}</option>
                                    ))}
                                </select>
                            </>
                        )}
                        <label>Who Starts:</label>
                        <select className="lobby-input" value={whoStartsUI} onChange={(e) => setWhoStartsUI(e.target.value)}>
                            <option value="Player">Player</option>
                            <option value="Opponent">Opponent</option>
                            <option value="Bull off">Bull off</option>
                        </select>
                        <button type="submit" className="lobby-button">Raum erstellen</button>
                    </form>
                </section>

                <section className="lobby-section">
                    <h3>Verfügbare Räume</h3>
                    <ul className="lobby-list">
                        {rooms.map(room => (
                            <li key={room.id} className="lobby-list-item">
                                <span className="player-name">{room.name} ({room.players.length}/{room.maxPlayers}) - {gameModes[room.gameMode]?.name || 'Unbekannt'}</span>
                                {/* NEU: Button wird deaktiviert, wenn keine Verbindung besteht */}
                                <button onClick={() => handleJoinRoom(room.id)} className="lobby-button" disabled={!socketConnected}>Beitreten</button>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            <div className="chat-container">
                <h2>Lobby Chat</h2>
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
                      {/* NEU: Button wird deaktiviert, wenn keine Verbindung besteht */}
                    <button type="submit" className="lobby-button" disabled={!socketConnected}>Senden</button>
                </form>
            </div>
        </div>
    );
});

export default Lobby;