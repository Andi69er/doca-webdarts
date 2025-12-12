import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Lobby from './components/Lobby';
import Game from './components/Game';
import Login from './components/Login';
// Der Pfad wurde korrigiert, um auf den Unterordner /contexts zu verweisen
import { SocketProvider } from './contexts/SocketContext';
import './App.css';

function App() {
  return (
    // Die gesamte App wird mit dem SocketContext "umwickelt",
    // damit alle Komponenten Zugriff auf den Socket haben.
    <SocketProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Lobby />} />
            <Route path="/game/:roomId" element={<Game />} />
          </Routes>
        </div>
      </BrowserRouter>
    </SocketProvider>
  );
}

export default App;