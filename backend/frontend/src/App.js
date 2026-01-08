import React, { useEffect, useState } from 'react'; // useEffect und useState hinzugefügt
import io from 'socket.io-client'; // <-- WICHTIG: Socket.IO Client importiert
import logo from './logo.svg';
import './App.css';

// Verbindung zum Backend auf Port 3001 herstellen
const socket = io('http://localhost:3001'); 

function App() {
  // Status-Hook, um die Verbindung zu sehen (optional)
  const [backendStatus, setBackendStatus] = useState('Verbinde mit Backend...');

  useEffect(() => {
    socket.on('connect', () => {
        setBackendStatus('Verbunden mit Backend (3001).');
    });
    
    // *** DER NEUE TEIL FÜR AUTOMATISCHES RELOAD BEI BACKEND-ÄNDERUNG ***
    socket.on('server_reload_trigger', () => {
        console.log('Backend-Änderung von Nodemon erkannt. Seite wird neu geladen.');
        // Erzwingt einen kompletten Neuladen der Seite
        window.location.reload(); 
    });
    // ******************************************************************

    socket.on('disconnect', () => {
        setBackendStatus('Verbindung zum Backend verloren.');
    });

    return () => {
        socket.off('connect');
        socket.off('server_reload_trigger');
        socket.off('disconnect');
    };
  }, []);


  // HINWEIS: Da Sie die Lobby sehen, sollte der Rest Ihres Codes 
  // hier darunter folgen, um die UI zu rendern.
  return (
    <div className="App">
      {/* HIER IST IHR CODE FÜR DIE LOBBY-ANSICHT (Bild 1) */}
      
      {/* Kleiner Status-Indikator (optional) */}
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '5px', background: 'blue', color: 'white', fontSize: '12px' }}>
          Backend Status: {backendStatus}
      </div>

      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
      {/* Hier würde der Rest Ihrer Komponenten gerendert werden */}
    </div>
  );
}

export default App;