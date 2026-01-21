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
                    <button onClick={() => window.location.reload()} className="action-button">
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

    // --- STATE VARIABLES ---
    const [rooms, setRooms] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState(0);
    const [roomName, setRoomName] = useState('');
    
    // Spieloptionen
    const [gameMode, setGameMode] = useState('X01Game'); 
    const [startingScore, setStartingScore] = useState('501');
    const [sets, setSets] = useState('0');
    const [legs, setLegs] = useState('1');
    
    // Erweiterte Regeln
    const [winType, setWinType] = useState('firstTo'); 
    const [inMode, setInMode] = useState('single'); 
    const [outMode, setOutMode] = useState('double'); 
    const [whoStartsUI, setWhoStartsUI] = useState('random'); 
    const [teamMode, setTeamMode] = useState('singles');
    const [teamAName, setTeamAName] = useState('Team A');
    const [teamBName, setTeamBName] = useState('Team B');

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
            console.log('\n=== FRONTEND CREATE ROOM START ===');
            console.log('1. UI State values:', {
                roomName,
                gameMode,
                whoStartsUI,
                startingScore,
                sets,
                legs,
                winType,
                outMode,
                inMode,
                teamMode,
                teamAName,
                teamBName
            });
            
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
            
            console.log('2. Generated gameOptions:', JSON.stringify(gameOptions, null, 2));
            
            const normalizedTeamMode = teamMode === 'doubles' ? 'doubles' : 'singles';
            const normalizedTeamA = (teamAName || 'Team A').trim() || 'Team A';
            const normalizedTeamB = (teamBName || 'Team B').trim() || 'Team B';

            const roomData = {
                roomName,
                gameMode,
                whoStarts: whoStartsUI,
                gameOptions,
                teamMode: normalizedTeamMode,
                teamAName: normalizedTeamA,
                teamBName: normalizedTeamB
            };
            
            console.log('3. Complete roomData to send:', JSON.stringify(roomData, null, 2));
            console.log('=== FRONTEND CREATE ROOM END ===\n');
            
            if (socket) {
                socket.emit('createRoom', roomData);
            } else {
                alert('Keine Verbindung zum Server.');
            }
        } catch (error) {
            alert('Fehler: ' + error.message);
        }
    };

    const handleJoinRoom = useCallback((roomId, teamKey = null) => {
        if (socket) {
            socket.emit('joinRoom', { roomId, teamKey });
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

    // Helper für Anzeige
    const formatRoomInfo = (room) => {
        let info = '';
        if (room.gameMode === 'X01Game' || room.gameMode === 'x01') {
            const score = room.gameOptions?.startingScore || '501';
            const im = room.gameOptions?.inMode === 'double' ? 'Double In' : 'Single In';
            const om = room.gameOptions?.outMode === 'double' ? 'Double Out' : 
                          room.gameOptions?.outMode === 'master' ? 'Master Out' : 'Single Out';
            const s = room.gameOptions?.sets || 0;
            const l = room.gameOptions?.legs || 1;
            const wt = room.gameOptions?.winType === 'bestOf' ? 'Best Of' : 'First To';
            const start = room.whoStarts === 'random' ? 'Ausbullen' : room.whoStarts === 'me' ? 'Ich' : 'Gegner';
            
            info = `${score} • ${im}/${om} • ${wt} • Sets: ${s}, Legs: ${l} • ${start}`;
        } else if (room.gameMode === 'CricketGame' || room.gameMode === 'cricket') {
            const s = room.gameOptions?.sets || 0;
            const l = room.gameOptions?.legs || 1;
            const wt = room.gameOptions?.winType === 'bestOf' ? 'Best Of' : 'First To';
            const start = room.whoStarts === 'random' ? 'Ausbullen' : room.whoStarts === 'me' ? 'Ich' : 'Gegner';
            info = `Cricket • ${wt} • Sets: ${s}, Legs: ${l} • ${start}`;
        }
        const teamLabel = room.teamMode === 'doubles'
            ? `Teams: ${(room.teamNames?.teamA || 'Team A')} vs ${(room.teamNames?.teamB || 'Team B')}`
            : 'Einzel';
        return info ? `${info} • ${teamLabel}` : teamLabel;
    };

    const getRoomCapacity = (room) => room?.maxPlayers || (room?.teamMode === 'doubles' ? 4 : 2);

    return (
        <LobbyErrorBoundary>
            <div className="lobby-wrapper">
                {/* Header */}
                <header className="lobby-topbar">
                    <div className="brand-area">
                        <h1>🎯 DOCA <span className="highlight">WebDarts Pro</span></h1>
                    </div>
                    
                    <div className="center-title">
                        <h2>LOBBY</h2>
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
                    {/* LINKE SPALTE: User & Chat */}
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
                                    placeholder="Nachricht eingeben..."
                                />
                                <button type="submit" disabled={!socketConnected}>➤</button>
                            </form>
                        </div>
                    </aside>

                    {/* MITTLERE SPALTE: Erstellen & Liste */}
                    <main className="lobby-main">
                        <section className="panel create-room-panel">
                            <div className="panel-header">
                                <h3>🏗️ Raum erstellen</h3>
                            </div>
                            <form onSubmit={handleCreateRoom} className="room-form-grid">
                                {/* Basis Infos */}
                                <div className="form-section full-width">
                                    <div className="input-group">
                                        <label>Raumname</label>
                                        <input
                                            type="text"
                                            value={roomName}
                                            onChange={(e) => setRoomName(e.target.value)}
                                            placeholder="Name des Raums"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-section">
                                    <div className="input-group">
                                        <label>Spielmodus</label>
                                        <select value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
                                            <option value="X01Game">x01</option>
                                            <option value="CricketGame">Cricket</option>
                                        </select>
                                    </div>
                                </div>

                                {/* X01 Spezifisch */}
                                {gameMode === 'X01Game' && (
                                    <>
                                        <div className="form-section">
                                            <div className="input-group">
                                                <label>Anfangswert</label>
                                                <select value={startingScore} onChange={(e) => setStartingScore(e.target.value)}>
                                                    <option value="301">301</option>
                                                    <option value="401">401</option>
                                                    <option value="501">501</option>
                                                    <option value="701">701</option>
                                                    <option value="801">801</option>
                                                    <option value="901">901</option>
                                                    <option value="1001">1001</option>
                                                </select>
                                            </div>
                                        </div>
                                        
                                        {/* Struktur X01 */}
                                        <div className="form-section">
                                            <div className="input-group">
                                                <label>Modus Start</label>
                                                <select value={inMode} onChange={(e) => setInMode(e.target.value)}>
                                                    <option value="single">Single In</option>
                                                    <option value="double">Double In</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-section">
                                            <div className="input-group">
                                                <label>Modus Ende</label>
                                                <select value={outMode} onChange={(e) => setOutMode(e.target.value)}>
                                                    <option value="single">Single Out</option>
                                                    <option value="double">Double Out</option>
                                                    <option value="master">Master Out</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Struktur Allgemein */}
                                <div className="form-section">
                                    <div className="input-group">
                                        <label>Sets</label>
                                        <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="0" />
                                    </div>
                                </div>
                                <div className="form-section">
                                    <div className="input-group">
                                        <label>Legs</label>
                                        <input type="number" value={legs} onChange={(e) => setLegs(e.target.value)} placeholder="1" />
                                    </div>
                                </div>

                                {/* Start-Regeln & WinType (Wieder da!) */}
                                <div className="form-section">
                                    <div className="input-group">
                                        <label>Sieger-Modus</label>
                                        <select value={winType} onChange={(e) => setWinType(e.target.value)}>
                                            <option value="firstTo">First To</option>
                                            <option value="bestOf">Best Of</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="form-section">
                                    <div className="input-group">
                                        <label>Wer beginnt?</label>
                                        <select value={whoStartsUI} onChange={(e) => setWhoStartsUI(e.target.value)}>
                                            <option value="me">Ich</option>
                                            <option value="opponent">Gegner</option>
                                            <option value="random">Ausbullen</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <div className="input-group">
                                        <label>Spieler-Modus</label>
                                        <select value={teamMode} onChange={(e) => setTeamMode(e.target.value)}>
                                            <option value="singles">Einzel (1 vs 1)</option>
                                            <option value="doubles">Doppel (2 vs 2)</option>
                                        </select>
                                    </div>
                                </div>

                                {teamMode === 'doubles' && (
                                    <>
                                        <div className="form-section">
                                            <div className="input-group">
                                                <label>Team A Name</label>
                                                <input
                                                    type="text"
                                                    value={teamAName}
                                                    onChange={(e) => setTeamAName(e.target.value)}
                                                    placeholder="Team A"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-section">
                                            <div className="input-group">
                                                <label>Team B Name</label>
                                                <input
                                                    type="text"
                                                    value={teamBName}
                                                    onChange={(e) => setTeamBName(e.target.value)}
                                                    placeholder="Team B"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                <div className="full-width">
                                    <button type="submit" className="action-button primary-btn" disabled={!socketConnected}>
                                        🚀 Raum erstellen
                                    </button>
                                </div>
                            </form>
                        </section>

                        <section className="panel rooms-list-panel">
                            <h3>🎯 Offene Räume</h3>
                            <div className="scrollable-content">
                                {rooms.length === 0 ? (
                                    <div className="empty-state">Keine Räume offen.</div>
                                ) : (
                                    <div className="rooms-grid">
                                        {rooms.map(room => {
                                            const playerCount = room.players?.length || 0;
                                            const capacity = getRoomCapacity(room);
                                            const isFull = playerCount >= capacity;
                                            const teamLabel = room.teamMode === 'doubles' ? 'Doppel' : 'Einzel';
                                            return (
                                                <div key={room.id} className="room-card">
                                                    <div className="room-card-header">
                                                        <span className="room-title">{room.name || room.roomName}</span>
                                                        <span className="room-badge">{playerCount}/{capacity}</span>
                                                    </div>
                                                    <div className="room-details">
                                                        <div className="room-mode">{teamLabel}</div>
                                                        <div>{formatRoomInfo(room)}</div>
                                                        {room.teamMode === 'doubles' && (
                                                            <div className="room-teams-preview">
                                                                <div className="team-preview-box">
                                                                    <strong>{room.teamNames?.teamA || 'Team A'}:</strong>
                                                                    <div className="team-players-mini">
                                                                        {room.players?.filter(p => room.teamAssignments?.[p.id] === 'teamA').map(p => p.name).join(', ') || 'Leer'}
                                                                    </div>
                                                                </div>
                                                                <div className="team-preview-box">
                                                                    <strong>{room.teamNames?.teamB || 'Team B'}:</strong>
                                                                    <div className="team-players-mini">
                                                                        {room.players?.filter(p => room.teamAssignments?.[p.id] === 'teamB').map(p => p.name).join(', ') || 'Leer'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {room.teamMode === 'doubles' ? (
                                                        <div className="join-actions-doubles">
                                                            <button 
                                                                onClick={() => handleJoinRoom(room.id, 'teamA')} 
                                                                className="join-btn team-a-btn"
                                                                disabled={!socketConnected || isFull || (room.players?.filter(p => room.teamAssignments?.[p.id] === 'teamA').length >= 2)}
                                                            >
                                                                {room.teamNames?.teamA || 'Team A'} beitreten
                                                            </button>
                                                            <button 
                                                                onClick={() => handleJoinRoom(room.id, 'teamB')} 
                                                                className="join-btn team-b-btn"
                                                                disabled={!socketConnected || isFull || (room.players?.filter(p => room.teamAssignments?.[p.id] === 'teamB').length >= 2)}
                                                            >
                                                                {room.teamNames?.teamB || 'Team B'} beitreten
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleJoinRoom(room.id)} 
                                                            className="join-btn"
                                                            disabled={!socketConnected || isFull}
                                                        >
                                                            {isFull ? 'Voll' : 'Beitreten'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </section>
                    </main>

                    {/* RECHTE SPALTE: Laufend & Historie */}
                    <aside className="lobby-sidebar-right">
                        <div className="panel running-panel">
                            <h3>Laufende Spiele</h3>
                            <ul className="simple-list">
                                {runningGames.length === 0 && <li className="empty-item">Keine Spiele aktiv</li>}
                                {runningGames.map(game => (
                                    <li key={game.id} className="list-item clickable" onClick={() => navigate(`/game/${game.id}`)}>
                                        <span className="game-vs">
                                            {game.players?.[0]?.name || '?'} <span className="vs">VS</span> {game.players?.[1]?.name || '?'}
                                        </span>
                                        <div className="game-subtext">{game.roomName || game.name}</div>
                                        <span className="watch-tag">Zuschauen</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="panel history-panel">
                            <h3>🏆 Letzte Spiele</h3>
                            <ul className="simple-list">
                                {finishedGames.length === 0 && <li className="empty-item">Keine Historie</li>}
                                {finishedGames.map(game => (
                                    <li key={game.id} className="list-item clickable" onClick={() => setSelectedGame(game)}>
                                        <div className="winner-row">
                                            <span>👑 {game.winner?.name || 'Unbekannt'}</span>
                                        </div>
                                        <div className="game-subtext">
                                            {game.roomName || game.name} ({game.gameMode})
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </div>

                {/* MODAL FÜR SPIELDETAILS */}
                {selectedGame && (
                    <div className="modal-overlay" onClick={() => setSelectedGame(null)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Spieldetails</h2>
                                <button className="close-btn" onClick={() => setSelectedGame(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <div className="detail-row"><label>Raum:</label> <span>{selectedGame.roomName || selectedGame.name}</span></div>
                                <div className="detail-row"><label>Modus:</label> <span>{selectedGame.gameMode}</span></div>
                                <div className="detail-row"><label>Gewinner:</label> <span className="winner-text">{selectedGame.winner?.name || 'Unbekannt'}</span></div>
                                <div className="detail-row"><label>Spieler:</label> <span>{selectedGame.players?.map(p => p.name).join(' vs ') || 'Unbekannt'}</span></div>
                                {selectedGame.gameOptions && (
                                    <div className="options-block">
                                        {selectedGame.gameOptions.startingScore && <div className="detail-row"><label>Start:</label> <span>{selectedGame.gameOptions.startingScore}</span></div>}
                                        <div className="detail-row"><label>Sets/Legs:</label> <span>{selectedGame.gameOptions.sets || 0} / {selectedGame.gameOptions.legs || 1}</span></div>
                                    </div>
                                )}
                                <div className="detail-row"><label>Datum:</label> <span>{new Date(selectedGame.finishedAt).toLocaleString('de-DE')}</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </LobbyErrorBoundary>
    );
});

export default Lobby;