const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// JWT utilities
const generateJWT = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
};

const verifyJWT = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Mock OAuth functions
const mockOAuthLogin = () => {
  // Simulate redirect URL to doca.at OAuth
  const redirectUrl = `${process.env.DOCA_OAUTH_BASE_URL}/authorize?client_id=${process.env.DOCA_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DOCA_OAUTH_REDIRECT_URI)}&response_type=code&scope=user:read`;
  return redirectUrl;
};

const mockOAuthCallback = (code) => {
  // Mock processing of OAuth code
  // In real implementation, exchange code for token via doca.at API
  if (code === 'mock_code') {
    // Mock user data
    return {
      id: 1,
      username: 'testuser',
      email: 'test@example.com'
    };
  }
  throw new Error('Invalid OAuth code');
};

const refreshJWT = (oldToken) => {
  const payload = verifyJWT(oldToken);
  if (!payload) {
    throw new Error('Invalid token');
  }
  // Generate new token with refreshed expiration
  return generateJWT({ id: payload.id, username: payload.username, email: payload.email });
};

module.exports = {
  generateJWT,
  verifyJWT,
  mockOAuthLogin,
  mockOAuthCallback,
  refreshJWT
};