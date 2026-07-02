const jwt = require('jsonwebtoken');
const config = require('../config');

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwtSecret + '_refresh', { expiresIn: config.jwtRefreshExpiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret + '_refresh');
  } catch {
    return null;
  }
}

module.exports = { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken };
