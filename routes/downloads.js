const express = require('express');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { authenticate } = require('../middleware/auth');
const { adminOrDev } = require('../middleware/adminAuth');

const router = express.Router();

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const JAR_CONFIG = path.resolve(__dirname, '..', 'uploads', 'jar_config.json');
const DEFAULT_JAR = path.resolve(__dirname, '..', 'appleskin-1.0.0-obf.jar');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getJarPath() {
  try {
    if (fs.existsSync(JAR_CONFIG)) {
      const config = JSON.parse(fs.readFileSync(JAR_CONFIG, 'utf-8'));
      if (config.path && fs.existsSync(config.path)) {
        return config.path;
      }
    }
  } catch (e) {}
  return DEFAULT_JAR;
}

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

router.post('/upload-jar', authenticate, adminOrDev, (req, res) => {
  try {
    if (!req.files || !req.files.jar) {
      return res.status(400).json({ error: 'No JAR file uploaded.' });
    }

    const jar = req.files.jar;
    if (!jar.name.endsWith('.jar')) {
      return res.status(400).json({ error: 'File must be a .jar' });
    }

    const savePath = path.resolve(UPLOADS_DIR, 'appleskin.jar');
    jar.mv(savePath, (err) => {
      if (err) {
        console.error('[DOWNLOADS] upload error:', err);
        return res.status(500).json({ error: 'Upload failed.' });
      }

      fs.writeFileSync(JAR_CONFIG, JSON.stringify({ path: savePath, uploadedAt: new Date().toISOString() }));
      res.json({ success: true, filename: 'appleskin.jar' });
    });
  } catch (err) {
    console.error('[DOWNLOADS] upload error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/jar-info', authenticate, adminOrDev, (req, res) => {
  const jarPath = getJarPath();
  const exists = fs.existsSync(jarPath);
  const size = exists ? fs.statSync(jarPath).size : 0;
  res.json({ exists, size, path: jarPath });
});

function sendJar(res) {
  const jarPath = getJarPath();
  if (!fs.existsSync(jarPath)) {
    return res.status(404).json({ error: 'Build file not found on server.' });
  }

  res.download(jarPath, 'appleskin-1.0.0.jar', (err) => {
    if (err) {
      console.error('[DOWNLOADS] send error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed.' });
      }
    }
  });
}

module.exports = router;
