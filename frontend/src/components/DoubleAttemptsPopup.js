import React from 'react';

const DoubleAttemptsPopup = ({ query, onSelect }) => {
    if (!query) return null;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h2 style={{ color: '#ffd700', margin: '0 0 20px 0', fontSize: '28px' }}>
                    {query.type === 'bust' ? 'ÜBERWORFEN! 💥' : 'FINISH VERPASST! 😅'}
                </h2>
                <h3 style={{ color: 'white', margin: '0 0 30px 0', fontWeight: 'normal', fontSize: '18px' }}>
                    {query.question}
                </h3>
                
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                    {query.options.map((option, index) => (
                        <button 
                            key={index}
                            onClick={() => onSelect(index)}
                            style={buttonStyle}
                            onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- STYLES (Identisch zum CheckoutPopup für Konsistenz) ---

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    backdropFilter: 'blur(5px)'
};

const modalStyle = {
    backgroundColor: '#1a1a1a',
    padding: '40px',
    borderRadius: '15px',
    border: '3px solid #ffd700',
    textAlign: 'center',
    minWidth: '450px',
    maxWidth: '90%',
    boxShadow: '0 0 50px rgba(255, 215, 0, 0.2)'
};

const buttonStyle = {
    padding: '15px 30px',
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#2196F3', // Blau zur Unterscheidung vom Checkout (Grün)
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.1s ease',
    outline: 'none',
    minWidth: '60px'
};

export default DoubleAttemptsPopup;