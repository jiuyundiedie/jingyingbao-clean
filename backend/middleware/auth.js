const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
    || req.headers['x-access-token'];
  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  const decoded = verify(token);
  if (!decoded) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const decoded = verify(token);
    if (decoded) req.user = decoded;
  }
  next();
}

module.exports = { sign, verify, authRequired, optionalAuth };
