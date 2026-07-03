const express = require('express');
const { query } = require('../db');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');

const router = express.Router();

function requireSession(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'admin' && req.session.role !== 'developer') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
}

// ========== STATISTICS ==========

router.get('/statistic/getAll', async (req, res) => {
  try {
    const usersCount = await query('SELECT COUNT(*) FROM users');
    const subsCount = await query('SELECT COUNT(*) FROM subscriptions');
    res.json({ data: { users: parseInt(usersCount.rows[0].count), updates: 132, loades: 25663 } });
  } catch (err) {
    res.json({ data: { users: 0, updates: 132, loades: 0 } });
  }
});

// ========== AUTH ==========

router.post('/users/auth/default', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    if (user.banned) return res.status(403).json({ error: 'Account is banned' });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]);

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          hwid: user.hwid,
          banned: user.banned,
        }
      }
    });
  } catch (err) {
    console.error('[ONYX] login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/auth/session', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'No active session' });
    }

    const user = await User.findByIdFull(req.session.userId);
    if (!user || user.banned) {
      req.session.destroy();
      return res.status(401).json({ error: 'Session invalid' });
    }

    req.session.username = user.username;
    req.session.role = user.role;

    const sub = await Subscription.findActiveByUserId(user.id);

    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          hwid: user.hwid,
          banned: user.banned,
          sub_until: sub ? sub.valid_until : null,
          created_at: user.created_at,
        }
      }
    });
  } catch (err) {
    console.error('[ONYX] session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const existing = await User.findByEmail(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const existingName = await User.findByUsername(username);
    if (existingName) return res.status(400).json({ error: 'Username already taken' });

    const passwordHash = await hashPassword(password);
    const user = await User.create(username, email, passwordHash);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]);

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        }
      }
    });
  } catch (err) {
    console.error('[ONYX] register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/auth/resetPassword', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findByEmail(email);
    if (!user) return res.json({ data: { message: 'If account exists, reset link sent' } });

    const resetToken = generateToken({ id: user.id, purpose: 'reset' }, '1h');
    console.log(`[ONYX] Password reset requested for ${email}, token: ${resetToken}`);
    // In production, send email with reset link

    res.json({ data: { message: 'If account exists, reset link sent' } });
  } catch (err) {
    console.error('[ONYX] resetPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ data: { message: 'Logged out' } });
});

// ========== PROFILE / USER ACTIONS ==========

router.post('/users/actions/activateDigitalKey', requireSession, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });

    const keyRes = await query('SELECT * FROM license_keys WHERE key = $1 AND used = false', [key]);
    if (keyRes.rows.length === 0) return res.status(400).json({ error: 'Invalid or used key' });

    const licenseKey = keyRes.rows[0];
    const hwid = await User.getHwid(req.session.userId);

    await query('UPDATE users SET hwid = $1 WHERE id = $2', [hwid || 'auto_' + Date.now(), req.session.userId]);
    await query('UPDATE license_keys SET used = true, used_by = $1 WHERE id = $2',
      [req.session.userId, licenseKey.id]);

    const sub = await Subscription.create(req.session.userId, licenseKey.duration_days, key);

    res.json({ data: { message: 'Key activated', sub_until: sub.valid_until } });
  } catch (err) {
    console.error('[ONYX] activateKey error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ADMIN - STATES ==========

router.post('/admin/states/isSessionInitialized', requireSession, async (req, res) => {
  try {
    const isAdmin = req.session.role === 'admin' || req.session.role === 'developer';
    res.json({ data: { initialized: isAdmin } });
  } catch (err) {
    res.json({ data: { initialized: false } });
  }
});

// ========== ADMIN - USERS ==========

router.post('/admin/users/getAll', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.body;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '';
    const params = [parseInt(limit), offset];
    if (search) {
      whereClause = 'WHERE (u.username ILIKE $3 OR u.email ILIKE $3)';
      params.push(`%${search}%`);
    }

    const countResult = await query(`SELECT COUNT(*) FROM users u ${whereClause}`, search ? [`%${search}%`] : []);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT u.id, u.username, u.email, u.role, u.hwid, u.banned, u.created_at,
        s.valid_until as sub_until, s.active as sub_active
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.active = true
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, params);

    res.json({
      data: {
        users: result.rows,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      }
    });
  } catch (err) {
    console.error('[ONYX] admin getUsers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/users/getByIdentifier', requireAdmin, async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier required' });

    const user = await User.findByIdFull(identifier);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const subs = await query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [user.id]);

    delete user.password_hash;
    res.json({
      data: {
        user,
        subscriptions: subs.rows,
      }
    });
  } catch (err) {
    console.error('[ONYX] getByIdentifier error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/users/resetHardwareId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await User.updateHwid(userId, null);
    res.json({ data: { message: 'Hardware ID reset', success: true } });
  } catch (err) {
    console.error('[ONYX] resetHWID error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/admin/users/patch', requireAdmin, async (req, res) => {
  try {
    const { userId, role, subscriptionDays, ban } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (role) {
      await User.updateRole(userId, role);
    }

    if (ban !== undefined) {
      await User.setBanned(userId, ban);
      if (ban) {
        const sub = await Subscription.findActiveByUserId(userId);
        if (sub) await Subscription.deactivate(sub.id);
      }
    }

    if (subscriptionDays) {
      const existing = await Subscription.findActiveByUserId(userId);
      if (existing) await Subscription.deactivate(existing.id);
      await Subscription.create(userId, parseInt(subscriptionDays));
    }

    res.json({ data: { message: 'User updated', success: true } });
  } catch (err) {
    console.error('[ONYX] patch user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ADMIN - KEYS ==========

router.post('/admin/multiactions/keys/action/getAll', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.body;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query('SELECT COUNT(*) FROM license_keys');
    const total = parseInt(countResult.rows[0].count);

    const result = await query(`
      SELECT k.id, k.key, k.duration_days, k.used, k.used_by, k.created_at,
        u.username as used_by_username
      FROM license_keys k
      LEFT JOIN users u ON u.id = k.used_by
      ORDER BY k.created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), offset]);

    res.json({
      data: {
        keys: result.rows,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      }
    });
  } catch (err) {
    console.error('[ONYX] getKeys error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/multiactions/keys/action/remove', requireAdmin, async (req, res) => {
  try {
    const { keyId } = req.body;
    if (!keyId) return res.status(400).json({ error: 'keyId required' });

    await query('DELETE FROM license_keys WHERE id = $1', [keyId]);
    res.json({ data: { message: 'Key removed', success: true } });
  } catch (err) {
    console.error('[ONYX] removeKey error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/multiactions/keys/subscription', requireAdmin, async (req, res) => {
  try {
    const { count = 1, duration_days = 30 } = req.body;
    const keys = await Subscription.generateKeys(parseInt(count), parseInt(duration_days));
    res.json({ data: { keys, message: `${count} keys created` } });
  } catch (err) {
    console.error('[ONYX] createKeys error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/multiactions/keys/hardwareReset', requireAdmin, async (req, res) => {
  try {
    const { count = 1 } = req.body;
    const keys = [];
    for (let i = 0; i < parseInt(count); i++) {
      const crypto = require('crypto');
      const key = 'HR-' + crypto.randomBytes(12).toString('hex').toUpperCase();
      await query('INSERT INTO license_keys (key, duration_days) VALUES ($1, $2)', [key, 0]);
      keys.push(key);
    }
    res.json({ data: { keys, message: `${count} hardware reset keys created` } });
  } catch (err) {
    console.error('[ONYX] createHwResetKeys error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/multiactions/keys/beta', requireAdmin, async (req, res) => {
  try {
    const { count = 1 } = req.body;
    const keys = await Subscription.generateKeys(parseInt(count), 365);
    res.json({ data: { keys, message: `${count} beta keys created` } });
  } catch (err) {
    console.error('[ONYX] createBetaKeys error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ADMIN - PROMOCODES (stubs) ==========

router.post('/admin/promocodes/getAll', requireAdmin, async (req, res) => {
  res.json({ data: { promocodes: [], total: 0, page: 1, pages: 0 } });
});

router.post('/admin/promocodes/create', requireAdmin, async (req, res) => {
  res.json({ data: { message: 'Promocode created', success: true } });
});

router.post('/admin/promocodes/patch', requireAdmin, async (req, res) => {
  res.json({ data: { message: 'Promocode updated', success: true } });
});

router.post('/admin/promocodes/delete', requireAdmin, async (req, res) => {
  res.json({ data: { message: 'Promocode deleted', success: true } });
});

router.post('/admin/promocodes/statistic/get', requireAdmin, async (req, res) => {
  res.json({ data: { uses: 0, revenue: 0 } });
});

// ========== ADMIN - FINANCES / WITHDRAW (stubs) ==========

router.post('/admin/finances/getBalance', requireAdmin, async (req, res) => {
  res.json({ data: { balance: 0 } });
});

router.post('/admin/finances/getWithdraws', requireAdmin, async (req, res) => {
  res.json({ data: { withdraws: [], total: 0 } });
});

router.post('/admin/finances/createInference', requireAdmin, async (req, res) => {
  res.json({ data: { message: 'Withdraw created', success: true } });
});

router.post('/admin/finances/getBanks', requireAdmin, async (req, res) => {
  res.json({ data: { banks: [] } });
});

// ========== ADMIN - AUTOLOAD ==========

router.post('/admin/autoload/getVersions', requireAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const p = require('path');
    const configPath = p.join(__dirname, '..', 'uploads', 'jar_config.json');
    let versions = [];
    let current = null;
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      current = { version: data.path ? data.path.split(/[/\\]/).pop() : 'unknown', created_at: data.uploadedAt || new Date().toISOString() };
    }
    res.json({ data: { versions, current } });
  } catch (err) {
    res.json({ data: { versions: [], current: null } });
  }
});

router.post('/admin/autoload/uploadVersion', requireAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.jar) {
      return res.status(400).json({ error: 'No jar file uploaded' });
    }
    const jar = req.files.jar;
    const uploadPath = require('path').join(__dirname, '..', 'uploads', 'appleskin.jar');
    await jar.mv(uploadPath);
    const fs = require('fs');
    fs.writeFileSync(require('path').join(__dirname, '..', 'uploads', 'jar_config.json'),
      JSON.stringify({ path: uploadPath, uploadedAt: new Date().toISOString() }));
    res.json({ data: { message: 'Version uploaded', success: true } });
  } catch (err) {
    console.error('[ONYX] upload jar error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ADMIN - EVENTS LOG (stubs) ==========

router.post('/admin/events/log', requireAdmin, async (req, res) => {
  res.json({ data: { events: [], total: 0, page: 1, pages: 0 } });
});

// ========== FRIENDS (stubs) ==========

router.post('/friends/getAll', requireSession, async (req, res) => {
  res.json({ data: { friends: [] } });
});

router.post('/friends/request', requireSession, async (req, res) => {
  res.json({ data: { message: 'Friend request sent', success: true } });
});

router.post('/friends/accept', requireSession, async (req, res) => {
  res.json({ data: { message: 'Friend request accepted', success: true } });
});

router.post('/friends/remove', requireSession, async (req, res) => {
  res.json({ data: { message: 'Friend removed', success: true } });
});

// ========== PAYMENTS (stubs) ==========

router.get('/payments/getAll', requireSession, async (req, res) => {
  res.json({ data: { payments: [] } });
});

router.get('/payments/getMethods', async (req, res) => {
  res.json({ data: { methods: [{ id: 'card', name: 'Card', enabled: true }] } });
});

router.get('/payments/additional/getAll', async (req, res) => {
  res.json({ data: { products: [] } });
});

router.post('/payments/frontend/create', requireSession, async (req, res) => {
  res.json({ data: { url: '/profile', id: 'payment_' + Date.now() } });
});

router.post('/payments/promocodes/apply', requireSession, async (req, res) => {
  res.json({ data: { discount: 0, error: 'Invalid promocode' } });
});

// ========== ROULETTE (stubs) ==========

router.get('/roulette/getPrizes', requireSession, async (req, res) => {
  res.json({ data: { prizes: [] } });
});

router.post('/roulette/roll', requireSession, async (req, res) => {
  res.json({ data: { prize: null, message: 'No rolls available' } });
});

router.post('/roulette/status', requireSession, async (req, res) => {
  res.json({ data: { rolls: 0, nextRoll: null } });
});

// ========== USER SUBSCRIPTIONS ==========

router.get('/user/subscriptions/getAdditionalSubscriptions', requireSession, async (req, res) => {
  res.json({ data: { subscriptions: [] } });
});

// ========== EMAIL (stub) ==========

router.post('/email/setup', requireSession, async (req, res) => {
  res.json({ data: { message: 'Email configured', success: true } });
});

// ========== 2FA (stubs) ==========

router.post('/users/auth/2fa/generate', requireSession, async (req, res) => {
  res.json({ data: { secret: '', qr: '' } });
});

router.post('/users/auth/2fa/initializePanelSession', requireSession, async (req, res) => {
  res.json({ data: { initialized: true } });
});

module.exports = router;
