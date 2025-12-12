import React, { useState, useEffect, useRef } from 'react';

const GameChat = ({ socket, roomId, user, messages }) => {
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef(null);

    // --- STYLES ---
    const styles = {
        wrapper: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            backgroundColor: '#161621',
            borderLeft: '1px solid #333',  // Linie Links
            borderRight: '1px solid #333', // Linie Rechts (NEU HINZUGEFÜGT)
            overflow: 'hidden'
        },
        header: {
            padding: '15px',
            textAlign: 'center',
            color: '#ffd700',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            borderBottom: '1px solid #333',
            backgroundColor: '#1f1f2e'
        },
        messagesArea: {
            flex: 1,
            padding: '15px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)'
        },
        inputArea: {
            padding: '15px',
            backgroundColor: '#1f1f2e',
            borderTop: '1px solid #333',
            display: 'flex',
            gap: '10px'
        },
        input: {
            flex: 1,
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #444',
            backgroundColor: '#2a2a3e',
            color: 'white',
            outline: 'none',
            fontSize: '0.95rem'
        },
        button: {
            padding: '0 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1.2rem',
            transition: 'background 0.2s'
        },
        messageBubble: (isMe) => ({
            maxWidth: '85%',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            alignSelf: isMe ? 'flex-end' : 'flex-start',
            backgroundColor: isMe ? '#2e7d32' : '#333',
            color: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }),
        senderName: {
            fontSize: '0.75rem',
            color: '#aaa',
            marginBottom: '2px',
            display: 'block'
        },
        emptyText: {
            color: '#666',
            textAlign: 'center',
            marginTop: '20px',
            fontStyle: 'italic'
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim() && socket) {
            const msgData = {
                roomId,
                userId: user.id,
                userName: user.name || 'Gast',
                text: message,
                timestamp: new Date().toISOString()
            };
            socket.emit('sendMessage', msgData);
            setMessage('');
        }
    };

    return (
        <div style={styles.wrapper}>
            <div style={styles.header}>
                Spiele Chat
            </div>

            <div style={styles.messagesArea}>
                {messages && messages.length > 0 ? (
                    messages.map((msg, index) => {
                        const isMe = msg.userId === user?.id;
                        return (
                            <div key={index} style={styles.messageBubble(isMe)}>
                                {!isMe && <span style={styles.senderName}>{msg.userName}</span>}
                                <span>{msg.text}</span>
                            </div>
                        );
                    })
                ) : (
                    <div style={styles.emptyText}>Noch keine Nachrichten...</div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form style={styles.inputArea} onSubmit={sendMessage}>
                <input
                    type="text"
                    placeholder="Nachricht schreiben..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={styles.input}
                />
                <button type="submit" style={styles.button}>
                    ➤
                </button>
            </form>
        </div>
    );
};

export default GameChat;