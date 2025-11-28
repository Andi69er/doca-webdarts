import React, { useState, useEffect, useRef } from 'react';

function GameChat({ socket, roomId, user, messages = [] }) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = () => {
    if (message.trim()) {
      if (!socket || !socket.connected) {
        console.error('DEBUG GameChat: Socket not connected or not available');
        return;
      }
      console.log('DEBUG GameChat: sendMessage called, socket connected:', socket.connected);
      console.log('DEBUG GameChat: Emitting sendMessage event:', {
        roomId,
        message: message.trim(),
        userId: user.id,
        userName: user.name,
        timestamp: Date.now()
      });
      socket.emit('sendMessage', {
        roomId,
        message: message.trim(),
        userId: user.id,
        userName: user.name,
        timestamp: Date.now()
      });
      setMessage('');
    } else {
      console.error('DEBUG GameChat: Message is empty, not sending');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return ''; // Return an empty string for invalid dates
    }
    return date.toLocaleTimeString();
  };

  return (
    <div className="game-chat">
      <div className="chat-input">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
      <div className="chat-messages">
        {(messages || []).map((msg, index) => (
          <div key={index} className="chat-message">
            <span className="message-sender">{msg.userName}:</span> {msg.message}
            <span className="message-time">{formatTimestamp(msg.timestamp)}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default GameChat;
