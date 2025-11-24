import React, { useState, useEffect, useContext } from 'react'; // useRef entfernt, useContext hinzugefügt
import { Link, useNavigate } from 'react-router-dom'; // useNavigate hinzugefügt
import { SocketContext } from '../contexts/SocketContext'; // DER KORREKTE IMPORT
import './Lobby.css';

function Lobby() {
  const socket = useContext(SocketContext); // HOL DIR DEN SOCKET VOM CONTEXT
  const navigate = useNavigate(); // Hook für die Weiterleitung

  const [rooms, setRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [formData, setFormData] = useState({
    roomName: '',
    gameMode: 'x01',
    startingScore: '501',
    inMode: 'single',
    outMode: 'double',
    distance: 'leg',
    lengthType: 'firstTo',
    lengthValue: 1,
    startingPlayer: 'ich'
  });

  useEffect(() => {
    // Der Socket ist jetzt immer da, wir müssen ihn nicht mehr initialisieren.
    // Wir müssen nur die Event-Listener registrieren.

    socket.on('roomsUpdated', (updatedRooms) => {
      setRooms(updatedRooms);
    });

    socket.on('receiveMessage', (message) => {
      console.log('DEBUG: Received receiveMessage event:', message);
      setChatMessages(prev => [...prev, message]);
    });

    socket.on('onlineUsers', (users) => {
      console.log('DEBUG: Received onlineUsers event:', users);
      setOnlineUsers(users);
    });

    // Wenn ein Raum erstellt wurde UND wir darin sind, leiten wir zum Spiel weiter
    socket.on('roomCreationError', (error) => {
      console.log('DEBUG: Received roomCreationError event:', error);
      alert(`Raum-Erstellung fehlgeschlagen: ${error.message}`);
    });
    socket.on('roomCreated', (room) => {
      console.log('DEBUG: Received roomCreated event:', room);
      // Navigation handled by joinedRoom event
    });
    socket.on('joinedRoom', (data) => {
        console.log('DEBUG: Received joinedRoom event:', data);
        if(data.success) {
            console.log('DEBUG: Navigation to game page:', `/game/${data.room.id}`);
            navigate(`/game/${data.room.id}`);
        } else {
            alert(`Beitritt fehlgeschlagen: ${data.message}`);
        }
    });

    // Beim ersten Laden der Komponente die aktuellen Daten vom Server holen
    console.log('DEBUG: Emitting getRooms event');
    socket.emit('getRooms');
    console.log('DEBUG: Emitting getOnlineUsers event');
    socket.emit('getOnlineUsers');

    // Aufräumfunktion: Die Listener entfernen, wenn die Komponente verlassen wird
    return () => {
      socket.off('roomsUpdated');
      socket.off('receiveMessage');
      socket.off('onlineUsers');
      socket.off('joinedRoom');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, [socket, navigate]); // navigate als Abhängigkeit hinzugefügt

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!formData.roomName.trim()) return;

    console.log('DEBUG: Raum-Erstellungs-Button wurde geklickt');
    console.log('DEBUG: Form data:', formData);
    console.log('DEBUG: Socket connected:', socket.connected);
    console.log('DEBUG: Socket ID:', socket.id);

    const roomData = {
      name: formData.roomName,
      gameMode: formData.gameMode,
      maxPlayers: 2, // Fester Wert, da das UI nur für 2 Spieler ausgelegt ist
      gameOptions: {
        startingScore: parseInt(formData.startingScore),
        inMode: formData.inMode,
        outMode: formData.outMode,
        distance: formData.distance,
        length: { type: formData.lengthType, value: parseInt(formData.lengthValue) },
        startingPlayer: formData.startingPlayer
      }
    };
    console.log('DEBUG: Emitting createRoom event with data:', roomData);
    socket.emit('createRoom', roomData);
  };

  const handleJoinRoom = (roomId) => {
    console.log('DEBUG: Handle join room clicked for roomId:', roomId);
    // Wir leiten nicht mehr direkt weiter, sondern warten auf das 'joinedRoom' Event
    console.log('DEBUG: Emitting joinRoom event:', { roomId });
    socket.emit('joinRoom', { roomId });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageData = {
      message: newMessage,
      timestamp: new Date().toISOString()
    };
    socket.emit('sendMessage', messageData);
    setNewMessage('');
  };

  // Hilfsfunktionen bleiben gleich
  const getGameModeLabel = (mode, options = {}) => { /*...*/ return mode; };
  const getDistanceLabel = (distance = 'leg', length = {type: 'firstTo', value: 1}) => { /*...*/ return distance; };

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h1 className="lobby-title">DOCA Webdarts Lobby</h1>
      </header>

      <div className="lobby-content">
        <div className="lobby-section">
          <h3>Raum erstellen</h3>
            <form onSubmit={handleCreateRoom}>
              {/* Das Formular bleibt unverändert */}
              <div className="form-group"><label>Raumname:</label><input type="text" className="lobby-input" name="roomName" value={formData.roomName} onChange={handleFormChange} required /></div>
              <div className="form-group"><label>Spielmodus:</label><select className="lobby-input" name="gameMode" value={formData.gameMode} onChange={handleFormChange}><option value="x01">x01</option><option value="cricket">Cricket</option></select></div>
              {formData.gameMode === 'x01' && (<div className="form-group"><label>Startpunktzahl:</label><select className="lobby-input" name="startingScore" value={formData.startingScore} onChange={handleFormChange}><option value="301">301</option><option value="501">501</option><option value="701">701</option><option value="1001">1001</option></select></div>)}
              <div className="form-group"><label>Einwurf:</label><select className="lobby-input" name="inMode" value={formData.inMode} onChange={handleFormChange}><option value="single">Single In</option><option value="double">Double In</option></select></div>
              <div className="form-group"><label>Auswurf:</label><select className="lobby-input" name="outMode" value={formData.outMode} onChange={handleFormChange}><option value="single">Single Out</option><option value="double">Double Out</option><option value="master">Master Out</option></select></div>
              <div className="form-group"><label>Distanz:</label><select className="lobby-input" name="distance" value={formData.distance} onChange={handleFormChange}><option value="leg">Leg</option><option value="set">Set</option></select></div>
              <div className="form-group"><label>Länge:</label><select className="lobby-input" name="lengthType" value={formData.lengthType} onChange={handleFormChange}><option value="firstTo">First to</option><option value="bestOf">Best of</option></select><input type="number" className="lobby-input" name="lengthValue" value={formData.lengthValue} onChange={handleFormChange} min="1" max="10"/></div>
              <div className="form-group"><label>Anfangspieler:</label><select className="lobby-input" name="startingPlayer" value={formData.startingPlayer} onChange={handleFormChange}><option value="ich">Ich</option><option value="gegner">Gegner</option><option value="ausbullen">Ausbullen</option></select></div>
              <button type="submit" className="lobby-button">Raum erstellen</button>
            </form>
          </div>
        </div>

        <div className="lobby-section">
          <h3>Verfügbare Räume</h3>
          <ul className="lobby-list">
            {rooms.length === 0 ? (<li className="lobby-list-item">Keine Räume verfügbar</li>) : (rooms.map(room => (
                <li key={room.id} className="lobby-list-item">
                  <div className="room-info">
                    <span className="player-name">{room.name}</span>
                    <span className="player-status">{getGameModeLabel(room.gameMode, room.gameOptions)} - {getDistanceLabel(room.gameOptions?.distance, room.gameOptions?.length)} | Spieler: {room.players.length}/{room.maxPlayers || 2}</span>
                  </div>
                  <Link to={`/game/${room.id}`} className="lobby-button" onClick={() => handleJoinRoom(room.id)}>Beitreten</Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="lobby-section">
          <h3>Allgemeiner Chat</h3>
          <div className="chat-messages">{chatMessages.map((msg, index) => (<div key={index} className="chat-message"><span>{msg.message}</span></div>))}</div>
          <form onSubmit={handleSendMessage} className="chat-form"><input type="text" className="lobby-input" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Nachricht..."/><button type="submit" className="lobby-button">Senden</button></form>
        </div>

        <div className="lobby-section">
          <h3>Online-Benutzer</h3>
          <ul className="lobby-list">{onlineUsers.map(user => (<li key={user.id} className="lobby-list-item"><span className="player-name">{user.name}</span></li>))}</ul>
        </div>
      </div>
    </div>
  );
}

export default Lobby;