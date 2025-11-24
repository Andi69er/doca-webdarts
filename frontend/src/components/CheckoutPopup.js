import React from 'react';

function CheckoutPopup({ isActive, onSelect, user, checkoutPlayer }) {
  if (!isActive) return null;

  const isCurrentUser = user && checkoutPlayer && user.id === checkoutPlayer.id;

  return (
    <div className="checkout-popup-overlay">
      <div className="checkout-popup">
        <h3>Mit welchem Dart haben Sie ausgecheckt?</h3>
        {isCurrentUser ? (
          <div className="checkout-options">
            <button className="checkout-option" onClick={() => onSelect(1)}>1 Dart</button>
            <button className="checkout-option" onClick={() => onSelect(2)}>2 Darts</button>
            <button className="checkout-option" onClick={() => onSelect(3)}>3 Darts</button>
          </div>
        ) : (
          <p>Warten auf {checkoutPlayer?.name}...</p>
        )}
      </div>
    </div>
  );
}

export default CheckoutPopup;