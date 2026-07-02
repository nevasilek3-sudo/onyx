const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const MAX_ICON_SIZE = 256 * 1024;

router.use(authenticate);

router.post('/upload', [
  body('icon_data').isString().notEmpty().isLength({ max: MAX_ICON_SIZE }),
  body('mime_type').optional().isIn(['image/png', 'image/jpeg', 'image/gif']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { icon_data, mime_type } = req.body;
    const dataSize = Buffer.byteLength(icon_data, 'utf-8');
    if (dataSize > MAX_ICON_SIZE) {
      return res.status(400).json({ error: 'Icon data too large (max 256KB).' });
    }

    const existing = await query('SELECT id FROM user_icons WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length > 0) {
      await query(
        `UPDATE user_icons SET icon_data = $1, mime_type = $2, updated_at = NOW() WHERE user_id = $3`,
        [icon_data, mime_type || 'image/png', req.user.id]
      );
    } else {
      await query(
        `INSERT INTO user_icons (user_id, icon_data, mime_type, selected) VALUES ($1, $2, $3, true)`,
        [req.user.id, icon_data, mime_type || 'image/png']
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ICON] upload error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/download', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      'SELECT icon_data, mime_type FROM user_icons WHERE user_id = $1 AND selected = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No icon selected.' });
    }

    const { icon_data, mime_type } = result.rows[0];
    const imgBuffer = Buffer.from(icon_data, 'base64');

    res.set('Content-Type', mime_type);
    res.set('Content-Length', imgBuffer.length.toString());
    res.send(imgBuffer);
  } catch (err) {
    console.error('[ICON] download error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/get', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      'SELECT icon_data, mime_type FROM user_icons WHERE user_id = $1 AND selected = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ icon: null });
    }

    res.json({
      icon: result.rows[0].icon_data,
      mime_type: result.rows[0].mime_type,
    });
  } catch (err) {
    console.error('[ICON] get error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/delete', async (req, res) => {
  try {
    await query('DELETE FROM user_icons WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[ICON] delete error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
