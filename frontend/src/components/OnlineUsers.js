import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import './OnlineUsers.css';

function OnlineUsers() {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Get initial online users count
    socket.emit('getConnectedUsers');

    // Listen for online users updates
    const handleOnlineUsersUpdate = (count) => {
      setOnlineUsers(count);
    };

    const handleConnectedUsersUpdate = (users) => {
      setConnectedUsers(users || []);
    };

    socket.on('updateOnlineUsers', handleOnlineUsersUpdate);
    socket.on('connectedUsers', handleConnectedUsersUpdate);

    // Cleanup
    return () => {
      socket.off('updateOnlineUsers', handleOnlineUsersUpdate);
      socket.off('connectedUsers', handleConnectedUsersUpdate);
    };
  }, [socket]);

  return (
    <div className="online-users">
      <h3>Online Users: {onlineUsers}</h3>
      {connectedUsers.length > 0 && (
        <div className="connected-users-list">
          <h4>Verbundene Spieler:</h4>
          <ul>
            {connectedUsers.map((user, index) => (
              <li key={index} className="user-item">
                <span className="user-name">{user.name || `User_${user.id?.substring(0, 4)}`}</span>
                <span className="user-status">Online</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default OnlineUsers;
