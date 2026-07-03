const { query } = require('../db');

const ROLES = ['user', 'prem-user', 'media', 'admin', 'developer'];

const User = {
  async create(username, email, passwordHash) {
    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, username, email, role, created_at`,
      [username, email, passwordHash]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT id, username, email, role, hwid, created_at, last_login, banned
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findByUsername(username) {
    const { rows } = await query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  },

  async findByHwid(hwid) {
    const { rows } = await query('SELECT * FROM users WHERE hwid = $1', [hwid]);
    return rows[0] || null;
  },

  async getHwid(id) {
    const { rows } = await query('SELECT hwid FROM users WHERE id = $1', [id]);
    return rows[0] ? rows[0].hwid : null;
  },

  async findByIdFull(id) {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async updateHwid(id, hwid) {
    await query('UPDATE users SET hwid = $1 WHERE id = $2', [hwid, id]);
  },

  async updateLastLogin(id) {
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [id]);
  },

  async updateRole(id, role) {
    if (!ROLES.includes(role)) throw new Error('Invalid role');
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
  },

  async updatePassword(id, passwordHash) {
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  },

  async setBanned(id, banned) {
    await query('UPDATE users SET banned = $1 WHERE id = $2', [banned, id]);
  },

  async list({ page = 1, limit = 50, search = '', role = '' } = {}) {
    const offset = (page - 1) * limit;
    let where = '1=1';
    let params = [];
    let paramIndex = 1;

    if (search) {
      where += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      where += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    const countRes = await query(`SELECT COUNT(*) FROM users WHERE ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT id, username, email, role, hwid, created_at, last_login, banned
       FROM users WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return { users: rows, total, page, limit };
  },

  async getStats() {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '1 day') AS users_today,
        (SELECT COUNT(*) FROM subscriptions WHERE active = true AND valid_until > NOW()) AS active_subs,
        (SELECT COUNT(*) FROM subscriptions) AS total_keys_used
    `);
    return rows[0];
  },
};

module.exports = User;
