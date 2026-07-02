require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/appleskin',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  wsUrl: process.env.WS_URL || 'ws://localhost:3000/ws',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  bcryptRounds: 12,
};
