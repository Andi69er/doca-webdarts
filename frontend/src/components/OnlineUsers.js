import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import './OnlineUsers.css';

function OnlineUsers() {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [loggedInUsers, setLoggedInUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Get initial online users count
    socket.emit('getOnlineUsers');

    // Listen for online users updates
    const handleOnlineUsersUpdate = (count) => {
      setOnlineUsers(count);
    };

    const handleLoggedInUsersUpdate = (users) => {
      setLoggedInUsers(users);
    };

    socket.on('updateOnlineUsers', handleOnlineUsersUpdate);
    socket.on('loggedInUsers', handleLoggedInUsersUpdate);

    // Cleanup
    return () => {
      socket.off('updateOnlineUsers', handleOnlineUsersUpdate);
      socket.off('loggedInUsers', handleLoggedInUsersUpdate);
    };
  }, [socket]);

  return (
    <div className="online-users">
      <h3>Online Users: {onlineUsers}</h3>
      {loggedInUsers.length > 0 && (
        <div className="logged-in-list">
          <h4>Angemeldete DOCA User:</h4>
          <ul>
            {loggedInUsers.map((user, index) => (
              <li key={index} className="user-item">
                <span className="user-name">{user.name}</span>
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
