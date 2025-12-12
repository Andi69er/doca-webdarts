import React from 'react';
import { useNavigate } from 'react-router-dom'; // Wichtig: Wir importieren das "Lenkrad"

function Login() {
  const navigate = useNavigate(); // Wir holen uns das "Lenkrad"

  const handleLogin = () => {
    // alert('Login-Button geklickt! Weiterleitung zur Lobby...'); // Die Alert-Box brauchen wir nicht mehr.

    // Das ist der "React-Weg" zur Weiterleitung. Sanft und ohne Neuladen.
    navigate('/'); 
  };

  return (
    <div>
      <h1>Login</h1>
      <p>Bitte logge dich ein, um fortzufahren.</p>
      <button onClick={handleLogin}>Login mit DOCA (simuliert)</button>
    </div>
  );
}

export default Login;