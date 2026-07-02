const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { hashPassword, comparePassword } = require('../utils/hash');
const { authenticate } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findByIdFull(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const sub = await Subscription.findActiveByUserId(user.id);

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      hwid: user.hwid || null,
      sub_until: sub ? sub.valid_until : null,
      created_at: user.created_at,
    });
  } catch (err) {
    console.error('[USER] profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/reset-hwid', authenticate, [
  body('password').isString().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'developer') {
      return res.status(403).json({ error: 'Only admin/developer can reset HWID.' });
    }

    const user = await User.findByIdFull(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const valid = await comparePassword(req.body.password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const newHwid = crypto.randomBytes(32).toString('hex');
    await User.updateHwid(user.id, newHwid);

    const sub = await Subscription.findActiveByUserId(user.id);
    if (sub) {
      await Subscription.deactivate(sub.id);
    }

    res.json({ success: true, new_hwid: newHwid });
  } catch (err) {
    console.error('[USER] reset-hwid error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/change-password', authenticate, [
  body('old_password').isString().notEmpty(),
  body('new_password').isLength({ min: 8, max: 128 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const user = await User.findByIdFull(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const valid = await comparePassword(req.body.old_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid current password.' });
    }

    const newHash = await hashPassword(req.body.new_password);
    await User.updatePassword(user.id, newHash);

    res.json({ success: true });
  } catch (err) {
    console.error('[USER] change-password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
