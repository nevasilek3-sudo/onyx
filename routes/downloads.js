const express = require('express');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const JAR_PATH = path.resolve(__dirname, '..', '..', 'build', 'libs', 'appleskin-1.0.0-obf.jar');

router.get('/download', authenticate, async (req, res) => {
  try {
    const user = await User.findByIdFull(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.role === 'admin' || user.role === 'developer' || user.role === 'media') {
      return sendJar(res);
    }

    if (user.banned) {
      return res.status(403).json({ error: 'Account is banned.' });
    }

    const sub = await Subscription.findActiveByUserId(user.id);
    if (!sub) {
      return res.status(403).json({ error: 'No active subscription.' });
    }

    sendJar(res);
  } catch (err) {
    console.error('[DOWNLOADS] error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

function sendJar(res) {
  if (!fs.existsSync(JAR_PATH)) {
    return res.status(404).json({ error: 'Build file not found on server.' });
  }

  res.download(JAR_PATH, 'appleskin-1.0.0.jar', (err) => {
    if (err) {
      console.error('[DOWNLOADS] send error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed.' });
      }
    }
  });
}

module.exports = router;
