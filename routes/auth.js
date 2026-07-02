const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Session = require('../models/Session');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const { strictLimiter } = require('../middleware/rateLimiter');
const config = require('../config');

const router = express.Router();

function msFromNow(expiresIn) {
  const match = expiresIn.match(/^(\d+)([hd])$/);
  if (!match) return 3600000;
  const num = parseInt(match[1]);
  return match[2] === 'd' ? num * 86400000 : num * 3600000;
}

router.post('/register', strictLimiter, [
  body('username').trim().isLength({ min: 3, max: 32 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8, max: 128 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { username, email, password } = req.body;

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create(username, email, passwordHash);

    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + msFromNow(config.jwtExpiresIn));
    await Session.create(user.id, token, expiresAt);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already taken.' });
    }
    console.error('[AUTH] register error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/login', strictLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.banned) {
      return res.status(403).json({ error: 'Account is banned.' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await User.updateLastLogin(user.id);

    const sub = await Subscription.findActiveByUserId(user.id);
    const subUntil = sub ? sub.valid_until : null;

    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + msFromNow(config.jwtExpiresIn));
    await Session.create(user.id, token, expiresAt);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        sub_until: subUntil,
      },
    });
  } catch (err) {
    console.error('[AUTH] login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    await Session.deleteByUserId(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[AUTH] logout error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
