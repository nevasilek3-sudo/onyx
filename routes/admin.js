const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { hashPassword } = require('../utils/hash');
const { authenticate } = require('../middleware/auth');
const { adminOrDev, adminOnly } = require('../middleware/adminAuth');
const crypto = require('crypto');

const router = express.Router();

router.post('/setup', authenticate, [
  body('secret').isString().notEmpty(),
], async (req, res) => {
  try {
    if (req.body.secret !== 'appleskin-dev-setup-2024') {
      return res.status(403).json({ error: 'Invalid secret.' });
    }

    const { rows } = await require('../db').query(
      `SELECT COUNT(*) FROM users WHERE role = 'developer'`
    );
    if (parseInt(rows[0].count) > 0) {
      return res.status(403).json({ error: 'Developer already exists. Use admin panel.' });
    }

    await require('../db').query(
      `UPDATE users SET role = 'developer' WHERE id = $1`,
      [req.user.id]
    );

    res.json({ success: true, message: 'You are now a developer.' });
  } catch (err) {
    console.error('[ADMIN] setup error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.use(authenticate, adminOrDev);

router.get('/users', async (req, res) => {
  try {
    const { page, limit, search, role } = req.query;
    const result = await User.list({
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 100),
      search: search || '',
      role: role || '',
    });
    res.json(result);
  } catch (err) {
    console.error('[ADMIN] list users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdFull(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const subscriptions = await require('../db').query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [user.id]
    );
    delete user.password_hash;
    res.json({ user, subscriptions: subscriptions.rows });
  } catch (err) {
    console.error('[ADMIN] get user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/users/:id/give-sub', [
  body('duration_days').isInt({ min: 1, max: 3650 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const sub = await Subscription.create(user.id, req.body.duration_days);
    res.json({ subscription: sub });
  } catch (err) {
    console.error('[ADMIN] give-sub error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/users/:id/revoke-sub', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const sub = await Subscription.findActiveByUserId(user.id);
    if (sub) {
      await Subscription.deactivate(sub.id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] revoke-sub error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/users/:id/reset-hwid', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newHwid = crypto.randomBytes(32).toString('hex');
    await User.updateHwid(user.id, newHwid);

    const sub = await Subscription.findActiveByUserId(user.id);
    if (sub) {
      await Subscription.deactivate(sub.id);
    }

    res.json({ success: true, new_hwid: newHwid });
  } catch (err) {
    console.error('[ADMIN] reset-hwid error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/users/:id/change-role', [
  body('role').isIn(['user', 'prem-user', 'media', 'admin', 'developer']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const targetUser = await User.findByIdFull(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newRole = req.body.role;

    if (req.user.role === 'developer' && (newRole === 'admin' || newRole === 'developer')) {
      return res.status(403).json({ error: 'Developers cannot grant admin/developer role.' });
    }

    if (req.user.role === 'developer' && targetUser.role === 'admin') {
      return res.status(403).json({ error: 'Developers cannot modify admin accounts.' });
    }

    await User.updateRole(targetUser.id, newRole);
    res.json({ success: true, new_role: newRole });
  } catch (err) {
    console.error('[ADMIN] change-role error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    const targetUser = await User.findByIdFull(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.user.role === 'developer' && (targetUser.role === 'admin' || targetUser.role === 'developer')) {
      return res.status(403).json({ error: 'Cannot ban other admins/developers.' });
    }

    const banned = !targetUser.banned;
    await User.setBanned(targetUser.id, banned);

    if (banned) {
      const sub = await Subscription.findActiveByUserId(targetUser.id);
      if (sub) {
        await Subscription.deactivate(sub.id);
      }
    }

    res.json({ success: true, banned });
  } catch (err) {
    console.error('[ADMIN] ban error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/generate-keys', adminOrDev, [
  body('count').isInt({ min: 1, max: 1000 }),
  body('duration_days').isInt({ min: 1, max: 3650 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const keys = await Subscription.generateKeys(req.body.count, req.body.duration_days);
    res.json({ keys });
  } catch (err) {
    console.error('[ADMIN] generate-keys error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await User.getStats();
    res.json(stats);
  } catch (err) {
    console.error('[ADMIN] stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
