import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import gameModes from '../gameModes';
import './Lobby.css';

const Lobby = () => {
    const { socket, socketConnected } = useSocket(); // NEU: socketConnected hier abrufen
    const [rooms, setRooms] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [roomName, setRoomName] = useState('');
    const [gameMode, setGameMode] = useState(Object.keys(gameModes)[0]);
    const [variantIndex, setVariantIndex] = useState(0);
    const [whoStarts, setWhoStarts] = useState('');
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
                console.log('DEBUG: Received roomCreated event:', { roomId });
                navigate(`/game/${roomId}`);
            });
    
            console.log('DEBUG: Emitting getRooms event');
            socket.emit('getRooms');
            console.log('DEBUG: Emitting getOnlineUsers event');
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
                setVariant(currentMode.variants[0] || '');
                setDistance(currentMode.distances[0] || '');
                setWhoStarts(currentMode.whoStarts[0] || '');
            }
        }
    }, [gameMode]);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        const selectedVariant = gameModes[gameMode].variants[variantIndex];
        const roomData = {
            roomName,
            gameMode,
            whoStarts,
            gameOptions: selectedVariant
        };
        console.log('DEBUG: Raum-Erstellungs-Button wurde geklickt');
        console.log('DEBUG: Form data:', roomData);
        console.log('DEBUG: Socket connected:', socketConnected); // Loggt den neuen Status
        console.log('DEBUG: Socket ID:', socket ? socket.id : 'undefined');
        if (socket && socketConnected) {
              console.log('DEBUG: Emitting createRoom event with data:', roomData);
            socket.emit('createRoom', roomData);
        } else {
            console.error('Socket not connected, cannot create room.');
            alert('Verbindung zum Server wird hergestellt, bitte kurz warten.');
        }
    };

    const handleJoinRoom = (roomId) => {
        console.log(`DEBUG: Handle join room clicked for roomId: ${roomId}`);
        if (socket && socketConnected) {
            console.log('DEBUG: Emitting joinRoom event:', { roomId });
            socket.emit('joinRoom', { roomId });
            navigate(`/game/${roomId}`);
        } else {
            console.error('Socket not connected, cannot join room.');
            alert('Verbindung zum Server wird hergestellt, bitte kurz warten.');
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        console.log('DEBUG Lobby: handleSendMessage called, newMessage:', newMessage);
        console.log('DEBUG Lobby: Socket connected:', socketConnected); // Loggt den neuen Status
        console.log('DEBUG Lobby: Socket ID:', socket ? socket.id : 'undefined');
        if (newMessage.trim() && socket && socketConnected) {
            const messageData = { text: newMessage };
            console.log('DEBUG Lobby: About to emit sendMessage with data:', messageData);
            socket.emit('sendMessage', messageData);
            console.log('DEBUG Lobby: Emitted sendMessage');
            setNewMessage('');
            console.log('DEBUG Lobby: Message sent and input cleared');
        } else {
             console.error('Socket not connected or message empty, cannot send message.');
        }
    };

    console.log('DEBUG: Lobby component rendering');
    console.log('DEBUG: Current rooms:', rooms.length);
    console.log('DEBUG: Online users:', onlineUsers);
    console.log('DEBUG: Lobby component rendering');
    console.log('DEBUG: Current rooms:', rooms.length);
    console.log('DEBUG: Online users:', onlineUsers);

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
                        <select className="lobby-input" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                            {Object.keys(gameModes).map(mode => (
                                <option key={mode} value={mode}>{gameModes[mode].name}</option>
                            ))}
                        </select>
                        <select className="lobby-input" value={variantIndex} onChange={(e) => setVariantIndex(parseInt(e.target.value))}>
                            {gameModes[gameMode].variants.map((variant, index) => (
                                <option key={index} value={index}>{variant.label}</option>
                            ))}
                        </select>
                        <select className="lobby-input" value={whoStarts} onChange={(e) => setWhoStarts(e.target.value)}>
                            {gameModes[gameMode].whoStarts.map(who => (
                                <option key={who} value={who}>{who.charAt(0).toUpperCase() + who.slice(1)}</option>
                            ))}
                        </select>
                        {/* NEU: Button wird deaktiviert, wenn keine Verbindung besteht */}
                        <button type="submit" className="lobby-button" disabled={!socketConnected}>Raum erstellen</button>
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
};

export default Lobby;