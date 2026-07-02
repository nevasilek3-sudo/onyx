const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { globalLimiter } = require('./middleware/rateLimiter');
const Session = require('./models/Session');
const { setupWebSocket, getOnlineUsers } = require('./websocket');
const { authenticate } = require('./middleware/auth');
const { query } = require('./db');

const authRoutes = require('./routes/auth');
const licenseRoutes = require('./routes/license');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const downloadRoutes = require('./routes/downloads');
const iconRoutes = require('./routes/icon');

async function migrate() {
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await query(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(32) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      hwid VARCHAR(128) DEFAULT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      banned BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_login TIMESTAMP DEFAULT NULL
    )`);
    await query(`CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      license_key VARCHAR(64) UNIQUE NOT NULL,
      valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
      valid_until TIMESTAMP NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE TABLE IF NOT EXISTS license_keys (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      key VARCHAR(64) UNIQUE NOT NULL,
      duration_days INT NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      used_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await query(`CREATE TABLE IF NOT EXISTS user_icons (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      icon_data TEXT NOT NULL,
      mime_type VARCHAR(32) NOT NULL DEFAULT 'image/png',
      selected BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    console.log('[DB] Migration complete');
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }
}

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(globalLimiter);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client', downloadRoutes);
app.use('/api/icon', iconRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/online', authenticate, (req, res) => {
  res.json({ users: getOnlineUsers() });
});

app.get('/api/icon/user/:userId', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT icon_data, mime_type FROM user_icons WHERE user_id = $1 AND selected = true',
      [req.params.userId]
    );
    if (result.rows.length === 0) {
      return res.json({ icon: null });
    }
    res.json({ icon: result.rows[0].icon_data, mime_type: result.rows[0].mime_type });
  } catch (err) {
    console.error('[ICON] user icon error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[SERVER] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

setInterval(() => {
  Session.cleanup().catch(err => console.error('[SERVER] session cleanup error:', err));
}, 3600000);

const server = http.createServer(app);
setupWebSocket(server);

migrate().then(() => {
  server.listen(config.port, () => {
    console.log(`[SERVER] backend running on port ${config.port}`);
    console.log(`[SERVER] ws enabled on port ${config.port}`);
    console.log(`[SERVER] cors origin: ${config.corsOrigin}`);
    console.log(`[SERVER] env: ${config.isDev ? 'development' : 'production'}`);
  });
}).catch(err => {
  console.error('[SERVER] migration failed:', err);
});
