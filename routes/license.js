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

router.post('/ping', licenseLimiter, async (req, res) => {
  try {
    const { hwid } = req.body;
    if (!hwid || hwid.length < 8) {
      return res.json({ valid: false, reason: 'invalid_hwid' });
    }

    const user = await User.findByHwid(hwid);
    if (!user) {
      return res.json({ valid: false, reason: 'hwid_not_found' });
    }

    if (user.banned) {
      return res.json({ valid: false, reason: 'banned' });
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
    if (user) {
      const sub = await Subscription.findActiveByUserId(user.id);
      return res.json({
        registered: true,
        username: user.username,
        uid: user.id,
        role: user.role,
        sub_until: sub ? new Date(sub.valid_until).getTime() : null
      });
    }

    const { rows: unboundSubs } = await require('../db').query(`
      SELECT s.id, s.user_id, u.username, u.email
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.active = true AND s.valid_until > NOW()
        AND u.hwid IS NULL AND u.banned = false
      ORDER BY s.created_at ASC LIMIT 1
    `);

    if (unboundSubs.length > 0) {
      const sub = unboundSubs[0];
      await require('../db').query('UPDATE users SET hwid = $1 WHERE id = $2', [hwid, sub.user_id]);
      console.log(`[LICENSE] Auto-bound HWID to user ${sub.username} (${sub.user_id})`);
      return res.json({ registered: true });
    }

    res.json({ registered: false });
  } catch (err) {
    console.error('[LICENSE] check-hwid error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
