import React from 'react';

const CheckoutPopup = ({ isActive, onSelect, user, checkoutPlayer }) => {
    // Wenn nicht aktiv, nichts rendern
    if (!isActive) return null;

    // Sicherheitscheck: Zeige das Popup nur dem Spieler, der geworfen hat
    const isMe = user && checkoutPlayer && user.id === checkoutPlayer.id;

    if (!isMe) {
        return null;
    }

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h2 style={{ color: '#ffd700', margin: '0 0 20px 0', fontSize: '28px' }}>
                    CHECKOUT! 🎯
                </h2>
                <h3 style={{ color: 'white', margin: '0 0 30px 0', fontWeight: 'normal', fontSize: '18px' }}>
                    Mit welchem Dart hast du ausgecheckt?
                </h3>
                
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                    {[1, 2, 3].map((dartNumber) => (
                        <button
                            key={dartNumber}
                            onClick={() => onSelect(dartNumber)}
                            style={buttonStyle}
                            onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                        >
                            {dartNumber}. Dart
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- STYLES (Inline, damit es garantiert funktioniert) ---

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Dunkler Hintergrund
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999, // Über allem anderen
    backdropFilter: 'blur(5px)' // Leichter Weichzeichner für den Hintergrund
};

const modalStyle = {
    backgroundColor: '#1a1a1a',
    padding: '40px',
    borderRadius: '15px',
    border: '3px solid #ffd700', // Goldener Rand
    textAlign: 'center',
    minWidth: '400px',
    maxWidth: '90%',
    boxShadow: '0 0 50px rgba(255, 215, 0, 0.2)'
};

const buttonStyle = {
    padding: '15px 30px',
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.1s ease',
    outline: 'none'
};

export default CheckoutPopup;
