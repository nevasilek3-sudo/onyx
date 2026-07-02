const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const Subscription = {
  async create(userId, durationDays, licenseKey = null) {
    if (!licenseKey) {
      licenseKey = 'AS-' + crypto.randomBytes(12).toString('hex').toUpperCase();
    }
    const { rows } = await query(
      `INSERT INTO subscriptions (user_id, license_key, valid_from, valid_until, active)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 day' * $3, true)
       RETURNING *`,
      [userId, licenseKey, durationDays]
    );
    return rows[0];
  },

  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async findActiveByUserId(userId) {
    const { rows } = await query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND active = true AND valid_until > NOW()
       ORDER BY valid_until DESC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async findByLicenseKey(key) {
    const { rows } = await query('SELECT * FROM subscriptions WHERE license_key = $1', [key]);
    return rows[0] || null;
  },

  async deactivate(id) {
    await query('UPDATE subscriptions SET active = false WHERE id = $1', [id]);
  },

  async deactivateByUserId(userId) {
    await query('UPDATE subscriptions SET active = false WHERE user_id = $1', [userId]);
  },

  async generateKeys(count, durationDays) {
    const keys = [];
    for (let i = 0; i < count; i++) {
      const key = 'AS-' + crypto.randomBytes(12).toString('hex').toUpperCase();
      await query(
        `INSERT INTO license_keys (key, duration_days) VALUES ($1, $2)`,
        [key, durationDays]
      );
      keys.push(key);
    }
    return keys;
  },

  async activateKey(key, userId) {
    const keyRes = await query(
      'SELECT * FROM license_keys WHERE key = $1 AND used = false',
      [key]
    );
    if (keyRes.rows.length === 0) return null;

    const licenseKey = keyRes.rows[0];
    await query('UPDATE license_keys SET used = true, used_by = $1 WHERE id = $2', [userId, licenseKey.id]);

    const sub = await this.create(userId, licenseKey.duration_days, key);
    return sub;
  },
};

module.exports = Subscription;
