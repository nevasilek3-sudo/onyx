const { query } = require('../db');

const Session = {
  async create(userId, token, expiresAt) {
    await query(
      `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );
  },

  async findByToken(token) {
    const { rows } = await query(
      'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    return rows[0] || null;
  },

  async deleteByUserId(userId) {
    await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  },

  async cleanup() {
    await query('DELETE FROM sessions WHERE expires_at < NOW()');
  },
};

module.exports = Session;
