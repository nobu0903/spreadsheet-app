/**
 * auth.js
 * JWT verification middleware for protected routes
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { message: '認証が必要です。ログインしてください。' }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET || 'fallback-dev-secret-change-in-production');
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid JWT:', err.message);
    return res.status(401).json({
      error: { message: 'トークンが無効または期限切れです。再度ログインしてください。' }
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    error: { message: '管理者権限が必要です。' }
  });
}

module.exports = { authMiddleware, requireAdmin };
