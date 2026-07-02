const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }

  if (user.banned) {
    return res.status(403).json({ error: 'Account is banned.' });
  }

  req.user = { ...decoded, role: user.role };
  next();
}

module.exports = { authenticate };
