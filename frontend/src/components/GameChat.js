import React, { useState, useEffect, useRef } from 'react';

function GameChat({ socket, roomId, user, messages }) {
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
      console.log('DEBUG GameChat: Message emitted, clearing input');
      setMessage('');
    } else {
      console.log('DEBUG GameChat: Message is empty, not sending');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="game-chat">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="chat-message">
            <span className="message-sender">{msg.userName}:</span> {msg.message}
            <span className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
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
    </div>
  );
}

export default GameChat;