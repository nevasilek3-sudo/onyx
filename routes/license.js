const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { generateToken, verifyToken } = require('../utils/jwt');
const { licenseLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/activate', licenseLimiter, [
  body('key').isString().notEmpty(),
  body('hwid').isString().isLength({ min: 8, max: 128 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { key, hwid } = req.body;

    let user = await User.findByHwid(hwid);
    if (user) {
      const sub = await Subscription.findActiveByUserId(user.id);
      if (sub) {
        const token = generateToken({ id: user.id, username: user.username, role: user.role });
        return res.json({
          success: true,
          user: {
            username: user.username,
            uid: user.id,
            role: user.role,
            sub_until: sub.valid_until,
          },
          token,
        });
      }
    }

    const keyRes = await require('../db').query(
      'SELECT * FROM license_keys WHERE key = $1 AND used = false', [key]
    );
    if (keyRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or already used license key.' });
    }

    const licenseKey = keyRes.rows[0];
    if (!user) {
      const tempUsername = 'user_' + hwid.substring(0, 8);
      const tempEmail = tempUsername + '@hwid.appleskin';
      const { hashPassword } = require('../utils/hash');
      const passwordHash = await hashPassword(hwid + '_temp_' + Date.now());
      user = await User.create(tempUsername, tempEmail, passwordHash);
    }

    await User.updateHwid(user.id, hwid);
    await require('../db').query(
      'UPDATE license_keys SET used = true, used_by = $1 WHERE id = $2',
      [user.id, licenseKey.id]
    );

    const sub = await Subscription.create(user.id, licenseKey.duration_days, key);
    const token = generateToken({ id: user.id, username: user.username, role: user.role });

    res.json({
      success: true,
      user: {
        username: user.username,
        uid: user.id,
        role: user.role,
        sub_until: sub.valid_until,
      },
      token,
    });
  } catch (err) {
    console.error('[LICENSE] activate error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/check', licenseLimiter, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { token } = req.body;
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.json({ valid: false, reason: 'invalid_token' });
    }

    const user = await User.findByIdFull(decoded.id);
    if (!user || user.banned) {
      return res.json({ valid: false, reason: 'banned' });
    }

    const sub = await Subscription.findActiveByUserId(user.id);

    res.json({
      valid: !!sub,
      username: user.username,
      uid: user.id,
      role: user.role,
      sub_until: sub ? sub.valid_until : null,
      hwid: user.hwid,
    });
  } catch (err) {
    console.error('[LICENSE] check error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/ping', authenticate, async (req, res) => {
  try {
    const { hwid } = req.body;
    const user = await User.findByIdFull(req.user.id);
    if (!user) {
      return res.json({ valid: false, reason: 'user_not_found' });
    }

    if (user.banned) {
      return res.json({ valid: false, reason: 'banned' });
    }

    if (user.hwid && user.hwid !== hwid) {
      return res.json({ valid: false, reason: 'hwid_mismatch' });
    }

    const sub = await Subscription.findActiveByUserId(user.id);
    if (!sub) {
      return res.json({ valid: false, reason: 'no_active_subscription' });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('[LICENSE] ping error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/check-hwid', licenseLimiter, async (req, res) => {
  try {
    const { hwid } = req.body;
    if (!hwid || hwid.length < 8) {
      return res.status(400).json({ error: 'Invalid HWID' });
    }

    const user = await User.findByHwid(hwid);
    res.json({ registered: !!user });
  } catch (err) {
    console.error('[LICENSE] check-hwid error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
